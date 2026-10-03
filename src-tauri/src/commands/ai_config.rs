//! Provider profiles and their write-only credentials.
use crate::services::model_config::{
    ModelApi, ModelConfiguration, ModelDefinition, ModelProviderProfile, ModelProviderSummary,
    ModelSelection,
};
use crate::{
    error::AppError,
    services::{AITranslator, ConfigDraft},
};
use serde::{Deserialize, Serialize};
use std::{
    collections::HashSet,
    time::{Duration, Instant},
};
#[cfg(feature = "ts-rs")]
use ts_rs::TS;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveModelProviderRequest {
    pub profile: ModelProviderProfile,
    /// None preserves the existing credential; an empty string explicitly clears it.
    pub api_key: Option<String>,
    #[serde(default)]
    pub default_model_id: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TestModelProviderRequest {
    pub profile: ModelProviderProfile,
    pub api_key: Option<String>,
    pub model_id: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "ts-rs", derive(TS))]
#[cfg_attr(
    feature = "ts-rs",
    ts(export, export_to = "../../src/types/generated/")
)]
pub struct TestConnectionResult {
    pub success: bool,
    pub message: String,
    #[cfg_attr(feature = "ts-rs", ts(type = "number | null"))]
    pub response_time_ms: Option<u64>,
}

#[tauri::command]
pub async fn get_model_configuration() -> Result<ModelConfiguration, AppError> {
    let manager = ConfigDraft::global().await;
    manager.ensure_loaded()?;
    let config = manager.data();
    Ok(ModelConfiguration {
        providers: config
            .model_providers
            .iter()
            .map(|profile| ModelProviderSummary {
                profile: profile.clone(),
                has_api_key: !profile.api_key.is_empty(),
            })
            .collect(),
        default_model: config.default_model.clone(),
    })
}

