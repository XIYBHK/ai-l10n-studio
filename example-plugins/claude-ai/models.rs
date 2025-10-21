/**
 * Claude AI 模型定义
 * 
 * 此文件包含 Claude AI 的所有模型定义和配置
 * 可以被 provider.rs 引用，也可以被插件配置覆盖
 */

use super::super::super::ModelInfo;

/// Claude 模型系列常量
pub mod models {
    // Claude 3.5 系列
    pub const CLAUDE_3_5_SONNET: &str = "claude-3-5-sonnet-20241022";
    pub const CLAUDE_3_5_HAIKU: &str = "claude-3-5-haiku-20241022";
    
    // Claude 3 系列
    pub const CLAUDE_3_OPUS: &str = "claude-3-opus-20240229";
    pub const CLAUDE_3_SONNET: &str = "claude-3-sonnet-20240229";
    pub const CLAUDE_3_HAIKU: &str = "claude-3-haiku-20240307";
}

/// 获取所有 Claude 模型的详细信息
pub fn get_all_claude_models() -> Vec<ModelInfo> {
    vec![
        // Claude 3.5 系列 - 最新最强
        ModelInfo {
            id: models::CLAUDE_3_5_SONNET.to_string(),
            name: "Claude 3.5 Sonnet".to_string(),
            max_input_tokens: 200000,
            max_output_tokens: 8192,
            input_price: 3.0,
            output_price: 15.0,
            cache_reads_price: None,  // Claude 目前不支持缓存
            cache_writes_price: None,
            supports_cache: false,
            supports_images: true,
            recommended: true,
            description: Some("Claude 3.5 Sonnet 是 Anthropic 最平衡的模型，在推理、知识和编码方面表现出色".to_string()),
        },
        
        ModelInfo {
            id: models::CLAUDE_3_5_HAIKU.to_string(),
            name: "Claude 3.5 Haiku".to_string(),
            max_input_tokens: 200000,
            max_output_tokens: 8192,
            input_price: 1.0,
            output_price: 5.0,
            cache_reads_price: None,
            cache_writes_price: None,
            supports_cache: false,
            supports_images: true,
            recommended: false,
            description: Some("Claude 3.5 Haiku 是最快的 Claude 模型，适合快速响应和简单任务".to_string()),
        },
        
        // Claude 3 系列 - 经典版本
        ModelInfo {
            id: models::CLAUDE_3_OPUS.to_string(),
            name: "Claude 3 Opus".to_string(),
            max_input_tokens: 200000,
            max_output_tokens: 4096,
            input_price: 15.0,
            output_price: 75.0,
            cache_reads_price: None,
            cache_writes_price: None,
            supports_cache: false,
            supports_images: true,
            recommended: false,
            description: Some("Claude 3 Opus 是最强大的 Claude 3 模型，在最困难的任务上表现最佳".to_string()),
        },
        
        ModelInfo {
            id: models::CLAUDE_3_SONNET.to_string(),
            name: "Claude 3 Sonnet".to_string(),
            max_input_tokens: 200000,
            max_output_tokens: 4096,
            input_price: 3.0,
            output_price: 15.0,
            cache_reads_price: None,
            cache_writes_price: None,
            supports_cache: false,
            supports_images: true,
            recommended: false,
            description: Some("Claude 3 Sonnet 平衡了性能和成本，适合大多数应用".to_string()),
        },
        
        ModelInfo {
            id: models::CLAUDE_3_HAIKU.to_string(),
            name: "Claude 3 Haiku".to_string(),
            max_input_tokens: 200000,
            max_output_tokens: 4096,
            input_price: 0.25,
            output_price: 1.25,
            cache_reads_price: None,
            cache_writes_price: None,
            supports_cache: false,
            supports_images: true,
            recommended: false,
            description: Some("Claude 3 Haiku 是最经济的 Claude 3 模型，适合简单任务".to_string()),
        },
    ]
}

/// 获取推荐的 Claude 模型
pub fn get_recommended_models() -> Vec<ModelInfo> {
    get_all_claude_models()
        .into_iter()
        .filter(|model| model.recommended)
        .collect()
}

/// 根据 ID 获取特定模型
pub fn get_model_by_id(id: &str) -> Option<ModelInfo> {
    get_all_claude_models()
        .into_iter()
        .find(|model| model.id == id)
}

/// Claude 模型特性分析
pub mod analysis {
    use super::*;
    
    /// 获取最经济的模型
    pub fn get_most_economical() -> Option<ModelInfo> {
        get_all_claude_models()
            .into_iter()
            .min_by(|a, b| {
                let a_cost = a.input_price + a.output_price;
                let b_cost = b.input_price + b.output_price;
                a_cost.partial_cmp(&b_cost).unwrap()
            })
    }
    
    /// 获取最强大的模型（按价格判断）
    pub fn get_most_powerful() -> Option<ModelInfo> {
        get_all_claude_models()
            .into_iter()
            .max_by(|a, b| {
                let a_cost = a.input_price + a.output_price;
                let b_cost = b.input_price + b.output_price;
                a_cost.partial_cmp(&b_cost).unwrap()
            })
    }
    
    /// 获取平衡性最好的模型
    pub fn get_most_balanced() -> Option<ModelInfo> {
        // Claude 3.5 Sonnet 通常是最平衡的选择
        get_model_by_id(models::CLAUDE_3_5_SONNET)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_model_constants() {
        assert!(!models::CLAUDE_3_5_SONNET.is_empty());
        assert!(!models::CLAUDE_3_5_HAIKU.is_empty());
        assert!(!models::CLAUDE_3_OPUS.is_empty());
    }

    #[test]
    fn test_get_all_models() {
        let models = get_all_claude_models();
        assert!(models.len() >= 5);
        
        // 确保每个模型都有必需的字段
        for model in &models {
            assert!(!model.id.is_empty());
            assert!(!model.name.is_empty());
            assert!(model.max_input_tokens > 0);
            assert!(model.max_output_tokens > 0);
            assert!(model.input_price >= 0.0);
            assert!(model.output_price >= 0.0);
        }
    }

    #[test]
    fn test_recommended_models() {
        let recommended = get_recommended_models();
        assert!(!recommended.is_empty());
        
        // 应该只有一个推荐模型
        assert_eq!(recommended.len(), 1);
        assert_eq!(recommended[0].id, models::CLAUDE_3_5_SONNET);
    }

    #[test]
    fn test_model_lookup() {
        let model = get_model_by_id(models::CLAUDE_3_5_SONNET);
        assert!(model.is_some());
        
        let model = model.unwrap();
        assert_eq!(model.id, models::CLAUDE_3_5_SONNET);
        assert!(model.recommended);
    }

    #[test]
    fn test_analysis_functions() {
        let economical = analysis::get_most_economical();
        assert!(economical.is_some());
        
        let powerful = analysis::get_most_powerful();
        assert!(powerful.is_some());
        
        let balanced = analysis::get_most_balanced();
        assert!(balanced.is_some());
        assert_eq!(balanced.unwrap().id, models::CLAUDE_3_5_SONNET);
    }
}
