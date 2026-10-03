//! AI requests, structured translation, and context-aware translation memory.

use super::model_config::ModelApi;
use crate::error::AppError;
use crate::services::batch_progress_channel::{
    TranslationInput, TranslationItem, TranslationSource,
};
use crate::services::config_draft::ConfigDraft;
use crate::services::prompt_builder;
use crate::services::term_library::TermLibrary;
use crate::services::translation_memory::{TranslationMemory, canonical_target_language};
use crate::services::translation_stats::{BatchStats, TokenStats};
use crate::utils::paths::get_translation_memory_path;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::time::Duration;

pub use super::model_config::AIConfig;

#[cfg(feature = "ts-rs")]
use ts_rs::TS;

pub use crate::services::prompt_builder::DEFAULT_SYSTEM_PROMPT;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "ts-rs", derive(TS))]
#[cfg_attr(
    feature = "ts-rs",
    ts(export, export_to = "../../src/types/generated/")
)]
pub struct ProxyConfig {
    pub host: String,
    pub port: u16,
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ChatMessage {
    role: String,
    content: String,
}

#[derive(Serialize)]
struct ChatRequest {
    model: String,
    messages: Vec<ChatMessage>,
    temperature: f32,
}

#[derive(Deserialize)]
struct ChatResponse {
    content: String,
    usage: Option<Usage>,
}

#[derive(Debug, Deserialize)]
struct Usage {
    #[serde(alias = "input_tokens", alias = "prompt_tokens", default)]
    input_tokens: u32,
    #[serde(alias = "output_tokens", alias = "completion_tokens", default)]
    output_tokens: u32,
    #[serde(default)]
    total_tokens: u32,
}

#[derive(Debug, Clone)]
pub struct AITranslator {
    client: Client,
    api_key: String,
    base_url: String,
    model: String,
    provider_id: String,
    catalog_provider_id: Option<String>,
    api: ModelApi,
    max_tokens: Option<u32>,
    system_prompt: String,
    token_stats: TokenStats,
    tm: Option<TranslationMemory>,
    term_library: Option<TermLibrary>,
    target_language: Option<String>,
    pub batch_stats: BatchStats,
    #[cfg(test)]
    test_timeout: Option<u64>,
}

impl AITranslator {
    pub fn new_with_config(
        config: AIConfig,
        use_tm: bool,
        custom_system_prompt: Option<&str>,
        target_language: Option<String>,
    ) -> Result<Self, AppError> {
        let mut builder = Client::builder()
            .no_proxy()
            .redirect(reqwest::redirect::Policy::none());
        if let Some(proxy) = config.proxy.filter(|proxy| proxy.enabled) {
            builder = builder.proxy(reqwest::Proxy::all(format!(
                "http://{}:{}",
                proxy.host, proxy.port
            ))?);
        }
        let term_path = crate::utils::paths::get_term_library_path();
        let terms = if term_path.exists() {
            Some(TermLibrary::load_from_file(term_path)?)
        } else {
            None
        };
        Ok(Self {
            client: builder.build()?,
            api_key: config.api_key,
            base_url: config.base_url.trim_end_matches('/').to_string(),
            model: config.model,
            provider_id: config.provider_id,
            catalog_provider_id: config.catalog_provider_id,
            api: config.api,
            max_tokens: config.max_tokens,
            system_prompt: prompt_builder::build_system_prompt(custom_system_prompt),
            term_library: terms,
            token_stats: TokenStats::default(),
            tm: if use_tm {
                Some(TranslationMemory::new_from_file(
                    get_translation_memory_path(),
                )?)
            } else {
                None
            },
            target_language: target_language.map(|lang| canonical_target_language(&lang)),
            batch_stats: BatchStats::default(),
            #[cfg(test)]
            test_timeout: None,
        })
    }

