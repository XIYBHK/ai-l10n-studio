use super::super::ModelInfo;
use super::super::provider::AIProvider;

/// Moonshot AI 供应商实现
///
/// Kimi 系列模型，支持长上下文和Context Caching
/// 官方文档：https://platform.moonshot.cn/docs/overview
pub struct MoonshotProvider;

impl AIProvider for MoonshotProvider {
    fn id(&self) -> &'static str {
        "moonshot"
    }

    fn display_name(&self) -> &'static str {
        "Moonshot AI"
    }

    fn default_url(&self) -> &'static str {
        "https://api.moonshot.cn/v1"
    }

    fn default_model(&self) -> &'static str {
        "kimi-k2-0711-preview"
    }

    fn get_models(&self) -> Vec<ModelInfo> {
        use crate::services::ai::models;
        models::get_moonshot_models()
    }
}

/// 创建 Moonshot 供应商实例
pub fn create_moonshot_provider() -> MoonshotProvider {
    MoonshotProvider
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_moonshot_provider_info() {
        let provider = MoonshotProvider;

        assert_eq!(provider.id(), "moonshot");
        assert_eq!(provider.display_name(), "Moonshot AI");
        assert_eq!(provider.default_url(), "https://api.moonshot.cn/v1");
        assert_eq!(provider.default_model(), "kimi-k2-0711-preview");
    }

    #[test]
    fn test_moonshot_models() {
        let provider = MoonshotProvider;
        let models = provider.get_models();

        // 验证有模型返回
        assert!(!models.is_empty());

        // 验证包含默认模型
        assert!(provider.supports_model("kimi-k2-0711-preview"));

        // 验证kimi-k2-0711模型
        assert!(provider.supports_model("kimi-k2-0711-preview"));

        // 验证模型信息
        let k2_model = provider.get_model_info("kimi-k2-0905-preview").unwrap();
        assert_eq!(k2_model.provider, "Moonshot AI");
        assert!(k2_model.supports_cache);
    }
}
