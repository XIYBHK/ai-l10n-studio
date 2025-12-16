use crate::services::ai::model_info::ModelInfo;

/// Moonshot AI 模型列表
///
/// 数据来源：https://platform.moonshot.cn/docs/pricing
/// 更新时间：2025-10-21
/// Context Caching：2024-06 支持，可节省约 90% 调用成本
pub fn get_moonshot_models() -> Vec<ModelInfo> {
    vec![
        // ========== 推荐模型 ==========
        ModelInfo {
            id: "kimi-latest".to_string(),
            name: "Kimi Latest".to_string(),
            provider: "Moonshot AI".to_string(),
            context_window: 128000,
            max_output_tokens: 4096,
            // 💰 USD per 1M tokens
            input_price: 1.67, // 估算，自动根据上下文选择模型计费
            output_price: 1.67,
            cache_reads_price: Some(0.14), // ￥1/M ≈ $0.14/1M (90% 节省)
            cache_writes_price: Some(2.09), // 估算 25% 溢价
            supports_cache: true,          // 支持自动缓存
            supports_images: true,         // 支持视觉理解
            description: Some("最新模型，自动缓存，支持视觉 (2025-02发布)".to_string()),
            recommended: true,
        },
        ModelInfo {
            id: "moonshot-v1-auto".to_string(),
            name: "Kimi (自动选择)".to_string(),
            provider: "Moonshot AI".to_string(),
            context_window: 128000,
            max_output_tokens: 4096,
            // 💰 USD per 1M tokens
            input_price: 1.67,              // $1.67/1M tokens
            output_price: 1.67,             // $1.67/1M tokens
            cache_reads_price: Some(0.17),  // 估算 90% 节省
            cache_writes_price: Some(2.09), // 估算 25% 溢价
            supports_cache: true,           // Context Caching 支持
            supports_images: false,
            description: Some("智能选择最优模型，128K上下文".to_string()),
            recommended: true,
        },
        // ========== 其他模型 ==========
        ModelInfo {
            id: "moonshot-v1-8k".to_string(),
            name: "Kimi (8K)".to_string(),
            provider: "Moonshot AI".to_string(),
            context_window: 8000,
            max_output_tokens: 4096,
            // 💰 USD per 1M tokens
            input_price: 1.67,  // $1.67/1M tokens
            output_price: 1.67, // $1.67/1M tokens
            cache_reads_price: Some(0.17),
            cache_writes_price: Some(2.09),
            supports_cache: true,
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
            cache_reads_price: Some(0.33),
            cache_writes_price: Some(4.16),
            supports_cache: true,
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
            cache_reads_price: Some(0.83),
            cache_writes_price: Some(10.41),
            supports_cache: true,
            supports_images: false,
            description: Some("超长128K上下文，处理大型PO文件".to_string()),
            recommended: false,
        },
    ]
}

#[cfg(test)]
#[allow(clippy::unwrap_used)]
mod tests {
    use super::*;

    #[test]
    fn test_get_moonshot_models() {
        let models = get_moonshot_models();
        assert!(models.len() >= 5);

        // 检查 kimi-latest 模型
        let latest = models.iter().find(|m| m.id == "kimi-latest").unwrap();
        assert_eq!(latest.provider, "Moonshot AI");
        assert!(latest.recommended);
        assert!(latest.supports_cache);
        assert!(latest.supports_images);

        // 检查 auto 模型
        let auto = models.iter().find(|m| m.id == "moonshot-v1-auto").unwrap();
        assert_eq!(auto.provider, "Moonshot AI");
        assert!(auto.recommended);
        assert!(auto.supports_cache);
    }

    #[test]
    fn test_cache_support() {
        let models = get_moonshot_models();

        // 所有模型都应该支持缓存
        for model in &models {
            assert!(
                model.supports_cache,
                "Model {} should support cache",
                model.id
            );
            assert!(model.cache_reads_price.is_some());
            assert!(model.cache_writes_price.is_some());
        }
    }
}
