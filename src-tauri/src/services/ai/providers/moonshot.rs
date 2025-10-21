use super::super::provider::AIProvider;
use super::super::ModelInfo;

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
        "moonshot-v1-auto"
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
        assert_eq!(provider.default_model(), "moonshot-v1-auto");
    }

    #[test]
    fn test_moonshot_models() {
        let provider = MoonshotProvider;
        let models = provider.get_models();
        
        // 验证有模型返回
        assert!(!models.is_empty());
        
        // 验证包含默认模型
        assert!(provider.supports_model("moonshot-v1-auto"));
        
        // 验证kimi-latest模型
        assert!(provider.supports_model("kimi-latest"));
        
        // 验证模型信息
        let auto_model = provider.get_model_info("moonshot-v1-auto").unwrap();
        assert_eq!(auto_model.provider, "Moonshot AI");
        assert!(auto_model.supports_cache);
    }
}
