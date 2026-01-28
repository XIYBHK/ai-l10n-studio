use super::super::ModelInfo;
use super::super::provider::AIProvider;

/// 智谱AI 供应商实现
///
/// GLM 系列模型，开源免费，中文优化
/// 官方文档：https://open.bigmodel.cn/dev/api
pub struct ZhipuAIProvider;

impl AIProvider for ZhipuAIProvider {
    fn id(&self) -> &'static str {
        "zhipuai"
    }

    fn display_name(&self) -> &'static str {
        "智谱AI"
    }

    fn default_url(&self) -> &'static str {
        "https://open.bigmodel.cn/api/paas/v4"
    }

    fn default_model(&self) -> &'static str {
        "glm-4.7-flash"
    }

    fn get_models(&self) -> Vec<ModelInfo> {
        use crate::services::ai::models;
        models::get_zhipuai_models()
    }
}

/// 创建智谱AI供应商实例
pub fn create_zhipuai_provider() -> ZhipuAIProvider {
    ZhipuAIProvider
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_zhipuai_provider_info() {
        let provider = ZhipuAIProvider;

        assert_eq!(provider.id(), "zhipuai");
        assert_eq!(provider.display_name(), "智谱AI");
        assert_eq!(provider.default_url(), "https://open.bigmodel.cn/api/paas/v4");
        assert_eq!(provider.default_model(), "glm-4.7-flash");
    }

    #[test]
    fn test_zhipuai_models() {
        let provider = ZhipuAIProvider;
        let models = provider.get_models();

        // 验证有模型返回
        assert!(!models.is_empty());

        // 验证包含默认模型
        assert!(provider.supports_model("glm-4.7-flash"));

        // 验证 glm-4.5-flash 模型
        assert!(provider.supports_model("glm-4.5-flash"));

        // 验证模型信息
        let flash_model = provider.get_model_info("glm-4.7-flash").unwrap();
        assert_eq!(flash_model.provider, "智谱AI");
        assert_eq!(flash_model.input_price, 0.0); // 免费模型
        assert!(flash_model.supports_cache);
    }
}
