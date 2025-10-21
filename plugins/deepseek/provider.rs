/**
 * DeepSeek AI 供应商插件实现
 * 
 * 基于现有 DeepSeek 模型配置，转换为插件化架构
 */

use super::super::super::provider::AIProvider;
use super::super::super::ModelInfo;

/// DeepSeek AI 供应商实现
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
        vec![
            // ========== 推荐模型 ==========
            ModelInfo {
                id: "deepseek-chat".to_string(),
                name: "DeepSeek V3.2-Exp".to_string(),
                provider: "DeepSeek AI".to_string(),
                context_window: 128000,
                max_output_tokens: 8192, // 默认4K，最大8K
                // 💰 USD per 1M tokens (基于 1 USD = 7.15 CNY)
                // 性价比之王！官方价格：输入2元，输出3元，缓存0.2元
                input_price: 0.28,                // 2 CNY ≈ $0.28/1M tokens
                output_price: 0.42,               // 3 CNY ≈ $0.42/1M tokens  
                cache_reads_price: Some(0.028),   // 0.2 CNY ≈ $0.028/1M tokens (节省90%)
                cache_writes_price: Some(0.35),   // 估算25%溢价
                supports_cache: true,  // 官方支持硬盘缓存
                supports_images: false,
                recommended: true,
                description: Some("DeepSeek-V3.2-Exp，中文优化，支持硬盘缓存".to_string()),
            },
            
            ModelInfo {
                id: "deepseek-reasoner".to_string(),
                name: "DeepSeek Reasoner".to_string(),
                provider: "DeepSeek AI".to_string(),
                context_window: 128000,
                max_output_tokens: 65536, // 默认32K，最大64K
                // 💰 USD per 1M tokens (思考模式，价格同 deepseek-chat)
                input_price: 0.28,                // 2 CNY ≈ $0.28/1M tokens
                output_price: 0.42,               // 3 CNY ≈ $0.42/1M tokens
                cache_reads_price: Some(0.028),   // 0.2 CNY ≈ $0.028/1M tokens
                cache_writes_price: Some(0.35),   // 估算25%溢价
                supports_cache: true,
                supports_images: false,
                recommended: true,
                description: Some("DeepSeek-V3.2-Exp 思考模式，深度推理，长输出".to_string()),
            },
            
            // ========== 兼容模型 ==========
            ModelInfo {
                id: "deepseek-coder".to_string(),
                name: "DeepSeek Coder".to_string(),
                provider: "DeepSeek AI".to_string(),
                context_window: 128000,
                max_output_tokens: 4096,
                // 💰 USD per 1M tokens (兼容模型，推荐使用 deepseek-chat)
                input_price: 0.28,
                output_price: 0.42,
                cache_reads_price: Some(0.028),
                cache_writes_price: Some(0.35),
                supports_cache: true,
                supports_images: false,
                recommended: false,
                description: Some("代码专用模型（兼容），推荐使用 deepseek-chat".to_string()),
            },
        ]
    }
}

/// 创建 DeepSeek 供应商实例
pub fn create_deepseek_provider() -> DeepSeekProvider {
    DeepSeekProvider
}

/// DeepSeek 特有的工具和配置
pub mod deepseek_utils {
    /// DeepSeek 模型系列
    pub enum ModelSeries {
        V3_2_Exp,
        V3_0,
        V2_5,
    }
    
    /// DeepSeek 配置选项
    #[derive(Debug, Clone)]
    pub struct DeepSeekConfig {
        pub model_series: ModelSeries,
        pub enable_cache: bool,
        pub chinese_optimization: bool,
        pub reasoning_mode: bool,
    }
    
    impl Default for DeepSeekConfig {
        fn default() -> Self {
            Self {
                model_series: ModelSeries::V3_2_Exp,
                enable_cache: true,
                chinese_optimization: true,
                reasoning_mode: false,
            }
        }
    }
    
    /// 获取缓存节省百分比
    pub fn get_cache_savings_percentage() -> f32 {
        90.0  // DeepSeek 硬盘缓存可节省约90%成本
    }
    
    /// 判断是否为推荐模型
    pub fn is_recommended_model(model_id: &str) -> bool {
        matches!(model_id, "deepseek-chat" | "deepseek-reasoner")
    }
    
    /// 获取适合翻译任务的配置
    pub fn create_translation_config() -> DeepSeekConfig {
        DeepSeekConfig {
            model_series: ModelSeries::V3_2_Exp,
            enable_cache: true,           // 启用缓存降低成本
            chinese_optimization: true,   // 中文优化对翻译有帮助
            reasoning_mode: false,        // 翻译任务不需要深度推理
        }
    }
    
    /// 获取适合推理任务的配置
    pub fn create_reasoning_config() -> DeepSeekConfig {
        DeepSeekConfig {
            model_series: ModelSeries::V3_2_Exp,
            enable_cache: true,
            chinese_optimization: true,
            reasoning_mode: true,         // 启用推理模式
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use super::deepseek_utils::*;

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
        
        assert!(models.len() >= 3);
        
        // 检查推荐模型
        let recommended_models: Vec<_> = models.iter()
            .filter(|m| m.recommended)
            .collect();
        assert_eq!(recommended_models.len(), 2); // deepseek-chat 和 deepseek-reasoner
        
        // 检查缓存支持
        for model in &models {
            assert!(model.supports_cache, "所有 DeepSeek 模型都应该支持缓存");
            assert!(model.cache_reads_price.is_some());
            assert!(model.cache_writes_price.is_some());
        }
        
        // 检查性价比
        for model in &models {
            assert!(model.input_price < 1.0, "DeepSeek 以性价比著称");
            assert!(model.output_price < 1.0, "DeepSeek 输出价格也很便宜");
        }
    }

    #[test]
    fn test_cache_pricing() {
        let provider = DeepSeekProvider;
        let models = provider.get_models();
        
        for model in &models {
            let cache_read_price = model.cache_reads_price.unwrap();
            let cache_write_price = model.cache_writes_price.unwrap();
            
            // 缓存读取应该比正常输入便宜90%
            let expected_savings = model.input_price * 0.9;
            let actual_savings = model.input_price - cache_read_price;
            assert!((actual_savings - expected_savings).abs() < 0.01);
            
            // 缓存写入可能略贵于正常输入
            assert!(cache_write_price >= model.input_price);
        }
    }

    #[test]
    fn test_deepseek_config() {
        let default_config = DeepSeekConfig::default();
        assert!(default_config.enable_cache);
        assert!(default_config.chinese_optimization);
        
        let translation_config = create_translation_config();
        assert!(!translation_config.reasoning_mode);
        
        let reasoning_config = create_reasoning_config();
        assert!(reasoning_config.reasoning_mode);
    }

    #[test]
    fn test_utility_functions() {
        assert_eq!(get_cache_savings_percentage(), 90.0);
        
        assert!(is_recommended_model("deepseek-chat"));
        assert!(is_recommended_model("deepseek-reasoner"));
        assert!(!is_recommended_model("deepseek-coder"));
    }
}
