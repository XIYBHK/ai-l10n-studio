use crate::services::ai::model_info::ModelInfo;

/// DeepSeek 模型列表
/// 
/// 数据来源：https://platform.deepseek.com/api-docs/pricing/
/// 特点：中文优化，性价比极高
/// 更新时间：2025-01-10
pub fn get_deepseek_models() -> Vec<ModelInfo> {
    vec![
        ModelInfo {
            id: "deepseek-chat".to_string(),
            name: "DeepSeek V3".to_string(),
            provider: "DeepSeek".to_string(),
            context_window: 128000,
            max_output_tokens: 8192,
            // 💰 USD per 1M tokens
            // 性价比之王！比 GPT-4o-mini 便宜 93%
            input_price: 0.14,   // $0.14/1M tokens
            output_price: 0.28,  // $0.28/1M tokens
            cache_reads_price: Some(0.014),  // 假设10%折扣
            cache_writes_price: Some(0.175), // 假设25%溢价
            supports_cache: true,
            supports_images: false,
            description: Some("DeepSeek V3，中文优化，性价比之王".to_string()),
            recommended: true,
        },
        
        ModelInfo {
            id: "deepseek-coder".to_string(),
            name: "DeepSeek Coder".to_string(),
            provider: "DeepSeek".to_string(),
            context_window: 128000,
            max_output_tokens: 4096,
            // 💰 USD per 1M tokens
            input_price: 0.14,   // $0.14/1M tokens
            output_price: 0.28,  // $0.28/1M tokens
            cache_reads_price: Some(0.014),
            cache_writes_price: Some(0.175),
            supports_cache: true,
            supports_images: false,
            description: Some("代码专用模型，适合技术文档翻译".to_string()),
            recommended: false,
        },
    ]
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_get_deepseek_models() {
        let models = get_deepseek_models();
        assert!(models.len() >= 2);
        
        // 检查 DeepSeek V3
        let chat = models.iter().find(|m| m.id == "deepseek-chat").unwrap();
        assert_eq!(chat.provider, "DeepSeek");
        assert!(chat.input_price < 0.20); // 验证超低价格
        assert!(chat.recommended);
    }
}

