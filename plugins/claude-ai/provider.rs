use crate::services::ai::model_info::ModelInfo;
use crate::services::ai::provider::AIProvider;

/// Anthropic Claude AI 插件供应商
/// 
/// 基于 Anthropic API 的 Claude 系列模型
/// 特点：安全性和推理能力领先，支持混合推理模式，擅长复杂分析和创作任务
pub struct ClaudePluginProvider {
    /// 插件配置（从 plugin.toml 加载）
    config: crate::services::ai::plugin_config::PluginConfig,
}

impl ClaudePluginProvider {
    pub fn new(config: crate::services::ai::plugin_config::PluginConfig) -> Self {
        Self { config }
    }
}

impl AIProvider for ClaudePluginProvider {
    fn id(&self) -> &str {
        &self.config.plugin.id
    }

    fn display_name(&self) -> &str {
        &self.config.provider.display_name
    }

    fn default_url(&self) -> &str {
        &self.config.provider.default_url
    }

    fn default_model(&self) -> &str {
        &self.config.provider.default_model
    }

    fn get_models(&self) -> Vec<ModelInfo> {
        // 从插件配置动态生成模型列表
        self.config.provider.models.iter().map(|model_config| {
            ModelInfo {
                id: model_config.id.clone(),
                name: model_config.name.clone(),
                provider: self.config.provider.display_name.clone(),
                context_window: model_config.context_window,
                max_output_tokens: model_config.max_output_tokens,
                input_price: model_config.input_price,
                output_price: model_config.output_price,
                cache_reads_price: if model_config.cache_reads_price == 0.0 {
                    None
                } else {
                    Some(model_config.cache_reads_price)
                },
                cache_writes_price: if model_config.cache_writes_price == 0.0 {
                    None
                } else {
                    Some(model_config.cache_writes_price)
                },
                supports_cache: self.config.provider.supports_cache,
                supports_images: self.config.provider.supports_images,
                recommended: model_config.recommended,
                description: model_config.description.clone(),
            }
        }).collect()
    }

