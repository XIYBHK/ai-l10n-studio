use crate::services::ai::model_info::ModelInfo;
use crate::services::ai::provider::AIProvider;

/// 智谱AI (GLM) 插件供应商
/// 
/// 基于智谱AI平台的 GLM 系列大模型
/// 特点：中英双语能力优秀，支持多模态和长文本处理
pub struct ZhipuPluginProvider {
    /// 插件配置（从 plugin.toml 加载）
    config: crate::services::ai::plugin_config::PluginConfig,
}

impl ZhipuPluginProvider {
    pub fn new(config: crate::services::ai::plugin_config::PluginConfig) -> Self {
        Self { config }
    }
}

impl AIProvider for ZhipuPluginProvider {
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
                name: "智谱AI (GLM)".to_string(),
                id: "zhipu".to_string(),
                version: "4.0.0".to_string(),
                api_version: "1.0".to_string(),
                description: "智谱AI GLM大模型，中英双语能力优秀".to_string(),
                author: "AI L10n Studio".to_string(),
                homepage: Some("https://www.zhipuai.cn".to_string()),
                license: Some("MIT".to_string()),
            },
            provider: ProviderPluginConfig {
                display_name: "智谱AI".to_string(),
                default_url: "https://open.bigmodel.cn/api/paas/v4/chat/completions".to_string(),
                default_model: "glm-4-plus".to_string(),
                supports_cache: false,
                supports_images: true,
                models: vec![
                    ModelPluginConfig {
                        id: "glm-4-plus".to_string(),
                        name: "GLM-4 Plus".to_string(),
                        context_window: 128000,
                        max_output_tokens: 4096,
                        input_price: 3.33,
                        output_price: 10.00,
                        cache_reads_price: 0.0,
                        cache_writes_price: 0.0,
                        recommended: true,
                        description: Some("GLM-4最强版本，128K上下文，顶级推理与创作能力".to_string()),
                    },
                    ModelPluginConfig {
                        id: "glm-4-air".to_string(),
                        name: "GLM-4 Air".to_string(),
                        context_window: 128000,
                        max_output_tokens: 4096,
                        input_price: 0.33,
                        output_price: 1.00,
                        cache_reads_price: 0.0,
                        cache_writes_price: 0.0,
                        recommended: true,
                        description: Some("GLM-4轻量版，128K上下文，高性价比".to_string()),
                    },
                    ModelPluginConfig {
                        id: "glm-4v".to_string(),
                        name: "GLM-4V".to_string(),
                        context_window: 2048,
                        max_output_tokens: 1024,
                        input_price: 10.00,
                        output_price: 30.00,
                        cache_reads_price: 0.0,
                        cache_writes_price: 0.0,
                        recommended: false,
                        description: Some("GLM-4视觉版本，支持图像理解和分析".to_string()),
                    },
                ],
            },
        }
    }

    #[test]
    fn test_zhipu_provider_basic_info() {
        let config = create_test_config();
        let provider = ZhipuPluginProvider::new(config);

        assert_eq!(provider.id(), "zhipu");
        assert_eq!(provider.display_name(), "智谱AI");
        assert_eq!(provider.default_model(), "glm-4-plus");
        assert_eq!(
            provider.default_url(),
            "https://open.bigmodel.cn/api/paas/v4/chat/completions"
        );
    }

    #[test]
    fn test_zhipu_models() {
        let config = create_test_config();
        let provider = ZhipuPluginProvider::new(config);
        let models = provider.get_models();

        assert_eq!(models.len(), 3);

        // 测试最强模型 GLM-4 Plus
        let glm_4_plus = models.iter().find(|m| m.id == "glm-4-plus").unwrap();
        assert_eq!(glm_4_plus.name, "GLM-4 Plus");
        assert_eq!(glm_4_plus.provider, "智谱AI");
        assert_eq!(glm_4_plus.context_window, 128000);
        assert_eq!(glm_4_plus.max_output_tokens, 4096);
        assert_eq!(glm_4_plus.input_price, 3.33);
        assert_eq!(glm_4_plus.output_price, 10.00);
        assert!(!glm_4_plus.supports_cache);
        assert!(glm_4_plus.supports_images);
        assert!(glm_4_plus.recommended);

        // 测试高性价比模型 GLM-4 Air
        let glm_4_air = models.iter().find(|m| m.id == "glm-4-air").unwrap();
        assert_eq!(glm_4_air.name, "GLM-4 Air");
        assert_eq!(glm_4_air.input_price, 0.33);
        assert_eq!(glm_4_air.output_price, 1.00);
        assert!(glm_4_air.recommended);

        // 测试多模态模型 GLM-4V
        let glm_4v = models.iter().find(|m| m.id == "glm-4v").unwrap();
        assert_eq!(glm_4v.name, "GLM-4V");
        assert_eq!(glm_4v.context_window, 2048); // 视觉模型上下文较小
        assert_eq!(glm_4v.input_price, 10.00); // 多模态模型价格更高
        assert_eq!(glm_4v.output_price, 30.00);
        assert!(!glm_4v.recommended); // 专用模型，非通用推荐
    }

    #[test]
    fn test_get_model_info() {
        let config = create_test_config();
        let provider = ZhipuPluginProvider::new(config);

        // 测试存在的模型
        let model_info = provider.get_model_info("glm-4-plus");
        assert!(model_info.is_some());
        let model = model_info.unwrap();
        assert_eq!(model.id, "glm-4-plus");
        assert_eq!(model.name, "GLM-4 Plus");

        // 测试不存在的模型
        let non_existent = provider.get_model_info("non-existent-model");
        assert!(non_existent.is_none());
    }

    #[test]
    fn test_cache_support() {
        let config = create_test_config();
        let provider = ZhipuPluginProvider::new(config);
        let models = provider.get_models();

        // 智谱AI目前不支持缓存功能
        for model in models {
            assert!(!model.supports_cache);
            assert!(model.cache_reads_price.is_none());
            assert!(model.cache_writes_price.is_none());
        }
    }

    #[test]
    fn test_context_window_variants() {
        let config = create_test_config();
        let provider = ZhipuPluginProvider::new(config);
        let models = provider.get_models();

        // 验证不同模型的上下文窗口大小
        let glm_4_plus = models.iter().find(|m| m.id == "glm-4-plus").unwrap();
        assert_eq!(glm_4_plus.context_window, 128000); // 128K上下文

        let glm_4_air = models.iter().find(|m| m.id == "glm-4-air").unwrap();
        assert_eq!(glm_4_air.context_window, 128000); // 128K上下文

        let glm_4v = models.iter().find(|m| m.id == "glm-4v").unwrap();
        assert_eq!(glm_4v.context_window, 2048); // 多模态模型上下文较小
    }

    #[test]
    fn test_pricing_tiers() {
        let config = create_test_config();
        let provider = ZhipuPluginProvider::new(config);
        let models = provider.get_models();

        // 验证定价层次：Plus > Air > 其他
        let glm_4_plus = models.iter().find(|m| m.id == "glm-4-plus").unwrap();
        let glm_4_air = models.iter().find(|m| m.id == "glm-4-air").unwrap();
        let glm_4v = models.iter().find(|m| m.id == "glm-4v").unwrap();

        // Plus版本价格中等
        assert_eq!(glm_4_plus.input_price, 3.33);
        assert_eq!(glm_4_plus.output_price, 10.00);

        // Air版本价格最低
        assert_eq!(glm_4_air.input_price, 0.33);
        assert_eq!(glm_4_air.output_price, 1.00);
        assert!(glm_4_air.input_price < glm_4_plus.input_price);

        // 视觉模型价格最高
        assert_eq!(glm_4v.input_price, 10.00);
        assert_eq!(glm_4v.output_price, 30.00);
        assert!(glm_4v.input_price > glm_4_plus.input_price);
    }

    #[test]
    fn test_multimodal_capabilities() {
        let config = create_test_config();
        let provider = ZhipuPluginProvider::new(config);
        let models = provider.get_models();

        // 智谱AI支持多模态（通过GLM-4V等模型）
        for model in models {
            assert!(model.supports_images);
        }

        // 验证GLM-4V是专门的多模态模型
        let glm_4v = models.iter().find(|m| m.id == "glm-4v").unwrap();
        assert!(glm_4v.supports_images);
        assert!(glm_4v.description.as_ref().unwrap().contains("图像"));
    }

    #[test]
    fn test_bilingual_capabilities() {
        let config = create_test_config();
        let provider = ZhipuPluginProvider::new(config);

        // 验证智谱AI是中英双语模型
        assert_eq!(provider.display_name(), "智谱AI");
        assert!(config.plugin.description.contains("中英双语"));
    }
}
