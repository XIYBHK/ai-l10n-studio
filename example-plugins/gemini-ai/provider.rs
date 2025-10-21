/**
 * Google Gemini 供应商插件实现
 * 
 * 展示多模态 AI 模型的插件化实现，支持文本、图像和代码理解
 */

use super::super::super::provider::AIProvider;
use super::super::super::ModelInfo;

/// Google Gemini 供应商实现
pub struct GeminiProvider;

impl AIProvider for GeminiProvider {
    fn id(&self) -> &'static str {
        "gemini"
    }

    fn display_name(&self) -> &'static str {
        "Google Gemini"
    }

    fn default_url(&self) -> &'static str {
        "https://generativelanguage.googleapis.com/v1beta"
    }

    fn default_model(&self) -> &'static str {
        "gemini-1.5-flash"
    }

    fn get_models(&self) -> Vec<ModelInfo> {
        vec![
            // Gemini 1.5 Flash - 推荐的平衡模型
            ModelInfo {
                id: "gemini-1.5-flash".to_string(),
                name: "Gemini 1.5 Flash".to_string(),
                max_input_tokens: 1000000, // 1M tokens context
                max_output_tokens: 8192,
                input_price: 0.35,  // $0.35 per million tokens (input)
                output_price: 1.05, // $1.05 per million tokens (output)
                cache_reads_price: Some(0.035),  // $0.035 per million (90% discount)
                cache_writes_price: Some(0.44),  // $0.44 per million (25% premium)
                supports_cache: true,
                supports_images: true,
                recommended: true,
                description: Some("Google 最快的多模态模型，支持长上下文和缓存".to_string()),
            },
            
            // Gemini 1.5 Pro - 最强大的模型
            ModelInfo {
                id: "gemini-1.5-pro".to_string(),
                name: "Gemini 1.5 Pro".to_string(),
                max_input_tokens: 2000000, // 2M tokens context!
                max_output_tokens: 8192,
                input_price: 3.5,   // $3.5 per million tokens
                output_price: 10.5, // $10.5 per million tokens
                cache_reads_price: Some(0.35),   // $0.35 per million (90% discount)
                cache_writes_price: Some(4.38),  // $4.38 per million (25% premium)
                supports_cache: true,
                supports_images: true,
                recommended: false,
                description: Some("Google 最强大的多模态模型，超长上下文窗口".to_string()),
            },
            
            // Gemini 1.0 Pro - 经济版本
            ModelInfo {
                id: "gemini-1.0-pro".to_string(),
                name: "Gemini 1.0 Pro".to_string(),
                max_input_tokens: 30720,
                max_output_tokens: 2048,
                input_price: 0.5,   // $0.5 per million tokens
                output_price: 1.5,  // $1.5 per million tokens
                cache_reads_price: None, // 不支持缓存
                cache_writes_price: None,
                supports_cache: false,
                supports_images: false,
                recommended: false,
                description: Some("经济版 Gemini 模型，适合简单翻译任务".to_string()),
            },
            
            // Gemini 1.0 Pro Vision - 支持图像
            ModelInfo {
                id: "gemini-1.0-pro-vision".to_string(),
                name: "Gemini 1.0 Pro Vision".to_string(),
                max_input_tokens: 12288,
                max_output_tokens: 4096,
                input_price: 0.25,  // $0.25 per million tokens
                output_price: 0.5,  // $0.5 per million tokens
                cache_reads_price: None,
                cache_writes_price: None,
                supports_cache: false,
                supports_images: true,
                recommended: false,
                description: Some("支持图像理解的 Gemini 1.0 模型".to_string()),
            },
        ]
    }
}

/// 创建 Gemini 供应商实例
pub fn create_gemini_provider() -> GeminiProvider {
    GeminiProvider
}

/// Gemini 特有的配置和工具函数
pub mod gemini_utils {
    /// 生成配置结构体
    #[derive(Debug, Clone)]
    pub struct GeminiConfig {
        pub temperature: f32,
        pub top_k: u32,
        pub top_p: f32,
        pub max_output_tokens: u32,
    }
    