    /// Indexes refer to the original input, including duplicates and TM hits.
    pub async fn translate_inputs(
        &mut self,
        inputs: Vec<TranslationInput>,
    ) -> Result<Vec<TranslationItem>, AppError> {
        self.batch_stats.init(inputs.len());
        if inputs.is_empty() {
            return Ok(Vec::new());
        }
        let target = self
            .target_language
            .as_deref()
            .filter(|target| !target.is_empty())
            .ok_or_else(|| AppError::validation("翻译必须指定目标语言"))?
            .to_string();
        let mut results: Vec<Option<TranslationItem>> = (0..inputs.len()).map(|_| None).collect();
        let mut groups: HashMap<(String, Option<String>), Vec<usize>> = HashMap::new();
        let mut unique = Vec::new();
        for (index, input) in inputs.iter().enumerate() {
            let has_phrase_rules = self.term_library.as_ref().is_some_and(|library| {
                !library
                    .matching_terms(&input.text, input.context.as_deref(), &target)
                    .is_empty()
            });
            if let Some(translation) = self
                .tm
                .as_mut()
                .and_then(|tm| tm.get_translation(&input.text, input.context.as_deref(), &target))
                .filter(|_| !has_phrase_rules)
            {
                self.batch_stats.tm_hits += 1;
                results[index] = Some(TranslationItem {
                    index,
                    translation,
                    source: TranslationSource::Tm,
                });
            } else {
                let key = (input.text.clone(), input.context.clone());
                if !groups.contains_key(&key) {
                    unique.push(input.clone());
                }
                groups.entry(key).or_default().push(index);
            }
        }
        self.batch_stats.deduplicated = groups.values().map(|indices| indices.len() - 1).sum();
        for chunk in unique.chunks(25) {
            let prompt =
                prompt_builder::build_inputs_prompt(chunk, &target, self.term_library.as_ref());
            let response = self.request(prompt, "批量翻译").await?;
            let translations = parse_translations(&response, chunk.len())?;
            self.validate_phrase_rules(chunk, &translations, &target)?;
            self.batch_stats.ai_translated += translations.len();
            for (input, translation) in chunk.iter().zip(translations) {
                let key = (input.text.clone(), input.context.clone());
                if let Some(indices) = groups.get(&key) {
                    for (position, &index) in indices.iter().enumerate() {
                        results[index] = Some(TranslationItem {
                            index,
                            translation: translation.clone(),
                            source: if position == 0 {
                                TranslationSource::Ai
                            } else {
                                TranslationSource::Dedup
                            },
                        });
                    }
                }
            }
        }
        results
            .into_iter()
            .collect::<Option<Vec<_>>>()
            .ok_or_else(|| AppError::translation("翻译结果不完整", false))
    }

    /// Connection tests deliberately bypass TM.
    pub async fn translate_with_ai(&mut self, texts: Vec<String>) -> Result<Vec<String>, AppError> {
        let target = self
            .target_language
            .as_deref()
            .filter(|lang| !lang.is_empty())
            .ok_or_else(|| AppError::validation("翻译必须指定目标语言"))?;
        let inputs: Vec<_> = texts
            .into_iter()
            .map(|text| TranslationInput {
                text,
                context: None,
            })
            .collect();
        let prompt = prompt_builder::build_inputs_prompt(&inputs, target, None);
        let response = self.request(prompt, "翻译请求").await?;
        parse_translations(&response, inputs.len())
    }

    pub async fn translate_with_custom_user_prompt(
        &mut self,
        user_prompt: String,
    ) -> Result<String, AppError> {
        self.request(user_prompt, "自定义请求").await
    }

    pub async fn translate_with_context_prompt(
        &mut self,
        input: TranslationInput,
        user_prompt: String,
    ) -> Result<String, AppError> {
        let target = self
            .target_language
            .as_deref()
            .filter(|language| !language.is_empty())
            .ok_or_else(|| AppError::validation("翻译必须指定目标语言"))?
            .to_string();
        let prompt = prompt_builder::build_refinement_prompt(
            &input,
            &target,
            &user_prompt,
            self.term_library.as_ref(),
        );
        let translation = self.request(prompt, "上下文精翻").await?;
        self.validate_phrase_rules(
            std::slice::from_ref(&input),
            std::slice::from_ref(&translation),
            &target,
        )?;
        Ok(translation)
    }

