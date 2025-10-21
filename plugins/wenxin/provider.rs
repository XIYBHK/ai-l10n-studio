use crate::services::ai::model_info::ModelInfo;
use crate::services::ai::provider::AIProvider;

/// 百度文心一言 (ERNIE) 插件供应商
/// 
/// 基于百度千帆平台的 ERNIE 系列大模型
/// 特点：中文理解与生成能力出众，支持多种应用场景
pub struct WenxinPluginProvider {
    /// 插件配置（从 plugin.toml 加载）
    config: crate::services::ai::plugin_config::PluginConfig,
}

impl WenxinPluginProvider {
    pub fn new(config: crate::services::ai::plugin_config::PluginConfig) -> Self {
        Self { config }
    }
}

impl AIProvider for WenxinPluginProvider {
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
                name: "百度文心一言 (ERNIE)".to_string(),
                id: "wenxin".to_string(),
                version: "4.0.0".to_string(),
                api_version: "1.0".to_string(),
                description: "百度文心一言大模型，中文理解与生成能力出众".to_string(),
                author: "AI L10n Studio".to_string(),
                homepage: Some("https://yiyan.baidu.com".to_string()),
                license: Some("MIT".to_string()),
            },
            provider: ProviderPluginConfig {
                display_name: "百度文心一言".to_string(),
                default_url: "https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat".to_string(),
                default_model: "ernie-4.0-8k".to_string(),
                supports_cache: false,
                supports_images: true,
                models: vec![
                    ModelPluginConfig {
                        id: "ernie-4.0-8k".to_string(),
                        name: "ERNIE-4.0 (8K)".to_string(),
                        context_window: 8192,
                        max_output_tokens: 2048,
                        input_price: 1.67,
                        output_price: 2.50,
                        cache_reads_price: 0.0,
                        cache_writes_price: 0.0,
                        recommended: true,
                        description: Some("文心一言4.0版本，8K上下文，综合能力强".to_string()),
                    },
                    ModelPluginConfig {
                        id: "ernie-4.0-turbo".to_string(),
                        name: "ERNIE-4.0 Turbo".to_string(),
                        context_window: 8192,
                        max_output_tokens: 2048,
                        input_price: 0.83,
                        output_price: 1.25,
                        cache_reads_price: 0.0,
                        cache_writes_price: 0.0,
                        recommended: true,
                        description: Some("文心一言4.0 Turbo版本，高性价比，快速响应".to_string()),
                    },
                    ModelPluginConfig {
                        id: "ernie-lite-8k".to_string(),
                        name: "ERNIE Lite (8K)".to_string(),
                        context_window: 8192,
                        max_output_tokens: 2048,
                        input_price: 0.0, // 免费模型
                        output_price: 0.0,
                        cache_reads_price: 0.0,
                        cache_writes_price: 0.0,
                        recommended: false,
                        description: Some("文心一言轻量版，8K上下文，免费使用（有限制）".to_string()),
                    },
                ],
            },
        }
    }

    #[test]
    fn test_wenxin_provider_basic_info() {
        let config = create_test_config();
        let provider = WenxinPluginProvider::new(config);

        assert_eq!(provider.id(), "wenxin");
        assert_eq!(provider.display_name(), "百度文心一言");
        assert_eq!(provider.default_model(), "ernie-4.0-8k");
        assert_eq!(
            provider.default_url(),
            "https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat"
        );
    }

    #[test]
    fn test_wenxin_models() {
        let config = create_test_config();
        let provider = WenxinPluginProvider::new(config);
        let models = provider.get_models();

        assert_eq!(models.len(), 3);

        // 测试主力模型 ERNIE-4.0-8K
        let ernie_4_0 = models.iter().find(|m| m.id == "ernie-4.0-8k").unwrap();
        assert_eq!(ernie_4_0.name, "ERNIE-4.0 (8K)");
        assert_eq!(ernie_4_0.provider, "百度文心一言");
        assert_eq!(ernie_4_0.context_window, 8192);
        assert_eq!(ernie_4_0.max_output_tokens, 2048);
        assert_eq!(ernie_4_0.input_price, 1.67);
        assert_eq!(ernie_4_0.output_price, 2.50);
        assert!(!ernie_4_0.supports_cache);
        assert!(ernie_4_0.supports_images);
        assert!(ernie_4_0.recommended);

        // 测试高性价比模型 ERNIE-4.0-Turbo
        let ernie_turbo = models.iter().find(|m| m.id == "ernie-4.0-turbo").unwrap();
        assert_eq!(ernie_turbo.name, "ERNIE-4.0 Turbo");
        assert_eq!(ernie_turbo.input_price, 0.83);
        assert_eq!(ernie_turbo.output_price, 1.25);
        assert!(ernie_turbo.recommended);

        // 测试免费模型 ERNIE Lite
        let ernie_lite = models.iter().find(|m| m.id == "ernie-lite-8k").unwrap();
        assert_eq!(ernie_lite.name, "ERNIE Lite (8K)");
        assert_eq!(ernie_lite.input_price, 0.0);
        assert_eq!(ernie_lite.output_price, 0.0);
        assert!(!ernie_lite.recommended);
    }

    #[test]
    fn test_get_model_info() {
        let config = create_test_config();
        let provider = WenxinPluginProvider::new(config);

        // 测试存在的模型
        let model_info = provider.get_model_info("ernie-4.0-8k");
        assert!(model_info.is_some());
        let model = model_info.unwrap();
        assert_eq!(model.id, "ernie-4.0-8k");
        assert_eq!(model.name, "ERNIE-4.0 (8K)");

        // 测试不存在的模型
        let non_existent = provider.get_model_info("non-existent-model");
        assert!(non_existent.is_none());
    }

    #[test]
    fn test_cache_support() {
        let config = create_test_config();
        let provider = WenxinPluginProvider::new(config);
        let models = provider.get_models();

        // 百度文心一言目前不支持缓存功能
        for model in models {
            assert!(!model.supports_cache);
            assert!(model.cache_reads_price.is_none());
            assert!(model.cache_writes_price.is_none());
        }
    }

    #[test]
    fn test_pricing_structure() {
        let config = create_test_config();
        let provider = WenxinPluginProvider::new(config);
        let models = provider.get_models();

        // 验证定价结构
        let ernie_4_0 = models.iter().find(|m| m.id == "ernie-4.0-8k").unwrap();
        assert!(ernie_4_0.input_price > 0.0);
        assert!(ernie_4_0.output_price > 0.0);
        assert!(ernie_4_0.output_price > ernie_4_0.input_price); // 输出价格通常高于输入

        let ernie_lite = models.iter().find(|m| m.id == "ernie-lite-8k").unwrap();
        assert_eq!(ernie_lite.input_price, 0.0); // 免费模型
        assert_eq!(ernie_lite.output_price, 0.0);
    }
}
