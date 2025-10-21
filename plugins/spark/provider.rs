use crate::services::ai::model_info::ModelInfo;
use crate::services::ai::provider::AIProvider;

/// 讯飞星火 (SparkDesk) 插件供应商
/// 
/// 基于科大讯飞星火认知大模型
/// 特点：中文理解能力出色，语音识别与合成技术领先
pub struct SparkPluginProvider {
    /// 插件配置（从 plugin.toml 加载）
    config: crate::services::ai::plugin_config::PluginConfig,
}

impl SparkPluginProvider {
    pub fn new(config: crate::services::ai::plugin_config::PluginConfig) -> Self {
        Self { config }
    }
}

impl AIProvider for SparkPluginProvider {
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
                name: "讯飞星火 (SparkDesk)".to_string(),
                id: "spark".to_string(),
                version: "4.0.0".to_string(),
                api_version: "1.0".to_string(),
                description: "科大讯飞星火认知大模型，中文理解能力出色".to_string(),
                author: "AI L10n Studio".to_string(),
                homepage: Some("https://xinghuo.xfyun.cn".to_string()),
                license: Some("MIT".to_string()),
            },
            provider: ProviderPluginConfig {
                display_name: "讯飞星火".to_string(),
                default_url: "wss://spark-api.xf-yun.com/v4.0/chat".to_string(),
                default_model: "spark4.0-ultra".to_string(),
                supports_cache: false,
                supports_images: true,
                models: vec![
                    ModelPluginConfig {
                        id: "spark4.0-ultra".to_string(),
                        name: "星火4.0 Ultra".to_string(),
                        context_window: 128000,
                        max_output_tokens: 8192,
                        input_price: 3.33,
                        output_price: 10.00,
                        cache_reads_price: 0.0,
                        cache_writes_price: 0.0,
                        recommended: true,
                        description: Some("星火4.0 Ultra版本，128K上下文，最强推理与创作能力".to_string()),
                    },
                    ModelPluginConfig {
                        id: "spark4.0-max".to_string(),
                        name: "星火4.0 Max".to_string(),
                        context_window: 128000,
                        max_output_tokens: 8192,
                        input_price: 2.67,
                        output_price: 8.00,
                        cache_reads_price: 0.0,
                        cache_writes_price: 0.0,
                        recommended: true,
                        description: Some("星火4.0 Max版本，128K上下文，高质量对话与生成".to_string()),
                    },
                    ModelPluginConfig {
                        id: "spark-lite".to_string(),
                        name: "星火Lite".to_string(),
                        context_window: 4000,
                        max_output_tokens: 1024,
                        input_price: 0.17,
                        output_price: 0.50,
                        cache_reads_price: 0.0,
                        cache_writes_price: 0.0,
                        recommended: false,
                        description: Some("星火Lite版本，4K上下文，轻量快速".to_string()),
                    },
                ],
            },
        }
    }

    #[test]
    fn test_spark_provider_basic_info() {
        let config = create_test_config();
        let provider = SparkPluginProvider::new(config);

        assert_eq!(provider.id(), "spark");
        assert_eq!(provider.display_name(), "讯飞星火");
        assert_eq!(provider.default_model(), "spark4.0-ultra");
        assert_eq!(
            provider.default_url(),
            "wss://spark-api.xf-yun.com/v4.0/chat"
        );
    }

    #[test]
    fn test_spark_models() {
        let config = create_test_config();
        let provider = SparkPluginProvider::new(config);
        let models = provider.get_models();

        assert_eq!(models.len(), 3);

        // 测试最强模型 Spark4.0 Ultra
        let spark_ultra = models.iter().find(|m| m.id == "spark4.0-ultra").unwrap();
        assert_eq!(spark_ultra.name, "星火4.0 Ultra");
        assert_eq!(spark_ultra.provider, "讯飞星火");
        assert_eq!(spark_ultra.context_window, 128000);
        assert_eq!(spark_ultra.max_output_tokens, 8192);
        assert_eq!(spark_ultra.input_price, 3.33);
        assert_eq!(spark_ultra.output_price, 10.00);
        assert!(!spark_ultra.supports_cache);
        assert!(spark_ultra.supports_images);
        assert!(spark_ultra.recommended);

        // 测试高质量模型 Spark4.0 Max
        let spark_max = models.iter().find(|m| m.id == "spark4.0-max").unwrap();
        assert_eq!(spark_max.name, "星火4.0 Max");
        assert_eq!(spark_max.input_price, 2.67);
        assert_eq!(spark_max.output_price, 8.00);
        assert!(spark_max.recommended);

        // 测试轻量模型 Spark Lite
        let spark_lite = models.iter().find(|m| m.id == "spark-lite").unwrap();
        assert_eq!(spark_lite.name, "星火Lite");
        assert_eq!(spark_lite.context_window, 4000); // 轻量模型上下文较小
        assert_eq!(spark_lite.input_price, 0.17);
        assert_eq!(spark_lite.output_price, 0.50);
        assert!(!spark_lite.recommended); // 轻量版不作为默认推荐
    }

    #[test]
    fn test_get_model_info() {
        let config = create_test_config();
        let provider = SparkPluginProvider::new(config);

        // 测试存在的模型
        let model_info = provider.get_model_info("spark4.0-ultra");
        assert!(model_info.is_some());
        let model = model_info.unwrap();
        assert_eq!(model.id, "spark4.0-ultra");
        assert_eq!(model.name, "星火4.0 Ultra");

        // 测试不存在的模型
        let non_existent = provider.get_model_info("non-existent-model");
        assert!(non_existent.is_none());
    }

    #[test]
    fn test_cache_support() {
        let config = create_test_config();
        let provider = SparkPluginProvider::new(config);
        let models = provider.get_models();

        // 讯飞星火目前不支持缓存功能
        for model in models {
            assert!(!model.supports_cache);
            assert!(model.cache_reads_price.is_none());
            assert!(model.cache_writes_price.is_none());
        }
    }

    #[test]
    fn test_websocket_api() {
        let config = create_test_config();
        let provider = SparkPluginProvider::new(config);

        // 验证讯飞星火使用WebSocket API
        assert!(provider.default_url().starts_with("wss://"));
        assert!(provider.default_url().contains("spark-api.xf-yun.com"));
    }

    #[test]
    fn test_context_window_tiers() {
        let config = create_test_config();
        let provider = SparkPluginProvider::new(config);
        let models = provider.get_models();

        // 验证不同模型的上下文窗口层次
        let spark_ultra = models.iter().find(|m| m.id == "spark4.0-ultra").unwrap();
        let spark_max = models.iter().find(|m| m.id == "spark4.0-max").unwrap();
        let spark_lite = models.iter().find(|m| m.id == "spark-lite").unwrap();

        assert_eq!(spark_ultra.context_window, 128000); // 128K
        assert_eq!(spark_max.context_window, 128000);   // 128K
        assert_eq!(spark_lite.context_window, 4000);    // 4K

        // 轻量版上下文明显较小
        assert!(spark_lite.context_window < spark_ultra.context_window);
        assert!(spark_lite.context_window < spark_max.context_window);
    }

    #[test]
    fn test_pricing_structure() {
        let config = create_test_config();
        let provider = SparkPluginProvider::new(config);
        let models = provider.get_models();

        // 验证定价结构：输出价格通常高于输入价格
        for model in models {
            assert!(model.input_price >= 0.0);
            assert!(model.output_price >= 0.0);
            assert!(model.output_price >= model.input_price);
        }

        // 验证模型价格层次：Ultra >= Max > Lite
        let spark_ultra = models.iter().find(|m| m.id == "spark4.0-ultra").unwrap();
        let spark_max = models.iter().find(|m| m.id == "spark4.0-max").unwrap();
        let spark_lite = models.iter().find(|m| m.id == "spark-lite").unwrap();

        assert!(spark_ultra.input_price >= spark_max.input_price);
        assert!(spark_max.input_price > spark_lite.input_price);
        assert!(spark_ultra.output_price >= spark_max.output_price);
        assert!(spark_max.output_price > spark_lite.output_price);
    }

    #[test]
    fn test_chinese_capabilities() {
        let config = create_test_config();
        let provider = SparkPluginProvider::new(config);

        // 验证讯飞星火专注于中文处理
        assert_eq!(provider.display_name(), "讯飞星火");
        assert!(config.plugin.description.contains("中文"));
        assert!(config.plugin.homepage.unwrap().contains("xinghuo.xfyun.cn"));
    }

    #[test]
    fn test_multimodal_support() {
        let config = create_test_config();
        let provider = SparkPluginProvider::new(config);
        let models = provider.get_models();

        // 讯飞星火支持多模态功能
        for model in models {
            assert!(model.supports_images);
        }
    }

    #[test]
    fn test_voice_technology_focus() {
        let config = create_test_config();
        let _provider = SparkPluginProvider::new(config.clone());

        // 验证讯飞在语音技术方面的专长
        assert!(config.plugin.description.contains("语音"));
        assert!(config.plugin.homepage.unwrap().contains("xfyun"));
    }
}
