use super::super::provider::AIProvider;
use super::super::ModelInfo;

/// OpenAI 供应商实现
/// 
/// GPT 系列模型，包括 GPT-4o 和 GPT-4o-mini
/// 支持视觉理解和上下文缓存
pub struct OpenAIProvider;

impl AIProvider for OpenAIProvider {
    fn id(&self) -> &'static str {
        "openai"
    }
    
    fn display_name(&self) -> &'static str {
        "OpenAI"
    }
    
    fn default_url(&self) -> &'static str {
        "https://api.openai.com/v1"
    }
    
    fn default_model(&self) -> &'static str {
        "gpt-4o-mini"
    }
    
    fn get_models(&self) -> Vec<ModelInfo> {
        use crate::services::ai::models;
        models::get_openai_models()
    }
}

/// 创建 OpenAI 供应商实例
pub fn create_openai_provider() -> OpenAIProvider {
    OpenAIProvider
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_openai_provider_info() {
        let provider = OpenAIProvider;
        
        assert_eq!(provider.id(), "openai");
        assert_eq!(provider.display_name(), "OpenAI");
        assert_eq!(provider.default_url(), "https://api.openai.com/v1");
        assert_eq!(provider.default_model(), "gpt-4o-mini");
    }

    #[test]
    fn test_openai_models() {
        let provider = OpenAIProvider;
        let models = provider.get_models();
        
        // 验证有模型返回
        assert!(!models.is_empty());
        
        // 验证包含默认模型
        assert!(provider.supports_model("gpt-4o-mini"));
        
        // 验证包含其他主要模型
        assert!(provider.supports_model("gpt-4o"));
        
        // 验证模型信息
        let mini_model = provider.get_model_info("gpt-4o-mini").unwrap();
        assert_eq!(mini_model.provider, "OpenAI");
        assert!(mini_model.supports_cache);
        assert!(mini_model.supports_images);
    }
}
