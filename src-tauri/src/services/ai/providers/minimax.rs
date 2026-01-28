use super::super::ModelInfo;
use super::super::provider::AIProvider;

/// MiniMax 供应商实现
///
/// M2 系列，高性价比，长上下文支持
/// 官方文档：https://platform.minimax.io/docs/guides/quickstart
pub struct MiniMaxProvider;

impl AIProvider for MiniMaxProvider {
    fn id(&self) -> &'static str {
        "minimax"
    }

    fn display_name(&self) -> &'static str {
        "MiniMax"
    }

    fn default_url(&self) -> &'static str {
        "https://api.minimax.io/anthropic/v1"
    }

    fn default_model(&self) -> &'static str {
        "MiniMax-M2.1"
    }

    fn get_models(&self) -> Vec<ModelInfo> {
        use crate::services::ai::models;
        models::get_minimax_models()
    }
}

/// 创建 MiniMax 供应商实例
pub fn create_minimax_provider() -> MiniMaxProvider {
    MiniMaxProvider
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_minimax_provider_info() {
        let provider = MiniMaxProvider;

        assert_eq!(provider.id(), "minimax");
        assert_eq!(provider.display_name(), "MiniMax");
        assert_eq!(
            provider.default_url(),
            "https://api.minimax.io/anthropic/v1"
        );
        assert_eq!(provider.default_model(), "MiniMax-M2.1");
    }

    #[test]
    fn test_minimax_models() {
        let provider = MiniMaxProvider;
        let models = provider.get_models();

        // 验证有模型返回
        assert!(!models.is_empty());

        // 验证包含默认模型
        assert!(provider.supports_model("MiniMax-M2.1"));

        // 验证模型信息
        let m2_model = provider.get_model_info("MiniMax-M2.1").unwrap();
        assert_eq!(m2_model.provider, "MiniMax");
        assert_eq!(m2_model.input_price, 0.3);
        assert_eq!(m2_model.output_price, 1.2);
        assert!(m2_model.recommended);
    }
}