fn save_profile(
    config: &mut crate::services::AppConfig,
    request: SaveModelProviderRequest,
) -> Result<(), AppError> {
    let mut profile = request.profile;
    let default_model_id = request.default_model_id;
    profile.validate()?;
    let provider_id = profile.id.clone();
    if let Some(model_id) = &default_model_id {
        if !profile.models.iter().any(|model| model.id == *model_id) {
            return Err(AppError::config("默认模型不属于当前供应商"));
        }
    }
    profile.api_key = request.api_key.unwrap_or_else(|| {
        config
            .model_providers
            .iter()
            .find(|existing| existing.id == profile.id)
            .map(|existing| existing.api_key.clone())
            .unwrap_or_default()
    });
    if let Some(index) = config
        .model_providers
        .iter()
        .position(|existing| existing.id == profile.id)
    {
        config.model_providers[index] = profile;
    } else {
        config.model_providers.push(profile);
    }
    if let Some(model_id) = default_model_id {
        config.default_model = Some(ModelSelection {
            provider_id,
            model_id,
        });
    }
    if let Some(selected) = &config.default_model {
        if !config.model_providers.iter().any(|provider| {
            provider.id == selected.provider_id
                && provider
                    .models
                    .iter()
                    .any(|model| model.id == selected.model_id)
        }) {
            config.default_model = None;
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn save_model_provider(request: SaveModelProviderRequest) -> Result<(), AppError> {
    ConfigDraft::global()
        .await
        .transaction(|config| save_profile(config, request))
}

#[tauri::command]
pub async fn remove_model_provider(provider_id: String) -> Result<(), AppError> {
    ConfigDraft::global().await.transaction(|config| {
        let position = config
            .model_providers
            .iter()
            .position(|profile| profile.id == provider_id)
            .ok_or_else(|| AppError::config("供应商不存在"))?;
        config.model_providers.remove(position);
        if config
            .default_model
            .as_ref()
            .is_some_and(|selected| selected.provider_id == provider_id)
        {
            config.default_model = None;
        }
        Ok(())
    })
}

#[tauri::command]
pub async fn set_default_model(selection: Option<ModelSelection>) -> Result<(), AppError> {
    ConfigDraft::global().await.transaction(|config| {
        config.default_model = selection;
        Ok(())
    })
}

fn hydrate_credential(
    profile: &mut ModelProviderProfile,
    key: Option<String>,
    config: &crate::services::AppConfig,
) -> Result<(), AppError> {
    profile.api_key = if let Some(key) = key {
        key
    } else {
        let existing = config
            .model_providers
            .iter()
            .find(|item| item.id == profile.id);
        if let Some(existing) = existing {
            if !existing.api_key.is_empty()
                && (existing.base_url.trim_end_matches('/')
                    != profile.base_url.trim_end_matches('/')
                    || existing.api != profile.api)
            {
                return Err(AppError::validation(
                    "测试新的 API 地址或协议前，请输入凭据或先保存供应商",
                ));
            }
            existing.api_key.clone()
        } else {
            String::new()
        }
    };
    Ok(())
}

#[tauri::command]
pub async fn test_model_provider(
    request: TestModelProviderRequest,
) -> Result<TestConnectionResult, AppError> {
    let mut profile = request.profile;
    hydrate_credential(
        &mut profile,
        request.api_key,
        &ConfigDraft::global().await.data(),
    )?;
    let config = profile.resolve(&request.model_id)?;
    let mut translator =
        AITranslator::new_with_config(config, false, Some("Reply with OK."), Some("en".into()))?;
    let started = Instant::now();
    let result = translator
        .translate_with_custom_user_prompt("Reply with OK.".to_string())
        .await;
    Ok(TestConnectionResult {
        success: result.is_ok(),
        message: match result {
            Ok(_) => "连接成功".into(),
            Err(error) => error.to_string(),
        },
        response_time_ms: Some(started.elapsed().as_millis() as u64),
    })
}

#[tauri::command]
pub async fn discover_provider_models(
    request: SaveModelProviderRequest,
) -> Result<Vec<ModelDefinition>, AppError> {
    let mut profile = request.profile;
    profile.validate_endpoint()?;
    if let Some(catalog_id) = &profile.catalog_provider_id {
        return crate::services::ai::provider::with_global_registry(|registry| {
            registry
                .get_provider(catalog_id)
                .map(|provider| {
                    provider
                        .get_models()
                        .into_iter()
                        .map(|model| ModelDefinition {
                            id: model.id,
                            name: Some(model.name),
                            context_window: u32::try_from(model.context_window).ok(),
                            max_tokens: u32::try_from(model.max_output_tokens).ok(),
                        })
                        .collect()
                })
                .ok_or_else(|| AppError::config("内置供应商目录不存在"))
        });
    }
    hydrate_credential(
        &mut profile,
        request.api_key,
        &ConfigDraft::global().await.data(),
    )?;
    fetch_models(&profile).await
}

async fn fetch_models(profile: &ModelProviderProfile) -> Result<Vec<ModelDefinition>, AppError> {
    let mut builder = reqwest::Client::builder()
        .no_proxy()
        .redirect(reqwest::redirect::Policy::none())
        .timeout(Duration::from_secs(30));
    if let Some(proxy) = &profile.proxy {
        if proxy.enabled {
            builder = builder.proxy(reqwest::Proxy::all(format!(
                "http://{}:{}",
                proxy.host, proxy.port
            ))?);
        }
    }
    let client = builder.build()?;
    let url = format!("{}/models", profile.base_url.trim_end_matches('/'));
    let mut rows = Vec::new();
    let mut cursor: Option<String> = None;
    let mut cursors = HashSet::new();
    for _ in 0..10 {
        let mut page_url =
            reqwest::Url::parse(&url).map_err(|error| AppError::config(error.to_string()))?;
        if profile.api == ModelApi::AnthropicMessages {
            page_url.query_pairs_mut().append_pair("limit", "1000");
            if let Some(after) = &cursor {
                page_url.query_pairs_mut().append_pair("after_id", after);
            }
        }
        let mut request = client.get(page_url);
        if profile.api == ModelApi::AnthropicMessages {
            request = request.header("anthropic-version", "2023-06-01");
            if !profile.api_key.is_empty() {
                request = request.header("x-api-key", &profile.api_key);
            }
        } else if !profile.api_key.is_empty() {
            request = request.bearer_auth(&profile.api_key);
        }
        let response = request.send().await?;
        if !response.status().is_success() {
            return Err(AppError::network(format!(
                "模型发现返回 HTTP {}",
                response.status()
            )));
        }
        let value: serde_json::Value = response.json().await?;
        let page = value
            .get("data")
            .and_then(|data| data.as_array())
            .ok_or_else(|| AppError::parse("模型发现响应缺少 data 数组，请手动添加模型"))?;
        rows.extend(page.iter().cloned());
        if value.get("has_more").and_then(|flag| flag.as_bool()) != Some(true) {
            return parse_models(serde_json::json!({"data": rows}));
        }
        if profile.api != ModelApi::AnthropicMessages {
            return Err(AppError::parse(
                "服务返回分页模型目录，请手动添加尚未列出的模型",
            ));
        }
        let next_cursor = value
            .get("last_id")
            .and_then(|id| id.as_str())
            .filter(|id| !id.is_empty())
            .ok_or_else(|| AppError::parse("模型目录分页缺少 last_id"))?
            .to_string();
        if !cursors.insert(next_cursor.clone()) {
            return Err(AppError::parse("模型目录返回重复分页游标"));
        }
        cursor = Some(next_cursor);
    }
    Err(AppError::parse("模型目录超过 10 页，请手动添加模型"))
}

fn parse_models(value: serde_json::Value) -> Result<Vec<ModelDefinition>, AppError> {
    let rows = value
        .get("data")
        .and_then(|data| data.as_array())
        .ok_or_else(|| AppError::parse("模型发现响应缺少 data 数组，请手动添加模型"))?;
    let mut seen = HashSet::new();
    let models: Vec<_> = rows
        .iter()
        .filter_map(|row| {
            let id = row.get("id")?.as_str()?.trim();
            if id.is_empty() || !seen.insert(id.to_string()) {
                return None;
            }
            Some(ModelDefinition {
                id: id.to_string(),
                name: row
                    .get("display_name")
                    .or_else(|| row.get("name"))
                    .and_then(|name| name.as_str())
                    .map(str::to_string),
                context_window: row
                    .get("context_window")
                    .or_else(|| row.get("max_input_tokens"))
                    .and_then(|n| n.as_u64())
                    .and_then(|n| u32::try_from(n).ok())
                    .filter(|n| *n > 0),
                max_tokens: row
                    .get("max_tokens")
                    .and_then(|n| n.as_u64())
                    .and_then(|n| u32::try_from(n).ok())
                    .filter(|n| *n > 0),
            })
        })
        .collect();
    if models.is_empty() {
        return Err(AppError::parse("没有发现模型，请手动添加模型 ID"));
    }
    Ok(models)
}

#[tauri::command]
pub async fn get_system_prompt() -> Result<String, AppError> {
    Ok(ConfigDraft::global()
        .await
        .data()
        .system_prompt
        .clone()
        .unwrap_or_else(|| crate::services::ai_translator::DEFAULT_SYSTEM_PROMPT.to_string()))
}

#[tauri::command]
pub async fn update_system_prompt(prompt: String) -> Result<(), AppError> {
    ConfigDraft::global().await.transaction(|config| {
        config.system_prompt = if prompt.trim().is_empty() {
            None
        } else {
            Some(prompt)
        };
        Ok(())
    })
}

#[tauri::command]
pub async fn reset_system_prompt() -> Result<(), AppError> {
    ConfigDraft::global().await.transaction(|config| {
        config.system_prompt = None;
        Ok(())
    })
}

#[cfg(test)]
#[allow(clippy::unwrap_used)]
mod tests {
    use super::*;
    use crate::services::AppConfig;

    fn profile() -> ModelProviderProfile {
        ModelProviderProfile {
            id: "local".into(),
            display_name: "Local".into(),
            catalog_provider_id: None,
            api: ModelApi::OpenaiCompletions,
            base_url: "http://localhost:8080/v1".into(),
            models: vec![ModelDefinition {
                id: "one".into(),
                name: None,
                context_window: None,
                max_tokens: None,
            }],
            proxy: None,
            api_key: String::new(),
        }
    }

    #[test]
    fn edit_retains_key_and_invalidated_default_is_cleared() {
        let mut config = AppConfig::default();
        save_profile(
            &mut config,
            SaveModelProviderRequest {
                profile: profile(),
                api_key: Some("secret".into()),
                default_model_id: None,
            },
        )
        .unwrap();
        config.default_model = Some(ModelSelection {
            provider_id: "local".into(),
            model_id: "one".into(),
        });
        let mut edited = profile();
        edited.models[0].id = "two".into();
        save_profile(
            &mut config,
            SaveModelProviderRequest {
                profile: edited,
                api_key: None,
                default_model_id: None,
            },
        )
        .unwrap();
        assert_eq!(config.model_providers[0].api_key, "secret");
        assert!(config.default_model.is_none());
        save_profile(
            &mut config,
            SaveModelProviderRequest {
                profile: profile(),
                api_key: Some(String::new()),
                default_model_id: None,
            },
        )
        .unwrap();
        assert!(config.model_providers[0].api_key.is_empty());
    }

    #[test]
    fn tests_cannot_reuse_secret_on_unsaved_endpoint() {
        let mut config = AppConfig::default();
        save_profile(
            &mut config,
            SaveModelProviderRequest {
                profile: profile(),
                api_key: Some("secret".into()),
                default_model_id: None,
            },
        )
        .unwrap();
        let mut changed = profile();
        changed.base_url = "https://different.example/v1".into();
        assert!(hydrate_credential(&mut changed, None, &config).is_err());
        hydrate_credential(&mut changed, Some("replacement".into()), &config).unwrap();
        assert_eq!(changed.api_key, "replacement");
    }

    #[test]
    fn save_can_select_default_model_atomically() {
        let mut config = AppConfig::default();
        save_profile(
            &mut config,
            SaveModelProviderRequest {
                profile: profile(),
                api_key: None,
                default_model_id: Some("one".into()),
            },
        )
        .unwrap();
        assert_eq!(
            config.default_model,
            Some(ModelSelection {
                provider_id: "local".into(),
                model_id: "one".into()
            })
        );
    }

    #[test]
    fn ordinary_save_preserves_another_default() {
        let mut config = AppConfig::default();
        let mut other = profile();
        other.id = "other".into();
        save_profile(
            &mut config,
            SaveModelProviderRequest {
                profile: other,
                api_key: None,
                default_model_id: Some("one".into()),
            },
        )
        .unwrap();
        save_profile(
            &mut config,
            SaveModelProviderRequest {
                profile: profile(),
                api_key: None,
                default_model_id: None,
            },
        )
        .unwrap();
        assert_eq!(
            config
                .default_model
                .as_ref()
                .map(|selection| &selection.provider_id),
            Some(&"other".to_string())
        );
    }

    #[test]
    fn invalid_default_is_rejected_without_mutating_config() {
        let mut config = AppConfig::default();
        let result = save_profile(
            &mut config,
            SaveModelProviderRequest {
                profile: profile(),
                api_key: Some("secret".into()),
                default_model_id: Some("missing".into()),
            },
        );
        assert!(result.is_err());
        assert!(config.model_providers.is_empty());
        assert!(config.default_model.is_none());
    }

    #[tokio::test]
    async fn anthropic_discovery_follows_pages_and_authenticates() {
        use std::io::{Read, Write};
        let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let mut provider = profile();
        provider.base_url = format!("http://{}/v1", listener.local_addr().unwrap());
        provider.api = ModelApi::AnthropicMessages;
        provider.api_key = "local-dummy-key".into();
        let server = std::thread::spawn(move || {
            for page in 0..2 {
                let (mut stream, _) = listener.accept().unwrap();
                stream
                    .set_read_timeout(Some(Duration::from_secs(5)))
                    .unwrap();
                let mut bytes = Vec::new();
                while !bytes.windows(4).any(|part| part == b"\r\n\r\n") {
                    let mut buffer = [0; 1024];
                    let count = stream.read(&mut buffer).unwrap();
                    assert!(count > 0);
                    bytes.extend_from_slice(&buffer[..count]);
                }
                let request = String::from_utf8(bytes).unwrap();
                assert!(request.starts_with("GET /v1/models?limit=1000"));
                assert!(request.contains("x-api-key: local-dummy-key"));
                assert!(request.contains("anthropic-version: 2023-06-01"));
                if page == 1 {
                    assert!(request.contains("after_id=first"));
                }
                let body = if page == 0 {
                    r#"{"data":[{"id":"first","max_input_tokens":1000,"max_tokens":100}],"has_more":true,"last_id":"first"}"#
                } else {
                    r#"{"data":[{"id":"second"}],"has_more":false,"last_id":"second"}"#
                };
                write!(stream, "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}", body.len(), body).unwrap();
            }
        });
        let models = fetch_models(&provider).await.unwrap();
        server.join().unwrap();
        assert_eq!(
            models
                .iter()
                .map(|model| model.id.as_str())
                .collect::<Vec<_>>(),
            ["first", "second"]
        );
        assert_eq!(models[0].context_window, Some(1000));
    }

    #[test]
    fn discovery_deduplicates_without_inventing_limits() {
        let models = parse_models(serde_json::json!({"data":[{"id":"model"},{"id":"model"},{"id":"two","display_name":"Two"},{}]})).unwrap();
        assert_eq!(models.len(), 2);
        assert_eq!(models[0].context_window, None);
        assert!(parse_models(serde_json::json!({"error":"bad"})).is_err());
    }
}