    /// No spawned request tasks: dropping this future cancels send, body reads and retry sleeps.
    async fn request(&mut self, user_prompt: String, log_type: &str) -> Result<String, AppError> {
        #[cfg(test)]
        let timeout = match self.test_timeout {
            Some(timeout) => timeout,
            None => ConfigDraft::global().await.data().timeout_seconds,
        };
        #[cfg(not(test))]
        let timeout = ConfigDraft::global().await.data().timeout_seconds;
        if timeout == 0 {
            return Err(AppError::config("请求超时必须大于 0 秒"));
        }
        let mut messages = vec![ChatMessage {
            role: "system".into(),
            content: self.system_prompt.clone(),
        }];
        messages.push(ChatMessage {
            role: "user".into(),
            content: user_prompt.clone(),
        });
        let request = ChatRequest {
            model: self.model.clone(),
            messages,
            temperature: 1.0,
        };
        let id = crate::services::log_prompt(
            log_type,
            serde_json::to_string_pretty(&request)?,
            Some(serde_json::json!({"provider": self.provider_id, "model": self.model})),
        );
        let outcome = self
            .send_request(&request, Duration::from_secs(timeout))
            .await;
        match outcome {
            Ok(response) => {
                // A provider can charge for an empty final answer (for example, exhausted reasoning).
                // Account for its usage before validating the translated content.
                if let Some(usage) = response.usage {
                    self.record_usage(usage)?;
                } else {
                    self.token_stats.unpriced_requests += 1;
                }
                let content = if response.content.trim().is_empty() {
                    Err(AppError::translation("AI响应为空", false))
                } else {
                    Ok(response.content.clone())
                };
                match content {
                    Ok(content) => {
                        crate::services::update_prompt_response(&id, content.clone());
                        Ok(content)
                    }
                    Err(error) => {
                        crate::services::update_prompt_response(&id, error.to_string());
                        Err(error)
                    }
                }
            }
            Err(error) => {
                crate::services::update_prompt_response(&id, error.to_string());
                Err(error)
            }
        }
    }

    async fn send_request(
        &self,
        request: &ChatRequest,
        timeout: Duration,
    ) -> Result<ChatResponse, AppError> {
        for attempt in 0..3 {
            let outcome = async {
                let (url, mut body) = match self.api {
                    ModelApi::OpenaiCompletions => {
                        let mut body = serde_json::to_value(request)?;
                        if let Some(limit) = self.max_tokens { body["max_tokens"] = limit.into(); }
                        (format!("{}/chat/completions", self.base_url), body)
                    },
                    ModelApi::OpenaiResponses => (
                        format!("{}/responses", self.base_url),
                        serde_json::json!({
                            "model": self.model,
                            "instructions": request.messages.iter().find(|m| m.role == "system").map(|m| m.content.clone()).unwrap_or_default(),
                            "input": request.messages.iter().filter(|m| m.role != "system").collect::<Vec<_>>(),
                            "max_output_tokens": self.max_tokens,
                        }),
                    ),
                    ModelApi::AnthropicMessages => (
                        format!("{}/messages", self.base_url),
                        serde_json::json!({
                            "model": self.model,
                            "system": request.messages.iter().find(|m| m.role == "system").map(|m| m.content.clone()).unwrap_or_default(),
                            "messages": request.messages.iter().filter(|m| m.role != "system").collect::<Vec<_>>(),
                            "max_tokens": self.max_tokens.unwrap_or(4096),
                        }),
                    ),
                };
                if self.api == ModelApi::OpenaiResponses && self.max_tokens.is_none() {
                    if let Some(object) = body.as_object_mut() { object.remove("max_output_tokens"); }
                }
                let mut builder = self.client.post(url).timeout(timeout);
                builder = match self.api {
                    ModelApi::AnthropicMessages => builder.bearer_auth(&self.api_key).header("x-api-key", &self.api_key).header("anthropic-version", "2023-06-01"),
                    _ if !self.api_key.is_empty() => builder.bearer_auth(&self.api_key),
                    _ => builder,
                };
                let response = builder.json(&body).send().await?;
                let status = response.status();
                let body = response.text().await?;
                if !status.is_success() {
                    return Err(AppError::translation(
                        format!("API请求失败({}): {}", status.as_u16(), preview(&body, 500)),
                        status.as_u16() == 429 || status.is_server_error(),
                    ));
                }
                parse_api_response(self.api, &body).map_err(|error| {
                    AppError::parse(format!("无法解析AI响应: {error}; {}", preview(&body, 500)))
                })
            }
            .await;
            match outcome {
                Err(error) if error.is_retryable() && attempt < 2 => {
                    tokio::time::sleep(Duration::from_secs(1 << attempt)).await
                }
                result => return result,
            }
        }
        Err(AppError::translation("翻译请求重试耗尽", false))
    }

