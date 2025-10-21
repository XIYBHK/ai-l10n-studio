use crate::services::ai::model_info::ModelInfo;
use crate::services::ai::provider::AIProvider;

/// 阿里通义千问 (Qwen) 插件供应商
/// 
/// 基于阿里云DashScope平台的 Qwen 系列大模型
/// 特点：多语言理解与生成能力优秀，支持长文本和多模态
pub struct QianwenPluginProvider {
    /// 插件配置（从 plugin.toml 加载）
    config: crate::services::ai::plugin_config::PluginConfig,
}

impl QianwenPluginProvider {
    pub fn new(config: crate::services::ai::plugin_config::PluginConfig) -> Self {
        Self { config }
    }
}

impl AIProvider for QianwenPluginProvider {
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
                name: "阿里通义千问 (Qwen)".to_string(),
                id: "qianwen".to_string(),
                version: "2.5.0".to_string(),
                api_version: "1.0".to_string(),
                description: "阿里巴巴通义千问大模型，多语言理解与生成能力优秀".to_string(),
                author: "AI L10n Studio".to_string(),
                homepage: Some("https://tongyi.aliyun.com".to_string()),
                license: Some("MIT".to_string()),
            },
            provider: ProviderPluginConfig {
                display_name: "通义千问".to_string(),
                default_url: "https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation".to_string(),
                default_model: "qwen2.5-72b-instruct".to_string(),
                supports_cache: false,
                supports_images: true,
                models: vec![
                    ModelPluginConfig {
                        id: "qwen2.5-72b-instruct".to_string(),
                        name: "Qwen2.5-72B-Instruct".to_string(),
                        context_window: 32768,
                        max_output_tokens: 8192,
                        input_price: 2.00,
                        output_price: 6.00,
                        cache_reads_price: 0.0,
                        cache_writes_price: 0.0,
                        recommended: true,
                        description: Some("通义千问2.5最强版本，720亿参数，32K上下文".to_string()),
                    },
                    ModelPluginConfig {
                        id: "qwen-max".to_string(),
                        name: "Qwen Max".to_string(),
                        context_window: 30000,
                        max_output_tokens: 8000,
                        input_price: 4.00,
                        output_price: 12.00,
                        cache_reads_price: 0.0,
                        cache_writes_price: 0.0,
                        recommended: true,
                        description: Some("通义千问Max版本，最高质量模型".to_string()),
                    },
                    ModelPluginConfig {
                        id: "qwen-long".to_string(),
                        name: "Qwen Long".to_string(),
                        context_window: 1000000,
                        max_output_tokens: 8192,
                        input_price: 0.50,
                        output_price: 2.00,
                        cache_reads_price: 0.0,
                        cache_writes_price: 0.0,
                        recommended: false,
                        description: Some("通义千问Long版本，100万token超长上下文".to_string()),
                    },
                ],
            },
        }
    }

    #[test]
    fn test_qianwen_provider_basic_info() {
        let config = create_test_config();
        let provider = QianwenPluginProvider::new(config);

        assert_eq!(provider.id(), "qianwen");
        assert_eq!(provider.display_name(), "通义千问");
        assert_eq!(provider.default_model(), "qwen2.5-72b-instruct");
        assert_eq!(
            provider.default_url(),
            "https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation"
        );
    }

    #[test]
    fn test_qianwen_models() {
        let config = create_test_config();
        let provider = QianwenPluginProvider::new(config);
        let models = provider.get_models();

        assert_eq!(models.len(), 3);

        // 测试最强模型 Qwen2.5-72B
        let qwen_72b = models.iter().find(|m| m.id == "qwen2.5-72b-instruct").unwrap();
        assert_eq!(qwen_72b.name, "Qwen2.5-72B-Instruct");
        assert_eq!(qwen_72b.provider, "通义千问");
        assert_eq!(qwen_72b.context_window, 32768);
        assert_eq!(qwen_72b.max_output_tokens, 8192);
        assert_eq!(qwen_72b.input_price, 2.00);
        assert_eq!(qwen_72b.output_price, 6.00);
        assert!(!qwen_72b.supports_cache);
        assert!(qwen_72b.supports_images);
        assert!(qwen_72b.recommended);

        // 测试最高质量模型 Qwen Max
        let qwen_max = models.iter().find(|m| m.id == "qwen-max").unwrap();
        assert_eq!(qwen_max.name, "Qwen Max");
        assert_eq!(qwen_max.input_price, 4.00);
        assert_eq!(qwen_max.output_price, 12.00);
        assert!(qwen_max.recommended);

        // 测试长文本模型 Qwen Long
        let qwen_long = models.iter().find(|m| m.id == "qwen-long").unwrap();
        assert_eq!(qwen_long.name, "Qwen Long");
        assert_eq!(qwen_long.context_window, 1000000); // 100万token超长上下文
        assert_eq!(qwen_long.input_price, 0.50);
        assert_eq!(qwen_long.output_price, 2.00);
        assert!(!qwen_long.recommended); // 专用模型，非推荐
    }

    #[test]
    fn test_get_model_info() {
        let config = create_test_config();
        let provider = QianwenPluginProvider::new(config);

        // 测试存在的模型
        let model_info = provider.get_model_info("qwen2.5-72b-instruct");
        assert!(model_info.is_some());
        let model = model_info.unwrap();
        assert_eq!(model.id, "qwen2.5-72b-instruct");
        assert_eq!(model.name, "Qwen2.5-72B-Instruct");

        // 测试不存在的模型
        let non_existent = provider.get_model_info("non-existent-model");
        assert!(non_existent.is_none());
    }

    #[test]
    fn test_cache_support() {
        let config = create_test_config();
        let provider = QianwenPluginProvider::new(config);
        let models = provider.get_models();

        // 通义千问目前不支持缓存功能
        for model in models {
            assert!(!model.supports_cache);
            assert!(model.cache_reads_price.is_none());
            assert!(model.cache_writes_price.is_none());
        }
    }

    #[test]
    fn test_context_window_variants() {
        let config = create_test_config();
        let provider = QianwenPluginProvider::new(config);
        let models = provider.get_models();

        // 验证不同模型的上下文窗口大小
        let qwen_72b = models.iter().find(|m| m.id == "qwen2.5-72b-instruct").unwrap();
        assert_eq!(qwen_72b.context_window, 32768); // 32K

        let qwen_max = models.iter().find(|m| m.id == "qwen-max").unwrap();
        assert_eq!(qwen_max.context_window, 30000); // 30K

        let qwen_long = models.iter().find(|m| m.id == "qwen-long").unwrap();
        assert_eq!(qwen_long.context_window, 1000000); // 100万token
    }

    #[test]
    fn test_pricing_structure() {
        let config = create_test_config();
        let provider = QianwenPluginProvider::new(config);
        let models = provider.get_models();

        // 验证定价结构：输出价格通常高于输入价格
        for model in models {
            assert!(model.input_price >= 0.0);
            assert!(model.output_price >= 0.0);
            if model.input_price > 0.0 {
                assert!(model.output_price >= model.input_price);
            }
        }

        // 验证高质量模型价格更高
        let qwen_max = models.iter().find(|m| m.id == "qwen-max").unwrap();
        let qwen_long = models.iter().find(|m| m.id == "qwen-long").unwrap();
        assert!(qwen_max.input_price > qwen_long.input_price); // Max模型价格更高
    }

    #[test]
    fn test_multimodal_support() {
        let config = create_test_config();
        let provider = QianwenPluginProvider::new(config);
        let models = provider.get_models();

        // 通义千问支持多模态（图像）
        for model in models {
            assert!(model.supports_images);
        }
    }
}