    fn get_model_info(&self, model_id: &str) -> Option<ModelInfo> {
        self.get_models()
            .into_iter()
            .find(|model| model.id == model_id)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::services::ai::plugin_config::{PluginConfig, ProviderPluginConfig, ModelPluginConfig};

    fn create_test_config() -> PluginConfig {
        PluginConfig {
            plugin: crate::services::ai::plugin_config::PluginMetadata {
                name: "Anthropic Claude".to_string(),
                id: "claude".to_string(),
                version: "3.7.0".to_string(),
                api_version: "1.0".to_string(),
                description: "Anthropic Claude 大模型，安全性和推理能力领先".to_string(),
                author: "AI L10n Studio".to_string(),
                homepage: Some("https://www.anthropic.com".to_string()),
                license: Some("MIT".to_string()),
            },
            provider: ProviderPluginConfig {
                display_name: "Claude".to_string(),
                default_url: "https://api.anthropic.com/v1/messages".to_string(),
                default_model: "claude-3-7-sonnet".to_string(),
                supports_cache: true,
                supports_images: true,
                models: vec![
                    ModelPluginConfig {
                        id: "claude-3-7-sonnet".to_string(),
                        name: "Claude-3.7 Sonnet".to_string(),
                        context_window: 200000,
                        max_output_tokens: 8192,
                        input_price: 3.00,
                        output_price: 15.00,
                        cache_reads_price: 0.30,
                        cache_writes_price: 3.75,
                        recommended: true,
                        description: Some("最新Claude-3.7混合推理模型，200K上下文".to_string()),
                    },
                    ModelPluginConfig {
                        id: "claude-3-5-haiku-20241022".to_string(),
                        name: "Claude-3.5 Haiku".to_string(),
                        context_window: 200000,
                        max_output_tokens: 8192,
                        input_price: 1.00,
                        output_price: 5.00,
                        cache_reads_price: 0.10,
                        cache_writes_price: 1.25,
                        recommended: true,
                        description: Some("Claude-3.5轻量版，200K上下文，高性价比".to_string()),
                    },
                    ModelPluginConfig {
                        id: "claude-3-opus-20240229".to_string(),
                        name: "Claude-3 Opus".to_string(),
                        context_window: 200000,
                        max_output_tokens: 4096,
                        input_price: 15.00,
                        output_price: 75.00,
                        cache_reads_price: 1.50,
                        cache_writes_price: 18.75,
                        recommended: false,
                        description: Some("Claude-3最高质量模型，200K上下文，顶级智能".to_string()),
                    },
                ],
            },
        }
    }

    #[test]
    fn test_claude_provider_basic_info() {
        let config = create_test_config();
        let provider = ClaudePluginProvider::new(config);

        assert_eq!(provider.id(), "claude");
        assert_eq!(provider.display_name(), "Claude");
        assert_eq!(provider.default_model(), "claude-3-7-sonnet");
        assert_eq!(
            provider.default_url(),
            "https://api.anthropic.com/v1/messages"
        );
    }

    #[test]
    fn test_claude_models() {
        let config = create_test_config();
        let provider = ClaudePluginProvider::new(config);
        let models = provider.get_models();

        assert_eq!(models.len(), 3);

        // 测试最新模型 Claude-3.7 Sonnet
        let claude_37 = models.iter().find(|m| m.id == "claude-3-7-sonnet").unwrap();
        assert_eq!(claude_37.name, "Claude-3.7 Sonnet");
        assert_eq!(claude_37.provider, "Claude");
        assert_eq!(claude_37.context_window, 200000);
        assert_eq!(claude_37.max_output_tokens, 8192);
        assert_eq!(claude_37.input_price, 3.00);
        assert_eq!(claude_37.output_price, 15.00);
        assert!(claude_37.supports_cache);
        assert!(claude_37.supports_images);
        assert!(claude_37.recommended);

        // 测试高性价比模型 Claude-3.5 Haiku
        let claude_haiku = models.iter().find(|m| m.id == "claude-3-5-haiku-20241022").unwrap();
        assert_eq!(claude_haiku.name, "Claude-3.5 Haiku");
        assert_eq!(claude_haiku.input_price, 1.00);
        assert_eq!(claude_haiku.output_price, 5.00);
        assert!(claude_haiku.recommended);

        // 测试顶级模型 Claude-3 Opus
        let claude_opus = models.iter().find(|m| m.id == "claude-3-opus-20240229").unwrap();
        assert_eq!(claude_opus.name, "Claude-3 Opus");
        assert_eq!(claude_opus.input_price, 15.00);
        assert_eq!(claude_opus.output_price, 75.00); // 最昂贵的模型
        assert!(!claude_opus.recommended); // 由于价格昂贵，不作为默认推荐
    }

    #[test]
    fn test_get_model_info() {
        let config = create_test_config();
        let provider = ClaudePluginProvider::new(config);

        // 测试存在的模型
        let model_info = provider.get_model_info("claude-3-7-sonnet");
        assert!(model_info.is_some());
        let model = model_info.unwrap();
        assert_eq!(model.id, "claude-3-7-sonnet");
        assert_eq!(model.name, "Claude-3.7 Sonnet");

        // 测试不存在的模型
        let non_existent = provider.get_model_info("non-existent-model");
        assert!(non_existent.is_none());
    }

    #[test]
    fn test_cache_support() {
        let config = create_test_config();
        let provider = ClaudePluginProvider::new(config);
        let models = provider.get_models();

        // Anthropic Claude 支持 Prompt 缓存功能
        for model in models {
            assert!(model.supports_cache);
            assert!(model.cache_reads_price.is_some());
            assert!(model.cache_writes_price.is_some());

            // 验证缓存定价（通常是输入价格的10%和125%）
            let cache_read = model.cache_reads_price.unwrap();
            let cache_write = model.cache_writes_price.unwrap();
            assert!(cache_read < model.input_price); // 缓存读取应该更便宜
            assert!(cache_write > model.input_price); // 缓存写入应该更贵
        }
    }

    #[test]
    fn test_context_window_consistency() {
        let config = create_test_config();
        let provider = ClaudePluginProvider::new(config);
        let models = provider.get_models();

        // 验证所有Claude模型都有200K上下文窗口
        for model in models {
            assert_eq!(model.context_window, 200000);
        }
    }

    #[test]
    fn test_pricing_tiers() {
        let config = create_test_config();
        let provider = ClaudePluginProvider::new(config);
        let models = provider.get_models();

        // 验证定价层次：Opus > Sonnet > Haiku
        let claude_37 = models.iter().find(|m| m.id == "claude-3-7-sonnet").unwrap();
        let claude_haiku = models.iter().find(|m| m.id == "claude-3-5-haiku-20241022").unwrap();
        let claude_opus = models.iter().find(|m| m.id == "claude-3-opus-20240229").unwrap();

        // Haiku是最便宜的
        assert!(claude_haiku.input_price < claude_37.input_price);
        assert!(claude_haiku.output_price < claude_37.output_price);

        // Opus是最昂贵的
        assert!(claude_opus.input_price > claude_37.input_price);
        assert!(claude_opus.output_price > claude_37.output_price);
    }

    #[test]
    fn test_safety_and_reasoning_focus() {
        let config = create_test_config();
        let _provider = ClaudePluginProvider::new(config.clone());

        // 验证Claude专注于安全性和推理能力
        assert_eq!(config.provider.display_name, "Claude");
        assert!(config.plugin.description.contains("安全性"));
        assert!(config.plugin.description.contains("推理能力"));
        assert!(config.plugin.description.contains("混合推理"));
    }

    #[test]
    fn test_multimodal_support() {
        let config = create_test_config();
        let provider = ClaudePluginProvider::new(config);
        let models = provider.get_models();

        // Claude 支持多模态功能（文本+图像）
        for model in models {
            assert!(model.supports_images);
        }
    }

    #[test]
    fn test_anthropic_api_endpoint() {
        let config = create_test_config();
        let provider = ClaudePluginProvider::new(config);

        // 验证使用 Anthropic 官方 API 端点
        assert!(provider.default_url().contains("anthropic.com"));
        assert!(provider.default_url().contains("/v1/messages"));
    }

    #[test]
    fn test_hybrid_reasoning_capability() {
        let config = create_test_config();
        let provider = ClaudePluginProvider::new(config);
        let models = provider.get_models();

        // 验证Claude-3.7支持混合推理
        let claude_37 = models.iter().find(|m| m.id == "claude-3-7-sonnet").unwrap();
        assert!(claude_37.description.as_ref().unwrap().contains("混合推理"));
    }
}
