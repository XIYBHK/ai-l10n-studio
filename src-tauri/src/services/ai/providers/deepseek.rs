use super::super::ModelInfo;
use super::super::provider::AIProvider;

/// DeepSeek AI 供应商实现
///
/// DeepSeek V3.2-Exp 系列，支持硬盘缓存，性价比极高
/// 官方文档：https://api-docs.deepseek.com/zh-cn/quick_start/pricing/
pub struct DeepSeekProvider;

impl AIProvider for DeepSeekProvider {
    fn id(&self) -> &'static str {
        "deepseek"
    }

    fn display_name(&self) -> &'static str {
        "DeepSeek AI"
    }

    fn default_url(&self) -> &'static str {
        "https://api.deepseek.com/v1"
    }

    fn default_model(&self) -> &'static str {
        "deepseek-chat"
    }

    fn get_models(&self) -> Vec<ModelInfo> {
        use crate::services::ai::models;
        models::get_deepseek_models()
    }
}

/// 创建 DeepSeek 供应商实例
pub fn create_deepseek_provider() -> DeepSeekProvider {
    DeepSeekProvider
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_deepseek_provider_info() {
        let provider = DeepSeekProvider;

        assert_eq!(provider.id(), "deepseek");
        assert_eq!(provider.display_name(), "DeepSeek AI");
        assert_eq!(provider.default_url(), "https://api.deepseek.com/v1");
        assert_eq!(provider.default_model(), "deepseek-chat");
    }

    #[test]
    fn test_deepseek_models() {
        let provider = DeepSeekProvider;
        let models = provider.get_models();

        // 验证有模型返回
        assert!(!models.is_empty());

        // 验证包含默认模型
        assert!(provider.supports_model("deepseek-chat"));

        // 验证模型信息
        let chat_model = provider.get_model_info("deepseek-chat").unwrap();
        assert_eq!(chat_model.provider, "DeepSeek");
        assert!(chat_model.supports_cache);
    }
}