    fn record_usage(&mut self, usage: Usage) -> Result<(), AppError> {
        self.token_stats
            .update(usage.input_tokens, usage.output_tokens, usage.total_tokens);
        use crate::services::ai::{CostCalculator, provider::with_global_registry};
        if let Some(model) = with_global_registry(|registry| {
            self.catalog_provider_id
                .as_deref()
                .and_then(|provider_id| registry.get_provider(provider_id))
                .and_then(|provider| provider.get_model_info(&self.model))
        }) {
            self.token_stats.cost += CostCalculator::calculate_openai(
                &model,
                usage.input_tokens as usize,
                usage.output_tokens as usize,
                0,
                0,
            )
            .total_cost;
        } else {
            self.token_stats.unpriced_requests += 1;
        }
        Ok(())
    }

    pub fn get_token_stats(&self) -> &TokenStats {
        &self.token_stats
    }
    pub fn get_translation_memory(&self) -> Option<&TranslationMemory> {
        self.tm.as_ref()
    }
    fn validate_phrase_rules(
        &self,
        inputs: &[TranslationInput],
        translations: &[String],
        target: &str,
    ) -> Result<(), AppError> {
        if let Some(library) = &self.term_library {
            for (input, translation) in inputs.iter().zip(translations) {
                for rule in library.matching_terms(&input.text, input.context.as_deref(), target) {
                    let obeys_rule = if rule.source == input.text {
                        *translation == rule.user_translation
                    } else {
                        translation.contains(&rule.user_translation)
                    };
                    if !obeys_rule {
                        return Err(AppError::translation(
                            format!("AI译文未遵守术语规则: {}", rule.source),
                            false,
                        ));
                    }
                }
            }
        }
        Ok(())
    }
    #[cfg(test)]
    pub(crate) fn set_test_term_library(&mut self, library: TermLibrary) {
        self.term_library = Some(library);
    }
    #[cfg(test)]
    pub(crate) fn for_test(
        base_url: String,
        target: Option<&str>,
        tm: Option<TranslationMemory>,
    ) -> Self {
        Self {
            client: Client::builder().no_proxy().build().unwrap_or_default(),
            api_key: "local-test".into(),
            base_url,
            model: "local-test".into(),
            provider_id: "local-test".into(),
            catalog_provider_id: Some("local-test".into()),
            api: ModelApi::OpenaiCompletions,
            max_tokens: None,
            system_prompt: DEFAULT_SYSTEM_PROMPT.into(),
            token_stats: TokenStats::default(),
            tm,
            term_library: None,
            target_language: target.map(canonical_target_language),
            batch_stats: BatchStats::default(),
            test_timeout: Some(30),
        }
    }
}

pub(crate) fn preview(text: &str, limit: usize) -> String {
    let mut chars = text.chars();
    let prefix: String = chars.by_ref().take(limit).collect();
    if chars.next().is_some() {
        format!("{prefix}…")
    } else {
        prefix
    }
}

fn parse_api_response(api: ModelApi, body: &str) -> Result<ChatResponse, AppError> {
    let value: serde_json::Value = serde_json::from_str(body)
        .map_err(|error| AppError::parse(format!("无法解析AI响应: {error}")))?;
    let content = match api {
        ModelApi::OpenaiCompletions => value["choices"][0]["message"]["content"]
            .as_str()
            .unwrap_or_default()
            .to_string(),
        ModelApi::OpenaiResponses => value["output"]
            .as_array()
            .into_iter()
            .flatten()
            .filter(|item| item["type"].as_str() == Some("message"))
            .flat_map(|item| item["content"].as_array().into_iter().flatten())
            .filter(|item| item["type"].as_str() == Some("output_text"))
            .filter_map(|item| item["text"].as_str())
            .collect::<Vec<_>>()
            .join(""),
        ModelApi::AnthropicMessages => value["content"]
            .as_array()
            .into_iter()
            .flatten()
            .filter(|item| item["type"].as_str() == Some("text"))
            .filter_map(|item| item["text"].as_str())
            .collect::<Vec<_>>()
            .join(""),
    };
    let usage = value.get("usage").and_then(|usage| {
        let input = usage["input_tokens"]
            .as_u64()
            .or_else(|| usage["prompt_tokens"].as_u64())? as u32;
        let output = usage["output_tokens"]
            .as_u64()
            .or_else(|| usage["completion_tokens"].as_u64())? as u32;
        Some(Usage {
            input_tokens: input,
            output_tokens: output,
            total_tokens: usage["total_tokens"]
                .as_u64()
                .unwrap_or((input + output) as u64) as u32,
        })
    });
    Ok(ChatResponse { content, usage })
}

pub(crate) fn parse_translations(response: &str, expected: usize) -> Result<Vec<String>, AppError> {
    let response = response.trim();
    let json = if let Some(fenced) = response.strip_prefix("```") {
        let (label, body) = fenced
            .split_once('\n')
            .ok_or_else(|| AppError::parse("AI响应的JSON代码块无效"))?;
        if !matches!(label.trim(), "" | "json") {
            return Err(AppError::parse("AI响应必须为JSON代码块"));
        }
        body.strip_suffix("```")
            .map(str::trim)
            .ok_or_else(|| AppError::parse("AI响应的JSON代码块未闭合"))?
    } else {
        response
    };
    let translations: Vec<String> = serde_json::from_str(json)
        .map_err(|error| AppError::parse(format!("AI响应必须为JSON字符串数组: {error}")))?;
    if translations.len() != expected {
        return Err(AppError::parse(format!(
            "翻译数量不匹配: 请求 {expected} 条，返回 {} 条",
            translations.len()
        )));
    }
    if translations.iter().any(|text| text.trim().is_empty()) {
        return Err(AppError::parse("AI响应包含空翻译"));
    }
    Ok(translations)
}

#[cfg(test)]
#[allow(clippy::unwrap_used)]
mod protocol_tests {
    use super::*;
    use std::io::{Read, Write};
    use std::net::TcpListener;
    use std::thread;