    impl Default for GeminiConfig {
        fn default() -> Self {
            Self {
                temperature: 0.7,
                top_k: 40,
                top_p: 0.95,
                max_output_tokens: 2048,
            }
        }
    }
    
    /// 安全设置类别
    #[derive(Debug, Clone)]
    pub enum SafetyCategory {
        Harassment,
        HateSpeech,
        SexuallyExplicit,
        DangerousContent,
    }
    
    /// 安全阈值
    #[derive(Debug, Clone)]
    pub enum SafetyThreshold {
        BlockNone,
        BlockLowAndAbove,
        BlockMediumAndAbove,
        BlockHighAndAbove,
    }
    
    /// 创建适合翻译任务的配置
    pub fn create_translation_config() -> GeminiConfig {
        GeminiConfig {
            temperature: 0.3,  // 较低的温度保证翻译一致性
            top_k: 20,
            top_p: 0.9,
            max_output_tokens: 4096,
        }
    }
    
    /// 创建适合创意任务的配置  
    pub fn create_creative_config() -> GeminiConfig {
        GeminiConfig {
            temperature: 0.9,  // 较高的温度增加创意性
            top_k: 60,
            top_p: 0.95,
            max_output_tokens: 8192,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use super::gemini_utils::*;

    #[test]
    fn test_gemini_provider_info() {
        let provider = GeminiProvider;
        
        assert_eq!(provider.id(), "gemini");
        assert_eq!(provider.display_name(), "Google Gemini");
        assert!(provider.default_url().contains("generativelanguage.googleapis.com"));
        assert_eq!(provider.default_model(), "gemini-1.5-flash");
    }

    #[test]
    fn test_gemini_models() {
        let provider = GeminiProvider;
        let models = provider.get_models();
        
        assert!(models.len() >= 4);
        
        // 检查推荐模型
        let recommended_models: Vec<_> = models.iter()
            .filter(|m| m.recommended)
            .collect();
        assert_eq!(recommended_models.len(), 1);
        assert_eq!(recommended_models[0].id, "gemini-1.5-flash");
        
        // 检查缓存支持
        let cache_supported_models: Vec<_> = models.iter()
            .filter(|m| m.supports_cache)
            .collect();
        assert!(cache_supported_models.len() >= 2);
        
        // 检查图像支持
        let image_supported_models: Vec<_> = models.iter()
            .filter(|m| m.supports_images)
            .collect();
        assert!(image_supported_models.len() >= 3);
    }

    #[test]
    fn test_context_window_sizes() {
        let provider = GeminiProvider;
        let models = provider.get_models();
        
        // Gemini 1.5 Pro 应该有最大的上下文窗口
        let pro_model = models.iter()
            .find(|m| m.id == "gemini-1.5-pro")
            .unwrap();
        assert_eq!(pro_model.max_input_tokens, 2000000);
        
        // Flash 模型也应该有很大的上下文窗口
        let flash_model = models.iter()
            .find(|m| m.id == "gemini-1.5-flash")
            .unwrap();
        assert_eq!(flash_model.max_input_tokens, 1000000);
    }

    #[test]
    fn test_cache_pricing() {
        let provider = GeminiProvider;
        let models = provider.get_models();
        
        for model in &models {
            if model.supports_cache {
                assert!(model.cache_reads_price.is_some());
                assert!(model.cache_writes_price.is_some());
                
                let cache_read_price = model.cache_reads_price.unwrap();
                let cache_write_price = model.cache_writes_price.unwrap();
                
                // 缓存读取应该比正常输入便宜
                assert!(cache_read_price < model.input_price);
                
                // 缓存写入可能比正常输入贵一些
                assert!(cache_write_price >= model.input_price);
            }
        }
    }

    #[test]
    fn test_gemini_config() {
        let default_config = GeminiConfig::default();
        assert_eq!(default_config.temperature, 0.7);
        assert_eq!(default_config.top_k, 40);
        
        let translation_config = create_translation_config();
        assert!(translation_config.temperature < default_config.temperature);
        
        let creative_config = create_creative_config();
        assert!(creative_config.temperature > default_config.temperature);
    }
}
