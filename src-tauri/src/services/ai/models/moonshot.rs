use crate::services::ai::model_info::ModelInfo;

/// Moonshot AI 模型列表
///
/// 数据来源：https://models.dev (anomalyco/models.dev)
/// 更新时间：2025-01-28
/// 全新 Kimi K2 系列替代旧的 moonshot-v1 系列
/// Context Caching：可节省约 90% 调用成本
pub fn get_moonshot_models() -> Vec<ModelInfo> {
    vec![
        // ========== 推荐模型 ==========
        ModelInfo {
            id: "kimi-k2-0711-preview".to_string(),
            name: "Kimi K2 0711".to_string(),
            provider: "Moonshot AI".to_string(),
            context_window: 131072, // 128K 上下文
            max_output_tokens: 16384,
            // USD per 1M tokens
            input_price: 0.6,
            output_price: 2.5,
            cache_reads_price: Some(0.15),  // 90% 节省
            cache_writes_price: Some(0.75), // 估算 25% 溢价
            supports_cache: true,
            supports_images: false,
            description: Some("Kimi K2 标准版，128K上下文，稳定可靠".to_string()),
            recommended: true,
        },
        ModelInfo {
            id: "kimi-k2-0905-preview".to_string(),
            name: "Kimi K2 0905".to_string(),
            provider: "Moonshot AI".to_string(),
            context_window: 262144, // 256K 上下文
            max_output_tokens: 262144,
            // USD per 1M tokens
            input_price: 0.6,
            output_price: 2.5,
            cache_reads_price: Some(0.15),  // 90% 节省
            cache_writes_price: Some(0.75), // 估算 25% 溢价
            supports_cache: true,
            supports_images: false,
            description: Some("最新 Kimi K2 模型，256K上下文，超长输出".to_string()),
            recommended: false,
        },
        // ========== 思考模型 ==========
        ModelInfo {
            id: "kimi-k2-thinking".to_string(),
            name: "Kimi K2 Thinking".to_string(),
            provider: "Moonshot AI".to_string(),
            context_window: 262144,
            max_output_tokens: 262144,
            // USD per 1M tokens
            input_price: 0.6,
            output_price: 2.5,
            cache_reads_price: Some(0.15),
            cache_writes_price: Some(0.75),
            supports_cache: true,
            supports_images: false,
            description: Some("Kimi K2 思考模式，深度推理".to_string()),
            recommended: false,
        },
        ModelInfo {
            id: "kimi-k2-thinking-turbo".to_string(),
            name: "Kimi K2 Thinking Turbo".to_string(),
            provider: "Moonshot AI".to_string(),
            context_window: 262144,
            max_output_tokens: 262144,
            // USD per 1M tokens
            input_price: 1.15,
            output_price: 8.0,
            cache_reads_price: Some(0.15),
            cache_writes_price: Some(1.44), // 估算 25% 溢价
            supports_cache: true,
            supports_images: false,
            description: Some("Kimi K2 思考加速模式".to_string()),
            recommended: false,
        },
        // ========== Turbo 模型 ==========
        ModelInfo {
            id: "kimi-k2-turbo-preview".to_string(),
            name: "Kimi K2 Turbo".to_string(),
            provider: "Moonshot AI".to_string(),
            context_window: 262144,
            max_output_tokens: 262144,
            // USD per 1M tokens
            input_price: 2.4,
            output_price: 10.0,
            cache_reads_price: Some(0.6),
            cache_writes_price: Some(3.0), // 估算 25% 溢价
            supports_cache: true,
            supports_images: false,
            description: Some("Kimi K2 Turbo 高速模式".to_string()),
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

        // 检查 kimi-k2-0711 模型（默认推荐）
        let k2_0711 = models
            .iter()
            .find(|m| m.id == "kimi-k2-0711-preview")
            .unwrap();
        assert_eq!(k2_0711.provider, "Moonshot AI");
        assert!(k2_0711.recommended);
        assert!(k2_0711.supports_cache);
        assert_eq!(k2_0711.context_window, 131072); // 128K

        // 检查 kimi-k2-0905 模型
        let k2_0905 = models
            .iter()
            .find(|m| m.id == "kimi-k2-0905-preview")
            .unwrap();
        assert_eq!(k2_0905.provider, "Moonshot AI");
        assert!(!k2_0905.recommended); // 不推荐
        assert!(k2_0905.supports_cache);
        assert_eq!(k2_0905.context_window, 262144); // 256K
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
