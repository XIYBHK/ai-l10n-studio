/**
 * Moonshot AI (Kimi) 供应商插件实现
 * 
 * 基于现有 Moonshot 模型配置，转换为插件化架构
 */

use super::super::super::provider::AIProvider;
use super::super::super::ModelInfo;

/// Moonshot AI (Kimi) 供应商实现
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
        "kimi-latest"
    }

    fn get_models(&self) -> Vec<ModelInfo> {
        vec![
            // ========== 推荐模型 ==========
            ModelInfo {
                id: "kimi-latest".to_string(),
                name: "Kimi Latest".to_string(),
                provider: "Moonshot AI".to_string(),
                context_window: 128000,
                max_output_tokens: 4096,
                // 💰 USD per 1M tokens
                input_price: 1.67,   // 估算，自动根据上下文选择模型计费
                output_price: 1.67,
                cache_reads_price: Some(0.14),   // ￥1/M ≈ $0.14/1M (90% 节省)
                cache_writes_price: Some(2.09),  // 估算 25% 溢价
                supports_cache: true,  // 支持自动缓存
                supports_images: true, // 支持视觉理解
                recommended: true,
                description: Some("最新模型，自动缓存，支持视觉理解 (2025-02发布)".to_string()),
            },
            
            ModelInfo {
                id: "moonshot-v1-auto".to_string(),
                name: "Kimi (自动选择)".to_string(),
                provider: "Moonshot AI".to_string(),
                context_window: 128000,
                max_output_tokens: 4096,
                // 💰 USD per 1M tokens
                input_price: 1.67,  // $1.67/1M tokens
                output_price: 1.67, // $1.67/1M tokens
                cache_reads_price: Some(0.17),   // 估算 90% 节省
                cache_writes_price: Some(2.09),  // 估算 25% 溢价
                supports_cache: true,  // Context Caching 支持
                supports_images: false,
                recommended: true,
                description: Some("智能选择最优模型，128K上下文".to_string()),
            },
            
            // ========== 其他模型 ==========
            ModelInfo {
                id: "moonshot-v1-8k".to_string(),
                name: "Kimi (8K)".to_string(),
                provider: "Moonshot AI".to_string(),
                context_window: 8000,
                max_output_tokens: 4096,
                // 💰 USD per 1M tokens
                input_price: 1.67,
                output_price: 1.67,
                cache_reads_price: Some(0.17),   // 估算 90% 节省
                cache_writes_price: Some(2.09),  // 估算 25% 溢价
                supports_cache: true,  // Context Caching 支持
                supports_images: false,
                recommended: false,
                description: Some("8K上下文窗口，适合短文本处理".to_string()),
            },
            
            ModelInfo {
                id: "moonshot-v1-32k".to_string(),
                name: "Kimi (32K)".to_string(),
                provider: "Moonshot AI".to_string(),
                context_window: 32000,
                max_output_tokens: 4096,
                // 💰 USD per 1M tokens
                input_price: 1.67,
                output_price: 1.67,
                cache_reads_price: Some(0.17),   // 估算 90% 节省
                cache_writes_price: Some(2.09),  // 估算 25% 溢价
                supports_cache: true,  // Context Caching 支持
                supports_images: false,
                recommended: false,
                description: Some("32K上下文窗口，适合中等长度文档".to_string()),
            },
            
            ModelInfo {
                id: "moonshot-v1-128k".to_string(),
                name: "Kimi (128K)".to_string(),
                provider: "Moonshot AI".to_string(),
                context_window: 128000,
                max_output_tokens: 4096,
                // 💰 USD per 1M tokens
                input_price: 1.67,
                output_price: 1.67,
                cache_reads_price: Some(0.17),   // 估算 90% 节省
                cache_writes_price: Some(2.09),  // 估算 25% 溢价
                supports_cache: true,  // Context Caching 支持
                supports_images: false,
                recommended: false,
                description: Some("128K超长上下文窗口，适合长文档处理".to_string()),
            },
        ]
    }
}

/// 创建 Moonshot 供应商实例
pub fn create_moonshot_provider() -> MoonshotProvider {
    MoonshotProvider
}

/// Moonshot 特有的工具和配置
pub mod moonshot_utils {
    /// Moonshot 模型系列
    pub enum ModelType {
        Latest,      // kimi-latest
        Auto,        // moonshot-v1-auto
        Fixed8K,     // moonshot-v1-8k
        Fixed32K,    // moonshot-v1-32k
        Fixed128K,   // moonshot-v1-128k
    }
    
    /// Moonshot 配置选项
    #[derive(Debug, Clone)]
    pub struct MoonshotConfig {
        pub model_type: ModelType,
        pub enable_cache: bool,
        pub enable_vision: bool,
        pub auto_model_selection: bool,
    }
    
    impl Default for MoonshotConfig {
        fn default() -> Self {
            Self {
                model_type: ModelType::Latest,
                enable_cache: true,
                enable_vision: true,
                auto_model_selection: true,
            }
        }
    }
    
    /// 获取缓存节省百分比
    pub fn get_cache_savings_percentage() -> f32 {
        90.0  // Moonshot Context Caching 可节省约90%成本
    }
    
