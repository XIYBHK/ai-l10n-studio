use crate::services::ai::model_info::ModelInfo;

/// OpenAI 模型列表（2025年最新价格）
///
/// 数据来源：
/// - https://openai.com/api/pricing/
/// - https://platform.openai.com/docs/models
///
/// 更新时间：2025-01-10
pub fn get_openai_models() -> Vec<ModelInfo> {
    vec![
        // ========== GPT-4o 系列（多模态）==========
        ModelInfo {
            id: "gpt-4o".to_string(),
            name: "GPT-4o".to_string(),
            provider: "OpenAI".to_string(),
            context_window: 128000,
            max_output_tokens: 16384,
            // 价格：$2.50/1M input, $10.00/1M output
            input_price: 2.5,
            output_price: 10.0,
            cache_reads_price: Some(1.25),   // 50% off
            cache_writes_price: Some(3.125), // 25% more
            supports_cache: true,
            supports_images: true,
            description: Some("最强大的多模态模型，支持视觉和文本".to_string()),
            recommended: true,
        },
        ModelInfo {
            id: "gpt-4o-mini".to_string(),
            name: "GPT-4o Mini".to_string(),
            provider: "OpenAI".to_string(),
            context_window: 128000,
            max_output_tokens: 16384,
            // 价格：$0.15/1M input, $0.60/1M output
            input_price: 0.15,
            output_price: 0.60,
            cache_reads_price: Some(0.075),   // 50% off
            cache_writes_price: Some(0.1875), // 25% more
            supports_cache: true,
            supports_images: true,
            description: Some("性价比最高的小模型，适合批量翻译".to_string()),
            recommended: true,
        },
        // ========== GPT-4 Turbo 系列 ==========
        ModelInfo {
            id: "gpt-4-turbo".to_string(),
            name: "GPT-4 Turbo".to_string(),
            provider: "OpenAI".to_string(),
            context_window: 128000,
            max_output_tokens: 4096,
            // 价格：$10.00/1M input, $30.00/1M output
            input_price: 10.0,
            output_price: 30.0,
            cache_reads_price: None,
            cache_writes_price: None,
            supports_cache: false,
            supports_images: true,
            description: Some("GPT-4 Turbo 模型，稳定高质量".to_string()),
            recommended: false,
        },
        // ========== GPT-3.5 Turbo（经济实惠）==========
        ModelInfo {
            id: "gpt-3.5-turbo".to_string(),
            name: "GPT-3.5 Turbo".to_string(),
            provider: "OpenAI".to_string(),
            context_window: 16385,
            max_output_tokens: 4096,
            // 价格：$0.50/1M input, $1.50/1M output
            input_price: 0.50,
            output_price: 1.50,
            cache_reads_price: None,
            cache_writes_price: None,
            supports_cache: false,
            supports_images: false,
            description: Some("经典模型，基础翻译场景".to_string()),
            recommended: false,
        },
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_openai_models() {
        let models = get_openai_models();
        assert!(models.len() >= 4);

        // 检查 GPT-4o Mini 模型
        let gpt4o_mini = models.iter().find(|m| m.id == "gpt-4o-mini").unwrap();
        assert_eq!(gpt4o_mini.provider, "OpenAI");
        assert_eq!(gpt4o_mini.input_price, 0.15);
        assert_eq!(gpt4o_mini.output_price, 0.60);
        assert!(gpt4o_mini.supports_cache);
        assert!(gpt4o_mini.recommended);
    }

    #[test]
    fn test_cache_prices() {
        let models = get_openai_models();
        let gpt4o = models.iter().find(|m| m.id == "gpt-4o").unwrap();

        // 验证缓存价格
        assert_eq!(gpt4o.cache_reads_price, Some(1.25)); // 50% off
        assert_eq!(gpt4o.cache_writes_price, Some(3.125)); // 25% more
    }
}
