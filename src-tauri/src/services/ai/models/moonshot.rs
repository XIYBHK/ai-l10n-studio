use crate::services::ai::model_info::ModelInfo;

/// Moonshot AI 模型列表
///
/// 数据来源：https://platform.moonshot.cn/docs/pricing
/// 更新时间：2025-01-10
pub fn get_moonshot_models() -> Vec<ModelInfo> {
    vec![
        ModelInfo {
            id: "moonshot-v1-auto".to_string(),
            name: "Kimi (自动选择)".to_string(),
            provider: "Moonshot AI".to_string(),
            context_window: 128000,
            max_output_tokens: 4096,
            // 💰 USD per 1M tokens
            input_price: 1.67,  // $1.67/1M tokens
            output_price: 1.67, // $1.67/1M tokens
            cache_reads_price: None,
            cache_writes_price: None,
            supports_cache: false,
            supports_images: false,
            description: Some("智能选择最优模型，128K上下文".to_string()),
            recommended: true,
        },
        ModelInfo {
            id: "moonshot-v1-8k".to_string(),
            name: "Kimi (8K)".to_string(),
            provider: "Moonshot AI".to_string(),
            context_window: 8000,
            max_output_tokens: 4096,
            // 💰 USD per 1M tokens
            input_price: 1.67,  // $1.67/1M tokens
            output_price: 1.67, // $1.67/1M tokens
            cache_reads_price: None,
            cache_writes_price: None,
            supports_cache: false,
            supports_images: false,
            description: Some("标准8K上下文，性价比高".to_string()),
            recommended: false,
        },
        ModelInfo {
            id: "moonshot-v1-32k".to_string(),
            name: "Kimi (32K)".to_string(),
            provider: "Moonshot AI".to_string(),
            context_window: 32000,
            max_output_tokens: 4096,
            // 💰 USD per 1M tokens
            input_price: 3.33,  // $3.33/1M tokens (24 CNY)
            output_price: 3.33, // $3.33/1M tokens
            cache_reads_price: None,
            cache_writes_price: None,
            supports_cache: false,
            supports_images: false,
            description: Some("32K上下文，适合中型文件".to_string()),
            recommended: false,
        },
        ModelInfo {
            id: "moonshot-v1-128k".to_string(),
            name: "Kimi (128K)".to_string(),
            provider: "Moonshot AI".to_string(),
            context_window: 128000,
            max_output_tokens: 4096,
            // 💰 USD per 1M tokens
            input_price: 8.33,  // $8.33/1M tokens (60 CNY)
            output_price: 8.33, // $8.33/1M tokens
            cache_reads_price: None,
            cache_writes_price: None,
            supports_cache: false,
            supports_images: false,
            description: Some("超长128K上下文，处理大型PO文件".to_string()),
            recommended: false,
        },
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_moonshot_models() {
        let models = get_moonshot_models();
        assert!(models.len() >= 4);

        // 检查 auto 模型
        let auto = models.iter().find(|m| m.id == "moonshot-v1-auto").unwrap();
        assert_eq!(auto.provider, "Moonshot AI");
        assert!(auto.recommended);
    }
}