    fn mock(response: &'static str) -> (String, thread::JoinHandle<String>) {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let address = format!("http://{}", listener.local_addr().unwrap());
        let handle = thread::spawn(move || {
            let (mut stream, _) = listener.accept().unwrap();
            stream
                .set_read_timeout(Some(Duration::from_secs(5)))
                .unwrap();
            let mut bytes = Vec::new();
            loop {
                let mut chunk = [0; 4096];
                let count = stream.read(&mut chunk).unwrap();
                assert!(count > 0);
                bytes.extend_from_slice(&chunk[..count]);
                if let Some(end) = bytes.windows(4).position(|part| part == b"\r\n\r\n") {
                    let headers = String::from_utf8_lossy(&bytes[..end]).to_lowercase();
                    let length: usize = headers
                        .lines()
                        .find_map(|line| line.strip_prefix("content-length:"))
                        .unwrap()
                        .trim()
                        .parse()
                        .unwrap();
                    if bytes.len() >= end + 4 + length {
                        break;
                    }
                }
            }
            let request = String::from_utf8(bytes).unwrap();
            let reply = format!(
                "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\n\r\n{}",
                response.len(),
                response
            );
            stream.write_all(reply.as_bytes()).unwrap();
            request
        });
        (address, handle)
    }

    #[tokio::test]
    async fn builtin_catalog_protocols_reach_request_path_once() {
        use crate::services::ai::plugin_config::PluginConfig;
        let plugins = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../plugins");
        for id in [
            "openai",
            "deepseek",
            "moonshot",
            "zhipu",
            "gemini-ai",
            "minimax",
        ] {
            let config = PluginConfig::from_file(plugins.join(id).join("plugin.toml")).unwrap();
            let url = reqwest::Url::parse(&config.provider.default_url).unwrap();
            let (suffix, response) = if config.provider.api == ModelApi::AnthropicMessages {
                (
                    "/messages",
                    r#"{"content":[{"type":"thinking","thinking":"private reasoning"},{"type":"text","text":"[\"完成\"]"}]}"#,
                )
            } else {
                (
                    "/chat/completions",
                    r#"{"choices":[{"message":{"content":"[\"完成\"]"}}]}"#,
                )
            };
            let (origin, server) = mock(response);
            let base = format!("{}{}", origin, url.path().trim_end_matches('/'));
            let mut translator = AITranslator::for_test(base, Some("zh-CN"), None);
            translator.api = config.provider.api;
            translator.model = config.provider.default_model;
            let result = translator
                .translate_with_ai(vec!["Complete".into()])
                .await
                .unwrap();
            assert_eq!(result, ["完成"]);
            let request = server.join().unwrap();
            let expected_path = format!("{}{suffix}", url.path().trim_end_matches('/'));
            assert!(
                request.starts_with(&format!("POST {expected_path} HTTP/1.1")),
                "{id}: {}",
                request.lines().next().unwrap()
            );
            assert_eq!(expected_path.matches(suffix).count(), 1);
            if id == "minimax" {
                assert_eq!(expected_path, "/anthropic/v1/messages");
                assert!(request.contains("anthropic-version:"));
            }
        }
    }

