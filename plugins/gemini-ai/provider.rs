use crate::services::ai::model_info::ModelInfo;
use crate::services::ai::provider::AIProvider;

/// Google Gemini AI 插件供应商
/// 
/// 基于 Google AI Platform 的 Gemini 系列模型
/// 特点：超长上下文，复杂推理能力强，擅长编码任务和Web开发
pub struct GeminiPluginProvider {
    /// 插件配置（从 plugin.toml 加载）
    config: crate::services::ai::plugin_config::PluginConfig,
}

impl GeminiPluginProvider {
    pub fn new(config: crate::services::ai::plugin_config::PluginConfig) -> Self {
        Self { config }
    }
}

impl AIProvider for GeminiPluginProvider {
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
                name: "Google Gemini".to_string(),
                id: "gemini".to_string(),
                version: "2.5.0".to_string(),
                api_version: "1.0".to_string(),
                description: "Google Gemini 多模态大模型，超长上下文，复杂推理能力强".to_string(),
                author: "AI L10n Studio".to_string(),
                homepage: Some("https://ai.google.dev".to_string()),
                license: Some("MIT".to_string()),
            },
            provider: ProviderPluginConfig {
                display_name: "Gemini".to_string(),
                default_url: "https://generativelanguage.googleapis.com/v1beta/models".to_string(),
                default_model: "gemini-2.0-flash-exp".to_string(),
                supports_cache: false,
                supports_images: true,
                models: vec![
                    ModelPluginConfig {
                        id: "gemini-2.0-flash-exp".to_string(),
                        name: "Gemini-2.0-Flash-Exp".to_string(),
                        context_window: 2097152, // 2M tokens
                        max_output_tokens: 8192,
                        input_price: 0.075,
                        output_price: 0.30,
                        cache_reads_price: 0.0,
                        cache_writes_price: 0.0,
                        recommended: true,
                        description: Some("Gemini-2.0 Flash实验版本，2M tokens超长上下文".to_string()),
                    },
                    ModelPluginConfig {
                        id: "gemini-1.5-pro-latest".to_string(),
                        name: "Gemini-1.5-Pro".to_string(),
                        context_window: 2097152, // 2M tokens
                        max_output_tokens: 8192,
                        input_price: 1.25,
                        output_price: 5.00,
                        cache_reads_price: 0.0,
                        cache_writes_price: 0.0,
                        recommended: true,
                        description: Some("Gemini-1.5-Pro稳定版，2M tokens上下文，高质量推理".to_string()),
                    },
                    ModelPluginConfig {
                        id: "gemini-1.5-flash-latest".to_string(),
                        name: "Gemini-1.5-Flash".to_string(),
                        context_window: 1048576, // 1M tokens
                        max_output_tokens: 8192,
                        input_price: 0.075,
                        output_price: 0.30,
                        cache_reads_price: 0.0,
                        cache_writes_price: 0.0,
                        recommended: true,
                        description: Some("Gemini-1.5-Flash高速版，1M tokens上下文，极速响应".to_string()),
                    },
                ],
            },
        }
    }

    #[test]
    fn test_gemini_provider_basic_info() {
        let config = create_test_config();
        let provider = GeminiPluginProvider::new(config);

        assert_eq!(provider.id(), "gemini");
        assert_eq!(provider.display_name(), "Gemini");
        assert_eq!(provider.default_model(), "gemini-2.0-flash-exp");
        assert_eq!(
            provider.default_url(),
            "https://generativelanguage.googleapis.com/v1beta/models"
        );
    }

    #[test]
    fn test_gemini_models() {
        let config = create_test_config();
        let provider = GeminiPluginProvider::new(config);
        let models = provider.get_models();

        assert_eq!(models.len(), 3);

        // 测试最新模型 Gemini-2.0-Flash-Exp
        let gemini_2_flash = models.iter().find(|m| m.id == "gemini-2.0-flash-exp").unwrap();
        assert_eq!(gemini_2_flash.name, "Gemini-2.0-Flash-Exp");
        assert_eq!(gemini_2_flash.provider, "Gemini");
        assert_eq!(gemini_2_flash.context_window, 2097152); // 2M tokens
        assert_eq!(gemini_2_flash.max_output_tokens, 8192);
        assert_eq!(gemini_2_flash.input_price, 0.075);
        assert_eq!(gemini_2_flash.output_price, 0.30);
        assert!(!gemini_2_flash.supports_cache);
        assert!(gemini_2_flash.supports_images);
        assert!(gemini_2_flash.recommended);

        // 测试高质量模型 Gemini-1.5-Pro
        let gemini_pro = models.iter().find(|m| m.id == "gemini-1.5-pro-latest").unwrap();
        assert_eq!(gemini_pro.name, "Gemini-1.5-Pro");
        assert_eq!(gemini_pro.context_window, 2097152); // 2M tokens
        assert_eq!(gemini_pro.input_price, 1.25);
        assert_eq!(gemini_pro.output_price, 5.00);
        assert!(gemini_pro.recommended);

        // 测试高性价比模型 Gemini-1.5-Flash
        let gemini_flash = models.iter().find(|m| m.id == "gemini-1.5-flash-latest").unwrap();
        assert_eq!(gemini_flash.name, "Gemini-1.5-Flash");
        assert_eq!(gemini_flash.context_window, 1048576); // 1M tokens
        assert_eq!(gemini_flash.input_price, 0.075);
        assert_eq!(gemini_flash.output_price, 0.30);
        assert!(gemini_flash.recommended);
    }

    #[test]
    fn test_get_model_info() {
        let config = create_test_config();
        let provider = GeminiPluginProvider::new(config);

        // 测试存在的模型
        let model_info = provider.get_model_info("gemini-2.0-flash-exp");
        assert!(model_info.is_some());
        let model = model_info.unwrap();
        assert_eq!(model.id, "gemini-2.0-flash-exp");
        assert_eq!(model.name, "Gemini-2.0-Flash-Exp");

        // 测试不存在的模型
        let non_existent = provider.get_model_info("non-existent-model");
        assert!(non_existent.is_none());
    }

    #[test]
    fn test_cache_support() {
        let config = create_test_config();
        let provider = GeminiPluginProvider::new(config);
        let models = provider.get_models();

        // Google Gemini 目前不支持 Prompt 缓存功能
        for model in models {
            assert!(!model.supports_cache);
            assert!(model.cache_reads_price.is_none());
            assert!(model.cache_writes_price.is_none());
        }
    }

    #[test]
    fn test_ultra_long_context() {
        let config = create_test_config();
        let provider = GeminiPluginProvider::new(config);
        let models = provider.get_models();

        // 验证Gemini的超长上下文能力
        let gemini_2_flash = models.iter().find(|m| m.id == "gemini-2.0-flash-exp").unwrap();
        let gemini_pro = models.iter().find(|m| m.id == "gemini-1.5-pro-latest").unwrap();
        let gemini_flash = models.iter().find(|m| m.id == "gemini-1.5-flash-latest").unwrap();

        // 2.0 Flash 和 1.5 Pro 都有2M tokens上下文
        assert_eq!(gemini_2_flash.context_window, 2097152);
        assert_eq!(gemini_pro.context_window, 2097152);

        // 1.5 Flash 有1M tokens上下文
        assert_eq!(gemini_flash.context_window, 1048576);

        // 所有模型的上下文都远超传统模型
        for model in models {
            assert!(model.context_window >= 1048576); // 至少1M tokens
        }
    }

    #[test]
    fn test_pricing_structure() {
        let config = create_test_config();
        let provider = GeminiPluginProvider::new(config);
        let models = provider.get_models();

        // 验证定价结构：Pro > Flash 系列
        let gemini_pro = models.iter().find(|m| m.id == "gemini-1.5-pro-latest").unwrap();
        let gemini_flash = models.iter().find(|m| m.id == "gemini-1.5-flash-latest").unwrap();
        let gemini_2_flash = models.iter().find(|m| m.id == "gemini-2.0-flash-exp").unwrap();

        // Pro版本价格最高
        assert!(gemini_pro.input_price > gemini_flash.input_price);
        assert!(gemini_pro.output_price > gemini_flash.output_price);

        // Flash系列价格相近
        assert_eq!(gemini_flash.input_price, gemini_2_flash.input_price);
        assert_eq!(gemini_flash.output_price, gemini_2_flash.output_price);

        // 验证输出价格高于输入价格
        for model in models {
            assert!(model.output_price >= model.input_price);
        }
    }

    #[test]
    fn test_multimodal_capabilities() {
        let config = create_test_config();
        let provider = GeminiPluginProvider::new(config);
        let models = provider.get_models();

        // Gemini 是原生多模态模型
        for model in models {
            assert!(model.supports_images);
        }
    }

    #[test]
    fn test_google_ai_platform() {
        let config = create_test_config();
        let provider = GeminiPluginProvider::new(config);

        // 验证使用 Google AI 官方平台
        assert!(provider.default_url().contains("googleapis.com"));
        assert!(provider.default_url().contains("generativelanguage"));
    }

    #[test]
    fn test_coding_and_web_development_focus() {
        let config = create_test_config();
        let _provider = GeminiPluginProvider::new(config.clone());

        // 验证Gemini在编码和Web开发方面的专长
        assert!(config.plugin.description.contains("编码"));
        assert!(config.plugin.description.contains("Web开发"));
        assert!(config.plugin.description.contains("复杂推理"));
    }

    #[test]
    fn test_experimental_model_features() {
        let config = create_test_config();
        let provider = GeminiPluginProvider::new(config);
        let models = provider.get_models();

        // 验证实验版本模型的特性
        let gemini_2_flash = models.iter().find(|m| m.id == "gemini-2.0-flash-exp").unwrap();
        assert!(gemini_2_flash.description.as_ref().unwrap().contains("实验版"));
        assert!(gemini_2_flash.description.as_ref().unwrap().contains("2M tokens"));
        assert!(gemini_2_flash.recommended); // 实验版作为默认推荐，体现最新技术
    }

    #[test]
    fn test_version_evolution() {
        let config = create_test_config();
        let provider = GeminiPluginProvider::new(config);
        let models = provider.get_models();

        // 验证模型版本演进：2.0 > 1.5
        let gemini_2_flash = models.iter().find(|m| m.id == "gemini-2.0-flash-exp").unwrap();
        let gemini_15_pro = models.iter().find(|m| m.id == "gemini-1.5-pro-latest").unwrap();
        let gemini_15_flash = models.iter().find(|m| m.id == "gemini-1.5-flash-latest").unwrap();

        // 2.0版本应该有相同或更好的上下文窗口
        assert!(gemini_2_flash.context_window >= gemini_15_flash.context_window);

        // 所有推荐模型都应该是较新的版本
        assert!(gemini_2_flash.recommended);
        assert!(gemini_15_pro.recommended);
        assert!(gemini_15_flash.recommended);
    }
}
