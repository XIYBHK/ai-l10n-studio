use crate::services::ai::model_info::ModelInfo;
use crate::services::ai::provider::AIProvider;

/// 字节跳动豆包 (Doubao) 插件供应商
/// 
/// 基于字节跳动火山引擎的 Doubao 系列模型
/// 特点：年轻化产品思维，擅长创意写作和对话交互
pub struct DoubaoPluginProvider {
    /// 插件配置（从 plugin.toml 加载）
    config: crate::services::ai::plugin_config::PluginConfig,
}

impl DoubaoPluginProvider {
    pub fn new(config: crate::services::ai::plugin_config::PluginConfig) -> Self {
        Self { config }
    }
}

impl AIProvider for DoubaoPluginProvider {
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
                name: "字节跳动豆包 (Doubao)".to_string(),
                id: "doubao".to_string(),
                version: "1.0.0".to_string(),
                api_version: "1.0".to_string(),
                description: "字节跳动豆包大模型，年轻化产品思维".to_string(),
                author: "AI L10n Studio".to_string(),
                homepage: Some("https://www.doubao.com".to_string()),
                license: Some("MIT".to_string()),
            },
            provider: ProviderPluginConfig {
                display_name: "豆包".to_string(),
                default_url: "https://ark.cn-beijing.volces.com/api/v3/chat/completions".to_string(),
                default_model: "doubao-pro-32k".to_string(),
                supports_cache: false,
                supports_images: true,
                models: vec![
                    ModelPluginConfig {
                        id: "doubao-pro-128k".to_string(),
                        name: "豆包Pro 128K".to_string(),
                        context_window: 128000,
                        max_output_tokens: 4096,
                        input_price: 2.50,
                        output_price: 7.50,
                        cache_reads_price: 0.0,
                        cache_writes_price: 0.0,
                        recommended: true,
                        description: Some("豆包Pro版本，128K上下文，最强理解与生成能力".to_string()),
                    },
                    ModelPluginConfig {
                        id: "doubao-lite-128k".to_string(),
                        name: "豆包Lite 128K".to_string(),
                        context_window: 128000,
                        max_output_tokens: 4096,
                        input_price: 0.83,
                        output_price: 2.50,
                        cache_reads_price: 0.0,
                        cache_writes_price: 0.0,
                        recommended: true,
                        description: Some("豆包Lite版本，128K上下文，高性价比".to_string()),
                    },
                    ModelPluginConfig {
                        id: "doubao-vision".to_string(),
                        name: "豆包Vision".to_string(),
                        context_window: 8000,
                        max_output_tokens: 2048,
                        input_price: 3.33,
                        output_price: 10.00,
                        cache_reads_price: 0.0,
                        cache_writes_price: 0.0,
                        recommended: false,
                        description: Some("豆包视觉版本，支持图像理解和分析".to_string()),
                    },
                ],
            },
        }
    }

    #[test]
    fn test_doubao_provider_basic_info() {
        let config = create_test_config();
        let provider = DoubaoPluginProvider::new(config);

        assert_eq!(provider.id(), "doubao");
        assert_eq!(provider.display_name(), "豆包");
        assert_eq!(provider.default_model(), "doubao-pro-32k");
        assert_eq!(
            provider.default_url(),
            "https://ark.cn-beijing.volces.com/api/v3/chat/completions"
        );
    }

    #[test]
    fn test_doubao_models() {
        let config = create_test_config();
        let provider = DoubaoPluginProvider::new(config);
        let models = provider.get_models();

        assert_eq!(models.len(), 3);

        // 测试最强模型 Doubao Pro 128K
        let doubao_pro = models.iter().find(|m| m.id == "doubao-pro-128k").unwrap();
        assert_eq!(doubao_pro.name, "豆包Pro 128K");
        assert_eq!(doubao_pro.provider, "豆包");
        assert_eq!(doubao_pro.context_window, 128000);
        assert_eq!(doubao_pro.max_output_tokens, 4096);
        assert_eq!(doubao_pro.input_price, 2.50);
        assert_eq!(doubao_pro.output_price, 7.50);
        assert!(!doubao_pro.supports_cache);
        assert!(doubao_pro.supports_images);
        assert!(doubao_pro.recommended);

        // 测试高性价比模型 Doubao Lite 128K
        let doubao_lite = models.iter().find(|m| m.id == "doubao-lite-128k").unwrap();
        assert_eq!(doubao_lite.name, "豆包Lite 128K");
        assert_eq!(doubao_lite.input_price, 0.83);
        assert_eq!(doubao_lite.output_price, 2.50);
        assert!(doubao_lite.recommended);

        // 测试多模态模型 Doubao Vision
        let doubao_vision = models.iter().find(|m| m.id == "doubao-vision").unwrap();
        assert_eq!(doubao_vision.name, "豆包Vision");
        assert_eq!(doubao_vision.context_window, 8000); // 视觉模型上下文较小
        assert_eq!(doubao_vision.input_price, 3.33);
        assert_eq!(doubao_vision.output_price, 10.00);
        assert!(!doubao_vision.recommended); // 专用模型，非通用推荐
    }

    #[test]
    fn test_get_model_info() {
        let config = create_test_config();
        let provider = DoubaoPluginProvider::new(config);

        // 测试存在的模型
        let model_info = provider.get_model_info("doubao-pro-128k");
        assert!(model_info.is_some());
        let model = model_info.unwrap();
        assert_eq!(model.id, "doubao-pro-128k");
        assert_eq!(model.name, "豆包Pro 128K");

        // 测试不存在的模型
        let non_existent = provider.get_model_info("non-existent-model");
        assert!(non_existent.is_none());
    }

    #[test]
    fn test_cache_support() {
        let config = create_test_config();
        let provider = DoubaoPluginProvider::new(config);
        let models = provider.get_models();

        // 豆包目前不支持缓存功能
        for model in models {
            assert!(!model.supports_cache);
            assert!(model.cache_reads_price.is_none());
            assert!(model.cache_writes_price.is_none());
        }
    }

    #[test]
    fn test_bytedance_volc_engine() {
        let config = create_test_config();
        let provider = DoubaoPluginProvider::new(config);

        // 验证使用火山引擎API
        assert!(provider.default_url().contains("volces.com"));
        assert!(provider.default_url().contains("ark.cn-beijing"));
    }

    #[test]
    fn test_pricing_tiers() {
        let config = create_test_config();
        let provider = DoubaoPluginProvider::new(config);
        let models = provider.get_models();

        // 验证定价层次：Pro > Lite
        let doubao_pro = models.iter().find(|m| m.id == "doubao-pro-128k").unwrap();
        let doubao_lite = models.iter().find(|m| m.id == "doubao-lite-128k").unwrap();
        let doubao_vision = models.iter().find(|m| m.id == "doubao-vision").unwrap();

        // Pro版本价格中等
        assert_eq!(doubao_pro.input_price, 2.50);
        assert_eq!(doubao_pro.output_price, 7.50);

        // Lite版本价格最低
        assert_eq!(doubao_lite.input_price, 0.83);
        assert_eq!(doubao_lite.output_price, 2.50);
        assert!(doubao_lite.input_price < doubao_pro.input_price);

        // Vision版本价格最高
        assert_eq!(doubao_vision.input_price, 3.33);
        assert_eq!(doubao_vision.output_price, 10.00);
        assert!(doubao_vision.input_price > doubao_pro.input_price);
    }

    #[test]
    fn test_context_window_variants() {
        let config = create_test_config();
        let provider = DoubaoPluginProvider::new(config);
        let models = provider.get_models();

        // 验证不同模型的上下文窗口
        let doubao_pro = models.iter().find(|m| m.id == "doubao-pro-128k").unwrap();
        let doubao_lite = models.iter().find(|m| m.id == "doubao-lite-128k").unwrap();
        let doubao_vision = models.iter().find(|m| m.id == "doubao-vision").unwrap();

        assert_eq!(doubao_pro.context_window, 128000);   // 128K
        assert_eq!(doubao_lite.context_window, 128000);  // 128K
        assert_eq!(doubao_vision.context_window, 8000);  // 8K（多模态模型较小）
    }

    #[test]
    fn test_multimodal_capabilities() {
        let config = create_test_config();
        let provider = DoubaoPluginProvider::new(config);
        let models = provider.get_models();

        // 豆包支持多模态功能
        for model in models {
            assert!(model.supports_images);
        }

        // 验证Vision是专门的多模态模型
        let doubao_vision = models.iter().find(|m| m.id == "doubao-vision").unwrap();
        assert!(doubao_vision.supports_images);
        assert!(doubao_vision.description.as_ref().unwrap().contains("图像"));
    }

    #[test]
    fn test_youth_oriented_design() {
        let config = create_test_config();
        let _provider = DoubaoPluginProvider::new(config.clone());

        // 验证豆包的年轻化产品定位
        assert_eq!(config.provider.display_name, "豆包");
        assert!(config.plugin.description.contains("年轻化"));
        assert!(config.plugin.homepage.unwrap().contains("doubao.com"));
    }

    #[test]
    fn test_creative_capabilities() {
        let config = create_test_config();
        let _provider = DoubaoPluginProvider::new(config.clone());

        // 验证豆包在创意写作方面的特长
        assert!(config.plugin.description.contains("创意"));
        assert!(config.plugin.description.contains("对话交互"));
    }
}
