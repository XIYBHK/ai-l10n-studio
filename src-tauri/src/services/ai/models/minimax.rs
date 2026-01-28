use crate::services::ai::model_info::ModelInfo;

/// MiniMax 模型列表
///
/// 数据来源：https://models.dev (anomalyco/models.dev)
/// 特点：高性价比，超长上下文，开源权重
/// 更新时间：2025-01-28
/// MiniMax-M2.1：最新版本，204K 上下文
pub fn get_minimax_models() -> Vec<ModelInfo> {
    vec![
        // ========== 推荐模型 ==========
        ModelInfo {
            id: "MiniMax-M2.1".to_string(),
            name: "MiniMax-M2.1".to_string(),
            provider: "MiniMax".to_string(),
            context_window: 204800, // 204K 上下文
            max_output_tokens: 131072,
            // 💰 USD per 1M tokens
            input_price: 0.3,
            output_price: 1.2,
            cache_reads_price: None,
            cache_writes_price: None,
            supports_cache: false,
            supports_images: false,
            description: Some("最新版本，204K上下文，超长输出".to_string()),
            recommended: true,
        },
        ModelInfo {
            id: "MiniMax-M2".to_string(),
            name: "MiniMax-M2".to_string(),
            provider: "MiniMax".to_string(),
            context_window: 196608, // 196K 上下文
            max_output_tokens: 128000,
            // 💰 USD per 1M tokens
            input_price: 0.3,
            output_price: 1.2,
            cache_reads_price: None,
            cache_writes_price: None,
            supports_cache: false,
            supports_images: false,
            description: Some("标准版本，196K上下文".to_string()),
            recommended: false,
        },
    ]
}

#[cfg(test)]
#[allow(clippy::unwrap_used)]
mod tests {
    use super::*;

    #[test]
    fn test_get_minimax_models() {
        let models = get_minimax_models();
        assert!(models.len() >= 2);

        // 检查 MiniMax-M2.1
        let m2_1 = models.iter().find(|m| m.id == "MiniMax-M2.1").unwrap();
        assert_eq!(m2_1.provider, "MiniMax");
        assert_eq!(m2_1.input_price, 0.3);
        assert_eq!(m2_1.output_price, 1.2);
        assert!(m2_1.recommended);
        assert_eq!(m2_1.context_window, 204800);

        // 检查 MiniMax-M2
        let m2 = models.iter().find(|m| m.id == "MiniMax-M2").unwrap();
        assert_eq!(m2.provider, "MiniMax");
        assert!(!m2.recommended);
        assert_eq!(m2.context_window, 196608);
    }

    #[test]
    fn test_pricing() {
        let models = get_minimax_models();
        let m2_1 = models.iter().find(|m| m.id == "MiniMax-M2.1").unwrap();

        // 验证价格
        assert_eq!(m2_1.input_price, 0.3);
        assert_eq!(m2_1.output_price, 1.2);

        // 计算每1K tokens 价格
        let input_per_1k = m2_1.input_price / 1000.0;
        let output_per_1k = m2_1.output_price / 1000.0;
        assert!(input_per_1k < 0.001, "输入价格应该很便宜");
        assert!(output_per_1k < 0.002, "输出价格应该很便宜");
    }

    #[test]
    fn test_long_context() {
        let models = get_minimax_models();

        // 所有模型都应该有超长上下文
        for model in &models {
            assert!(
                model.context_window >= 196000,
                "Model {} 应该有超长上下文",
                model.id
            );
        }
    }
}