    /// 判断模型是否支持视觉
    pub fn supports_vision(model_id: &str) -> bool {
        model_id == "kimi-latest"
    }
    
    /// 获取模型的上下文窗口大小
    pub fn get_context_window(model_id: &str) -> usize {
        match model_id {
            "moonshot-v1-8k" => 8000,
            "moonshot-v1-32k" => 32000,
            "moonshot-v1-128k" | "moonshot-v1-auto" | "kimi-latest" => 128000,
            _ => 128000, // 默认
        }
    }
    
    /// 判断是否为推荐模型
    pub fn is_recommended_model(model_id: &str) -> bool {
        matches!(model_id, "kimi-latest" | "moonshot-v1-auto")
    }
    
    /// 获取适合翻译任务的配置
    pub fn create_translation_config() -> MoonshotConfig {
        MoonshotConfig {
            model_type: ModelType::Auto,      // 自动选择最优模型
            enable_cache: true,               // 启用缓存降低成本
            enable_vision: false,             // 翻译任务通常不需要视觉
            auto_model_selection: true,       // 启用自动模型选择
        }
    }
    
    /// 获取适合长文档处理的配置
    pub fn create_long_document_config() -> MoonshotConfig {
        MoonshotConfig {
            model_type: ModelType::Fixed128K, // 使用最大上下文窗口
            enable_cache: true,
            enable_vision: false,
            auto_model_selection: false,      // 固定使用128K模型
        }
    }
    
    /// 获取适合多模态任务的配置
    pub fn create_multimodal_config() -> MoonshotConfig {
        MoonshotConfig {
            model_type: ModelType::Latest,    // 使用最新模型
            enable_cache: true,
            enable_vision: true,              // 启用视觉理解
            auto_model_selection: false,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use super::moonshot_utils::*;

    #[test]
    fn test_moonshot_provider_info() {
        let provider = MoonshotProvider;
        
        assert_eq!(provider.id(), "moonshot");
        assert_eq!(provider.display_name(), "Moonshot AI");
        assert_eq!(provider.default_url(), "https://api.moonshot.cn/v1");
        assert_eq!(provider.default_model(), "kimi-latest");
    }

    #[test]
    fn test_moonshot_models() {
        let provider = MoonshotProvider;
        let models = provider.get_models();
        
        assert!(models.len() >= 5);
        
        // 检查推荐模型
        let recommended_models: Vec<_> = models.iter()
            .filter(|m| m.recommended)
            .collect();
        assert_eq!(recommended_models.len(), 2); // kimi-latest 和 moonshot-v1-auto
        
        // 检查缓存支持
        for model in &models {
            assert!(model.supports_cache, "所有 Moonshot 模型都应该支持缓存");
            assert!(model.cache_reads_price.is_some());
            assert!(model.cache_writes_price.is_some());
        }
        
        // 检查视觉支持
        let vision_models: Vec<_> = models.iter()
            .filter(|m| m.supports_images)
            .collect();
        assert_eq!(vision_models.len(), 1); // 只有 kimi-latest 支持视觉
        assert_eq!(vision_models[0].id, "kimi-latest");
    }

    #[test]
    fn test_context_windows() {
        assert_eq!(get_context_window("moonshot-v1-8k"), 8000);
        assert_eq!(get_context_window("moonshot-v1-32k"), 32000);
        assert_eq!(get_context_window("moonshot-v1-128k"), 128000);
        assert_eq!(get_context_window("kimi-latest"), 128000);
    }

    #[test]
    fn test_vision_support() {
        assert!(supports_vision("kimi-latest"));
        assert!(!supports_vision("moonshot-v1-auto"));
        assert!(!supports_vision("moonshot-v1-8k"));
    }

    #[test]
    fn test_cache_pricing() {
        let provider = MoonshotProvider;
        let models = provider.get_models();
        
        for model in &models {
            let cache_read_price = model.cache_reads_price.unwrap();
            let cache_write_price = model.cache_writes_price.unwrap();
            
            // 缓存读取应该比正常输入便宜很多（约90%节省）
            assert!(cache_read_price < model.input_price * 0.2);
            
            // 缓存写入可能略贵于正常输入
            assert!(cache_write_price >= model.input_price);
        }
    }

    #[test]
    fn test_moonshot_configs() {
        let default_config = MoonshotConfig::default();
        assert!(default_config.enable_cache);
        assert!(default_config.enable_vision);
        
        let translation_config = create_translation_config();
        assert!(!translation_config.enable_vision);
        assert!(translation_config.auto_model_selection);
        
        let long_doc_config = create_long_document_config();
        assert!(!long_doc_config.auto_model_selection);
        
        let multimodal_config = create_multimodal_config();
        assert!(multimodal_config.enable_vision);
    }

    #[test]
    fn test_utility_functions() {
        assert_eq!(get_cache_savings_percentage(), 90.0);
        
        assert!(is_recommended_model("kimi-latest"));
        assert!(is_recommended_model("moonshot-v1-auto"));
        assert!(!is_recommended_model("moonshot-v1-8k"));
    }
}
