use anyhow::{anyhow, Result};
use reqwest::Client as HttpClient;
use serde::{Deserialize, Serialize};
// use std::collections::HashMap;

use crate::services::translation_memory::TranslationMemory;
use crate::services::term_library::TermLibrary;
use crate::utils::common::is_simple_phrase;
use crate::utils::paths::get_translation_memory_path;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenStats {
    pub input_tokens: u32,
    pub output_tokens: u32,
    pub total_tokens: u32,
    pub cost: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ChatMessage {
    role: String,
    content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ChatRequest {
    model: String,
    messages: Vec<ChatMessage>,
    temperature: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ChatResponse {
    choices: Vec<Choice>,
    usage: Option<Usage>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct Choice {
    message: ChatMessage,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct Usage {
    prompt_tokens: u32,
    completion_tokens: u32,
    total_tokens: u32,
}

#[derive(Debug, Clone)]
pub struct AITranslator {
    client: HttpClient,
    api_key: String,
    base_url: String,
    model: String,
    system_prompt: String,
    conversation_history: Vec<ChatMessage>,
    max_history_tokens: usize,
    token_stats: TokenStats,
    use_tm: bool,
    tm: Option<TranslationMemory>,
    // 统计信息
    pub batch_stats: BatchStats,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchStats {
    pub total: usize,
    pub tm_hits: usize,
    pub deduplicated: usize,
    pub ai_translated: usize,
    pub tm_learned: usize,
}

impl AITranslator {
    pub fn new(api_key: String, base_url: Option<String>, use_tm: bool) -> Result<Self> {
        let client = HttpClient::new();
        let base_url = base_url.unwrap_or_else(|| "https://api.moonshot.cn/v1".to_string());
        
        // 加载术语库并构建系统提示词
        let term_library_path = std::env::current_exe()
            .ok()
            .and_then(|p| p.parent().map(|p| p.to_path_buf()))
            .unwrap_or_else(|| std::path::PathBuf::from("."))
            .join("data")
            .join("term_library.json");
        
        let term_library = TermLibrary::load_from_file(&term_library_path).ok();
        let system_prompt = Self::get_system_prompt(term_library.as_ref());

        // 从文件加载TM（合并内置短语和已保存的翻译）
        let tm = if use_tm {
            Some(TranslationMemory::new_from_file(
                &get_translation_memory_path(),
            )?)
        } else {
            None
        };

        Ok(Self {
            client,
            api_key,
            base_url,
            model: "moonshot-v1-auto".to_string(),
            system_prompt,
            conversation_history: Vec::new(),
            max_history_tokens: 2000,
            token_stats: TokenStats {
                input_tokens: 0,
                output_tokens: 0,
                total_tokens: 0,
                cost: 0.0,
            },
            use_tm,
            tm,
            batch_stats: BatchStats {
                total: 0,
                tm_hits: 0,
                deduplicated: 0,
                ai_translated: 0,
                tm_learned: 0,
            },
        })
    }

    fn get_system_prompt(term_library: Option<&TermLibrary>) -> String {
        let base_prompt = r#"你是一位专业的游戏开发和Unreal Engine本地化专家，精通中英文翻译。

【翻译规则】
1. 术语保留英文: Actor/Blueprint/Component/Transform/Mesh/Material/Widget/Collision/Array/Float/Integer
2. 固定翻译: Asset→资产, Unique→去重, Slice→截取, Primitives→基础类型, Constant Speed→匀速, Stream→流送, Ascending→升序, Descending→降序
3. Category翻译: 保持XTools等命名空间和|符号, 如 XTools|Sort|Actor → XTools|排序|Actor
4. 格式保留: 必须保持|、{}、%%、[]、()、\n、\t、{0}、{1}等所有特殊符号和占位符
5. 翻译风格: 准确(信)、流畅(达)、专业(雅), 无多余空格
6. 特殊表达: in-place→原地, by value→按值, True→为True, False→为False"#;

        // 如果有术语库的风格总结，注入到提示词中
        if let Some(library) = term_library {
            if let Some(style_summary) = &library.style_summary {
                return format!(
                    "{}\n\n【用户翻译风格偏好】（基于{}条术语学习）\n{}\n\n请参考以上风格指南进行翻译，保持一致性。",
                    base_prompt,
                    style_summary.based_on_terms,
                    style_summary.prompt
                );
            }
        }

        format!("{}\n\n请保持翻译风格一致，参考之前的翻译术语。", base_prompt)
    }

    pub async fn translate_batch_with_callbacks(
        &mut self,
        texts: Vec<String>,
        progress_callback: Option<Box<dyn Fn(usize, String) + Send + Sync>>,
        stats_callback: Option<Box<dyn Fn(BatchStats, TokenStats) + Send + Sync>>,
    ) -> Result<Vec<String>> {
        self.translate_batch_internal(texts, progress_callback, Some(stats_callback)).await
    }

    pub async fn translate_batch(
        &mut self,
        texts: Vec<String>,
        progress_callback: Option<Box<dyn Fn(usize, String) + Send + Sync>>,
    ) -> Result<Vec<String>> {
        self.translate_batch_internal(texts, progress_callback, None).await
    }

    async fn translate_batch_internal(
        &mut self,
        texts: Vec<String>,
        progress_callback: Option<Box<dyn Fn(usize, String) + Send + Sync>>,
        stats_callback: Option<Option<Box<dyn Fn(BatchStats, TokenStats) + Send + Sync>>>,
    ) -> Result<Vec<String>> {
        if texts.is_empty() {
            return Ok(Vec::new());
        }

        // 🔍 调试：检查回调是否传入（风格总结等内部调用时为None是正常的）
        if progress_callback.is_some() {
            crate::app_log!("[translate_batch] ✅ progress_callback 已传入");
        } else {
            crate::app_log!("[translate_batch] ℹ️ progress_callback 为 None（内部调用）");
        }

        // 重置统计
        self.batch_stats.total = texts.len();
        self.batch_stats.tm_hits = 0;
        self.batch_stats.deduplicated = 0;
        self.batch_stats.ai_translated = 0;
        self.batch_stats.tm_learned = 0;

        // Step 1: 使用翻译记忆库进行预翻译 + 去重（保持顺序）
        let mut result = vec![String::new(); texts.len()];
        let mut untranslated_indices = Vec::new();
        
        // 🔧 使用Vec保持去重文本的顺序，而不是HashMap
        let mut unique_texts_ordered: Vec<String> = Vec::new();
        let mut unique_text_to_indices: std::collections::HashMap<String, Vec<usize>> =
            std::collections::HashMap::new();

        if let Some(ref mut tm) = self.tm {
            for (i, text) in texts.iter().enumerate() {
                if let Some(translation) = tm.get_translation(text) {
                    // TM命中
                    result[i] = translation.clone();
                    self.batch_stats.tm_hits += 1;
                    
                    // 🔔 实时推送TM命中结果
                    if let Some(ref callback) = progress_callback {
                        callback(i, translation);
                    }
                } else {
                    // TM未命中，记录到去重map
                    untranslated_indices.push(i);
                    
                    // 如果是首次出现，加入ordered列表
                    if !unique_text_to_indices.contains_key(text) {
                        unique_texts_ordered.push(text.clone());
                    }
                    unique_text_to_indices
                        .entry(text.clone())
                        .or_insert_with(Vec::new)
                        .push(i);
                }
            }
        } else {
            // 没有TM，直接去重
            for (i, text) in texts.iter().enumerate() {
                untranslated_indices.push(i);
                
                // 如果是首次出现，加入ordered列表
                if !unique_text_to_indices.contains_key(text) {
                    unique_texts_ordered.push(text.clone());
                }
                unique_text_to_indices
                    .entry(text.clone())
                    .or_insert_with(Vec::new)
                    .push(i);
            }
        }

        // 计算去重节省的次数：待翻译总数 - unique数量
        let untranslated_count = texts.len() - self.batch_stats.tm_hits;
        let unique_count = unique_texts_ordered.len();
        self.batch_stats.deduplicated = untranslated_count - unique_count;

        // 📊 TM处理完成后推送第一次统计更新
        if let Some(ref stats_cb_opt) = stats_callback {
            if let Some(ref stats_cb) = stats_cb_opt {
                let current_stats = self.batch_stats.clone();
                let current_token_stats = self.token_stats.clone();
                stats_cb(current_stats, current_token_stats);
            }
        }

        // Step 2: 分批翻译去重后的文本
        if !unique_texts_ordered.is_empty() {
            let unique_list = unique_texts_ordered.clone();
            crate::app_log!(
                "[预处理] 原始{}条 -> TM命中{}条 -> 待翻译{}条 -> 去重节省{}条",
                texts.len(),
                self.batch_stats.tm_hits,
                untranslated_count,
                self.batch_stats.deduplicated
            );

            // 🚀 分批翻译（每批最多25条，避免AI响应截断）
            const BATCH_SIZE: usize = 25;
            let mut ai_translations = Vec::new();
            let total_batches = (unique_list.len() + BATCH_SIZE - 1) / BATCH_SIZE;

            for (batch_idx, chunk) in unique_list.chunks(BATCH_SIZE).enumerate() {
                crate::app_log!(
                    "[分批翻译] 批次 {}/{}, 当前批{}条",
                    batch_idx + 1,
                    total_batches,
                    chunk.len()
                );
                
                let batch_translations = self.translate_with_ai(chunk.to_vec()).await?;
                ai_translations.extend(batch_translations);
                
                // 📊 每个批次完成后推送统计更新
                if let Some(ref stats_cb_opt) = stats_callback {
                    if let Some(ref stats_cb) = stats_cb_opt {
                        let current_stats = self.batch_stats.clone();
                        let current_token_stats = self.token_stats.clone();
                        stats_cb(current_stats, current_token_stats);
                    }
                }
            }
            
            self.batch_stats.ai_translated = unique_list.len();

            // Step 3: 将翻译结果分发到所有对应的索引
            for (unique_text, translation) in unique_list.iter().zip(ai_translations.iter()) {
                if let Some(indices) = unique_text_to_indices.get(unique_text) {
                    for &idx in indices {
                        result[idx] = translation.clone();

                        // 调用进度回调
                        if let Some(ref callback) = progress_callback {
                            callback(idx, translation.clone());
                        }
                    }
                }

                // Step 4: 更新翻译记忆库（每个unique文本只学习一次）
                if let Some(ref mut tm) = self.tm {
                    if is_simple_phrase(unique_text) && translation.len() <= 50 {
                        // 检查是否已存在于learned或builtin中
                        let builtin = crate::services::translation_memory::get_builtin_memory();
                        let exists_in_learned = tm.memory.contains_key(unique_text);
                        let exists_in_builtin = builtin.contains_key(unique_text);

                        if !exists_in_learned && !exists_in_builtin {
                            // 既不在learned也不在builtin中，才学习
                            tm.add_translation(unique_text.clone(), translation.clone());
                            self.batch_stats.tm_learned += 1;
                            crate::app_log!("[TM学习] {} -> {}", unique_text, translation);
                        } else if exists_in_builtin {
                            crate::app_log!("[TM跳过] {} (已在内置词库)", unique_text);
                        } else {
                            crate::app_log!("[TM跳过] {} (已在学习记录)", unique_text);
                        }
                    }
                }
            }
        }

        crate::app_log!(
            "[统计] 总{}条 | TM命中{}条 | 去重节省{}条 | AI翻译{}条 | 学习{}条",
            self.batch_stats.total,
            self.batch_stats.tm_hits,
            self.batch_stats.deduplicated,
            self.batch_stats.ai_translated,
            self.batch_stats.tm_learned
        );

        // 📊 最终统计更新（包含TM学习数量）
        if let Some(ref stats_cb_opt) = stats_callback {
            if let Some(ref stats_cb) = stats_cb_opt {
                let final_stats = self.batch_stats.clone();
                let final_token_stats = self.token_stats.clone();
                stats_cb(final_stats, final_token_stats);
            }
        }

        Ok(result)
    }

    async fn translate_with_ai(&mut self, texts: Vec<String>) -> Result<Vec<String>> {
        let user_prompt = self.build_user_prompt(&texts);

        // 构建消息数组
        let messages = if self.conversation_history.is_empty() {
            vec![
                ChatMessage {
                    role: "system".to_string(),
                    content: self.system_prompt.clone(),
                },
                ChatMessage {
                    role: "user".to_string(),
                    content: user_prompt.clone(),
                },
            ]
        } else {
            let mut msgs = self.conversation_history.clone();
            msgs.push(ChatMessage {
                role: "user".to_string(),
                content: user_prompt.clone(),
            });
            msgs
        };

        // 发送请求（带重试机制）
        let request = ChatRequest {
            model: self.model.clone(),
            messages,
            temperature: 0.3,
        };

        // 最多重试3次，指数退避策略
        let max_retries = 3;
        let mut chat_response: Option<ChatResponse> = None;
        let mut last_error: Option<anyhow::Error> = None;

        for retry in 0..max_retries {
            match self
                .client
                .post(&format!("{}/chat/completions", self.base_url))
                .header("Authorization", format!("Bearer {}", self.api_key))
                .header("Content-Type", "application/json")
                .json(&request)
                .send()
                .await
            {
                Ok(response) => {
                    match response.json().await {
                        Ok(parsed) => {
                            chat_response = Some(parsed);
                            break;
                        }
                        Err(e) => {
                            last_error = Some(e.into());
                            if retry < max_retries - 1 {
                                let delay_secs = 2_u64.pow(retry as u32); // 1s, 2s, 4s
                                crate::app_log!(
                                    "[重试] 解析响应失败，{}秒后重试 ({}/{})",
                                    delay_secs,
                                    retry + 1,
                                    max_retries
                                );
                                tokio::time::sleep(tokio::time::Duration::from_secs(delay_secs))
                                    .await;
                            }
                        }
                    }
                }
                Err(e) => {
                    last_error = Some(e.into());
                    if retry < max_retries - 1 {
                        let delay_secs = 2_u64.pow(retry as u32); // 1s, 2s, 4s
                        crate::app_log!(
                            "[重试] 网络请求失败，{}秒后重试 ({}/{})",
                            delay_secs,
                            retry + 1,
                            max_retries
                        );
                        tokio::time::sleep(tokio::time::Duration::from_secs(delay_secs)).await;
                    }
                }
            }
        }

        let chat_response = chat_response.ok_or_else(|| {
            last_error.unwrap_or_else(|| anyhow!("翻译请求失败，已重试{}次", max_retries))
        })?;

        // 更新token统计
        if let Some(usage) = chat_response.usage {
            self.token_stats.input_tokens += usage.prompt_tokens;
            self.token_stats.output_tokens += usage.completion_tokens;
            self.token_stats.total_tokens += usage.total_tokens;
            // Moonshot定价：¥0.012/1K tokens
            let batch_cost = usage.total_tokens as f64 / 1000.0 * 0.012;
            self.token_stats.cost += batch_cost;
        }

        let assistant_response = chat_response
            .choices
            .first()
            .map(|choice| &choice.message.content)
            .ok_or_else(|| anyhow!("No response content"))?;

        // 更新对话历史
        self.update_conversation_history(&user_prompt, assistant_response);

        // 解析翻译结果
        let translations = self.parse_translations(assistant_response, &texts)?;

        Ok(translations)
    }

    fn build_user_prompt(&self, texts: &[String]) -> String {
        let mut prompt = "请严格按以下格式翻译，每行一个结果，不要添加任何解释或额外文字：\n\n".to_string();
        for (i, text) in texts.iter().enumerate() {
            prompt.push_str(&format!("{}. {}\n", i + 1, text));
        }
        prompt.push_str("\n注意：只返回翻译结果，每条前面加序号，不要有其他内容。");
        prompt
    }

    fn update_conversation_history(&mut self, user_prompt: &str, assistant_response: &str) {
        if self.conversation_history.is_empty() {
            self.conversation_history.push(ChatMessage {
                role: "system".to_string(),
                content: self.system_prompt.clone(),
            });
        }

        self.conversation_history.push(ChatMessage {
            role: "user".to_string(),
            content: user_prompt.to_string(),
        });

        self.conversation_history.push(ChatMessage {
            role: "assistant".to_string(),
            content: assistant_response.to_string(),
        });

        // 防止历史过长：保留最近10轮对话
        if self.conversation_history.len() > 21 {
            let system_msg = self.conversation_history[0].clone();
            let recent_msgs: Vec<_> = self
                .conversation_history
                .iter()
                .rev()
                .take(20)
                .cloned()
                .collect();
            self.conversation_history = vec![system_msg];
            self.conversation_history
                .extend(recent_msgs.into_iter().rev());
        }
    }

    fn parse_translations(&self, response: &str, original_texts: &[String]) -> Result<Vec<String>> {
        let lines: Vec<&str> = response
            .lines()
            .map(|line| line.trim())
            .filter(|line| !line.is_empty())
            .collect();

        // 优先提取以数字序号开头的行（支持多种格式）
        let number_prefix_regex = regex::Regex::new(r"^\d+[\.\)、:\s]+(.+)$").unwrap();
        let mut translations = Vec::new();
        
        for line in lines.iter() {
            if let Some(captures) = number_prefix_regex.captures(line) {
                if let Some(content) = captures.get(1) {
                    let translation = content.as_str().trim().to_string();
                    translations.push(translation);
                }
            }
        }

        // 如果没有找到序号格式，降级为所有非空行（向后兼容）
        if translations.is_empty() {
            for line in lines {
                translations.push(line.to_string());
            }
        }

        // ⚠️ 验证翻译数量（只在出错时输出详细日志）
        if translations.len() != original_texts.len() {
            crate::app_log!(
                "[解析错误] 期望{}条，实际{}条\n[AI响应]\n{}", 
                original_texts.len(), 
                translations.len(),
                response
            );
            
            return Err(anyhow!(
                "翻译数量不匹配！请求 {} 条，实际返回 {} 条",
                original_texts.len(),
                translations.len()
            ));
        }

        // 验证特殊字符保留
        for (i, translation) in translations.iter_mut().enumerate() {
            let original = &original_texts[i];

            // 检查换行符
            if original.contains("\\n") && !translation.contains("\\n") {
                if original.ends_with("\\n") && !translation.ends_with("\\n") {
                    translation.push_str("\\n");
                }
            }

            // 检查占位符数量
            let original_placeholders = self.count_placeholders(original);
            let translation_placeholders = self.count_placeholders(translation);
            if original_placeholders != translation_placeholders {
                crate::app_log!(
                    "[占位符警告] '{}' 占位符数量不匹配：原文{}个，译文{}个",
                    original,
                    original_placeholders,
                    translation_placeholders
                );
            }
        }

        Ok(translations)
    }

    fn count_placeholders(&self, text: &str) -> usize {
        let mut count = 0;
        let mut chars = text.chars().peekable();

        while let Some(ch) = chars.next() {
            if ch == '{' {
                if let Some(&next) = chars.peek() {
                    if next.is_ascii_digit() {
                        count += 1;
                    }
                }
            } else if ch == '%' {
                if let Some(&next) = chars.peek() {
                    if next == '%' {
                        count += 1;
                        chars.next(); // 跳过第二个%
                    }
                }
            }
        }

        count
    }
}

impl AITranslator {
    pub fn get_token_stats(&self) -> &TokenStats {
        &self.token_stats
    }

    pub fn reset_stats(&mut self) {
        self.token_stats = TokenStats {
            input_tokens: 0,
            output_tokens: 0,
            total_tokens: 0,
            cost: 0.0,
        };
    }

    pub fn clear_conversation_history(&mut self) {
        self.conversation_history.clear();
    }

    pub fn get_translation_memory(&self) -> Option<&TranslationMemory> {
        self.tm.as_ref()
    }

    pub fn get_translation_memory_mut(&mut self) -> Option<&mut TranslationMemory> {
        self.tm.as_mut()
    }
}