    #[tokio::test]
    async fn protocol_requests_and_usage_are_normalized() {
        let cases = [
            (
                ModelApi::OpenaiCompletions,
                "/chat/completions",
                r#"{"choices":[{"message":{"content":"[\"完成\"]"}}],"usage":{"prompt_tokens":2,"completion_tokens":3,"total_tokens":5}}"#,
            ),
            (
                ModelApi::OpenaiResponses,
                "/responses",
                r#"{"output":[{"type":"message","content":[{"type":"output_text","text":"[\"响应\"]"}]}],"usage":{"input_tokens":4,"output_tokens":5}}"#,
            ),
            (
                ModelApi::AnthropicMessages,
                "/messages",
                r#"{"content":[{"type":"text","text":"[\"消息\"]"}],"usage":{"input_tokens":6,"output_tokens":7}}"#,
            ),
        ];
        for (api, path, response) in cases {
            let (base, server) = mock(response);
            let mut translator = AITranslator::for_test(base, Some("zh-CN"), None);
            translator.api = api;
            translator.model = "unknown-custom-model".into();
            translator.max_tokens = Some(123);
            translator.api_key = "test-key".into();
            let output = translator
                .translate_with_ai(vec!["source".into()])
                .await
                .unwrap();
            let expected = match api {
                ModelApi::OpenaiCompletions => "完成",
                ModelApi::OpenaiResponses => "响应",
                ModelApi::AnthropicMessages => "消息",
            };
            assert_eq!(output, vec![expected.to_string()]);
            let stats = translator.get_token_stats();
            let expected_tokens = match api {
                ModelApi::OpenaiCompletions => (2, 3),
                ModelApi::OpenaiResponses => (4, 5),
                ModelApi::AnthropicMessages => (6, 7),
            };
            assert_eq!(stats.input_tokens, expected_tokens.0);
            assert_eq!(stats.output_tokens, expected_tokens.1);
            assert_eq!(stats.total_tokens, expected_tokens.0 + expected_tokens.1);
            assert_eq!(stats.cost, 0.0);
            assert_eq!(stats.unpriced_requests, 1);
            let request = server.join().unwrap();
            assert!(request.starts_with(&format!("POST {path} HTTP/1.1")));
            assert!(request.contains("unknown-custom-model"));
            assert!(request.contains("source"));
            match api {
                ModelApi::AnthropicMessages => assert!(
                    request.contains("x-api-key: test-key")
                        && request.contains("authorization: Bearer test-key")
                        && request.contains("anthropic-version: 2023-06-01")
                        && request.contains("\"max_tokens\":123")
                ),
                ModelApi::OpenaiResponses => assert!(
                    request.contains("\"instructions\"")
                        && request.contains("\"input\"")
                        && request.contains("\"max_output_tokens\":123")
                ),
                _ => assert!(
                    request.contains("authorization: Bearer test-key")
                        && request.contains("\"max_tokens\":123")
                ),
            }
        }
    }

    #[test]
    fn empty_protocol_text_is_rejected_by_response_validation() {
        let empty = parse_api_response(
            ModelApi::AnthropicMessages,
            r#"{"content":[{"type":"image","source":{}}]}"#,
        )
        .unwrap();
        assert!(empty.content.is_empty());
    }
}
