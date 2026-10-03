//! Provider profiles, model catalogs, and an independent default model selection.

use std::collections::HashSet;

use serde::{Deserialize, Serialize};

use crate::error::AppError;
use crate::services::ai_translator::ProxyConfig;

#[cfg(feature = "ts-rs")]
use ts_rs::TS;

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
#[cfg_attr(feature = "ts-rs", derive(TS))]
#[cfg_attr(
    feature = "ts-rs",
    ts(export, export_to = "../../src/types/generated/")
)]
pub enum ModelApi {
    #[default]
    OpenaiCompletions,
    OpenaiResponses,
    AnthropicMessages,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "ts-rs", derive(TS))]
#[cfg_attr(
    feature = "ts-rs",
    ts(export, export_to = "../../src/types/generated/")
)]
pub struct ModelDefinition {
    pub id: String,
    pub name: Option<String>,
    pub context_window: Option<u32>,
    pub max_tokens: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "ts-rs", derive(TS))]
#[cfg_attr(
    feature = "ts-rs",
    ts(export, export_to = "../../src/types/generated/")
)]
pub struct ModelProviderProfile {
    pub id: String,
    pub display_name: String,
    pub catalog_provider_id: Option<String>,
    pub api: ModelApi,
    pub base_url: String,
    pub models: Vec<ModelDefinition>,
    pub proxy: Option<ProxyConfig>,
    // Populated only by the credential store or a write-only command argument.
    #[serde(skip)]
    #[cfg_attr(feature = "ts-rs", ts(skip))]
    pub api_key: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "ts-rs", derive(TS))]
#[cfg_attr(
    feature = "ts-rs",
    ts(export, export_to = "../../src/types/generated/")
)]
pub struct ModelSelection {
    pub provider_id: String,
    pub model_id: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "ts-rs", derive(TS))]
#[cfg_attr(
    feature = "ts-rs",
    ts(export, export_to = "../../src/types/generated/")
)]
pub struct ModelProviderSummary {
    pub profile: ModelProviderProfile,
    pub has_api_key: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "ts-rs", derive(TS))]
#[cfg_attr(
    feature = "ts-rs",
    ts(export, export_to = "../../src/types/generated/")
)]
pub struct ModelConfiguration {
    pub providers: Vec<ModelProviderSummary>,
    pub default_model: Option<ModelSelection>,
}

/// Immutable, resolved request configuration; never exposed through IPC.
#[derive(Debug, Clone)]
pub struct AIConfig {
    pub provider_id: String,
    pub catalog_provider_id: Option<String>,
    pub api_key: String,
    pub api: ModelApi,
    pub base_url: String,
    pub model: String,
    pub max_tokens: Option<u32>,
    pub proxy: Option<ProxyConfig>,
}

impl ModelProviderProfile {
    pub fn validate_endpoint(&self) -> Result<(), AppError> {
        if self.id.is_empty()
            || !self.id.as_bytes()[0].is_ascii_lowercase()
            || !self
                .id
                .bytes()
                .all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit() || byte == b'-')
        {
            return Err(AppError::validation(
                "供应商 ID 必须以小写字母开头，仅包含小写字母、数字和连字符",
            ));
        }
        if self.display_name.trim().is_empty() {
            return Err(AppError::validation("供应商显示名称不能为空"));
        }
        let url = reqwest::Url::parse(&self.base_url)
            .map_err(|_| AppError::validation("API 地址无效"))?;
        if !matches!(url.scheme(), "http" | "https")
            || url.host_str().is_none()
            || !url.username().is_empty()
            || url.password().is_some()
            || url.query().is_some()
            || url.fragment().is_some()
        {
            return Err(AppError::validation(
                "API 地址必须是无用户名、密码、查询参数和片段的 HTTP(S) 基础地址",
            ));
        }
        if let Some(proxy) = &self.proxy {
            if proxy.enabled && (proxy.host.trim().is_empty() || proxy.port == 0) {
                return Err(AppError::validation("代理主机与端口无效"));
            }
        }
        Ok(())
    }

    pub fn validate(&self) -> Result<(), AppError> {
        self.validate_endpoint()?;
        if self.models.is_empty() {
            return Err(AppError::validation("每个供应商至少需要一个模型"));
        }
        let mut ids = HashSet::new();
        for model in &self.models {
            if model.id.trim().is_empty() || model.id.trim() != model.id || !ids.insert(&model.id) {
                return Err(AppError::validation("模型 ID 不能为空、包含首尾空格或重复"));
            }
            if model.context_window == Some(0) || model.max_tokens == Some(0) {
                return Err(AppError::validation(
                    "上下文窗口和最大输出 token 必须为正整数",
                ));
            }
            if let (Some(context), Some(output)) = (model.context_window, model.max_tokens) {
                if output > context {
                    return Err(AppError::validation("最大输出 token 不能超过上下文窗口"));
                }
            }
        }
        Ok(())
    }

    pub fn resolve(&self, model_id: &str) -> Result<AIConfig, AppError> {
        self.validate()?;
        let model = self
            .models
            .iter()
            .find(|model| model.id == model_id)
            .ok_or_else(|| {
                AppError::config(format!("供应商 {} 未配置模型 {}", self.id, model_id))
            })?;
        Ok(AIConfig {
            provider_id: self.id.clone(),
            catalog_provider_id: self.catalog_provider_id.clone(),
            api_key: self.api_key.clone(),
            api: self.api,
            base_url: self.base_url.trim_end_matches('/').to_string(),
            model: model.id.clone(),
            max_tokens: model.max_tokens,
            proxy: self.proxy.clone(),
        })
    }
}

pub fn validate_model_configuration(
    providers: &[ModelProviderProfile],
    selection: Option<&ModelSelection>,
) -> Result<(), AppError> {
    let mut ids = HashSet::new();
    for provider in providers {
        provider.validate()?;
        if !ids.insert(&provider.id) {
            return Err(AppError::validation("供应商 ID 重复"));
        }
    }
    if let Some(selection) = selection {
        let provider = providers
            .iter()
            .find(|provider| provider.id == selection.provider_id)
            .ok_or_else(|| AppError::config("默认模型的供应商不存在，请重新选择模型"))?;
        provider.resolve(&selection.model_id)?;
    }
    Ok(())
}

#[cfg(test)]
#[allow(clippy::unwrap_used)]
mod tests {
    use super::*;

    pub(crate) fn provider() -> ModelProviderProfile {
        ModelProviderProfile {
            id: "local".into(),
            display_name: "Local".into(),
            catalog_provider_id: None,
            api: ModelApi::OpenaiCompletions,
            base_url: "http://127.0.0.1:8080/v1".into(),
            models: vec![ModelDefinition {
                id: "model-one".into(),
                name: None,
                context_window: Some(8192),
                max_tokens: Some(1024),
            }],
            proxy: None,
            api_key: "secret".into(),
        }
    }

    #[test]
    fn rejects_duplicate_models_and_dangling_default() {
        let mut profile = provider();
        profile.models.push(profile.models[0].clone());
        assert!(profile.validate().is_err());
        let selection = ModelSelection {
            provider_id: "local".into(),
            model_id: "missing".into(),
        };
        assert!(validate_model_configuration(&[provider()], Some(&selection)).is_err());
    }

    #[test]
    fn profile_serialization_never_exposes_credentials() {
        let profile = provider();
        let serialized = serde_json::to_string(&profile).unwrap();
        assert!(!serialized.contains("secret"));
        assert!(!serialized.contains("apiKey"));
        assert!(profile.resolve("model-one").is_ok());
    }
}
