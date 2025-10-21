use crate::services::ai::model_info::ModelInfo;

/// DeepSeek 模型列表
///
/// 数据来源：https://api-docs.deepseek.com/zh-cn/quick_start/pricing/
/// 特点：中文优化，性价比极高，支持硬盘缓存（2024-08上线）
/// 更新时间：2025-10-21
/// 最新版本：DeepSeek-V3.2-Exp（2025-09-29发布）
pub fn get_deepseek_models() -> Vec<ModelInfo> {
    vec![
        // ========== 推荐模型 ==========
        ModelInfo {
            id: "deepseek-chat".to_string(),
            name: "DeepSeek V3.2-Exp".to_string(),
            provider: "DeepSeek".to_string(),
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
            description: Some("DeepSeek-V3.2-Exp，中文优化，支持硬盘缓存".to_string()),
            recommended: true,
        },
        ModelInfo {
            id: "deepseek-reasoner".to_string(),
            name: "DeepSeek Reasoner".to_string(),
            provider: "DeepSeek".to_string(),
            context_window: 128000,
            max_output_tokens: 65536, // 默认32K，最大64K
            // 💰 USD per 1M tokens (思考模式，价格同 deepseek-chat)
            input_price: 0.28,                // 2 CNY ≈ $0.28/1M tokens
            output_price: 0.42,               // 3 CNY ≈ $0.42/1M tokens
            cache_reads_price: Some(0.028),   // 0.2 CNY ≈ $0.028/1M tokens
            cache_writes_price: Some(0.35),   // 估算25%溢价
            supports_cache: true,
            supports_images: false,
            description: Some("DeepSeek-V3.2-Exp 思考模式，深度推理，长输出".to_string()),
            recommended: true,
        },
        // ========== 兼容模型 ==========
        ModelInfo {
            id: "deepseek-coder".to_string(),
            name: "DeepSeek Coder".to_string(),
            provider: "DeepSeek".to_string(),
            context_window: 128000,
            max_output_tokens: 4096,
            // 💰 USD per 1M tokens (兼容旧版本，可能已停用)
            input_price: 0.28,
            output_price: 0.42,
            cache_reads_price: Some(0.028),
            cache_writes_price: Some(0.35),
            supports_cache: true,
            supports_images: false,
            description: Some("代码专用模型（兼容），推荐使用 deepseek-chat".to_string()),
            recommended: false,
        },
    ]
}

#[cfg(test)]
#[allow(clippy::unwrap_used)]
mod tests {
    use super::*;

    #[test]
    fn test_get_deepseek_models() {
        let models = get_deepseek_models();
        assert!(models.len() >= 3);

        // 检查 DeepSeek V3.2-Exp
        let chat = models.iter().find(|m| m.id == "deepseek-chat").unwrap();
        assert_eq!(chat.provider, "DeepSeek");
        assert_eq!(chat.name, "DeepSeek V3.2-Exp");
        assert!(chat.input_price < 0.30); // 验证低价格
        assert!(chat.recommended);
        assert!(chat.supports_cache);

        // 检查 DeepSeek Reasoner
        let reasoner = models.iter().find(|m| m.id == "deepseek-reasoner").unwrap();
        assert_eq!(reasoner.provider, "DeepSeek");
        assert!(reasoner.recommended);
        assert!(reasoner.supports_cache);
        assert_eq!(reasoner.max_output_tokens, 65536); // 长输出
    }

    #[test]
    fn test_cache_support() {
        let models = get_deepseek_models();
        
        // 所有模型都应该支持缓存
        for model in &models {
            assert!(model.supports_cache, "Model {} should support cache", model.id);
            assert!(model.cache_reads_price.is_some());
            assert!(model.cache_writes_price.is_some());
            
            // 验证缓存价格确实更低（节省约90%）
            if let Some(cache_price) = model.cache_reads_price {
                let savings = (model.input_price - cache_price) / model.input_price;
                assert!(savings > 0.8, "Cache should save at least 80% for {}", model.id);
            }
        }
    }

    #[test]  
    fn test_official_prices() {
        let models = get_deepseek_models();
        let chat = models.iter().find(|m| m.id == "deepseek-chat").unwrap();
        
        // 验证官方价格：输入2元，输出3元，缓存0.2元
        // 按 1 USD = 7.15 CNY 换算
        assert!((chat.input_price - 0.28).abs() < 0.01, "Input price should be ~$0.28");
        assert!((chat.output_price - 0.42).abs() < 0.01, "Output price should be ~$0.42");
        assert!((chat.cache_reads_price.unwrap() - 0.028).abs() < 0.005, "Cache price should be ~$0.028");
    }
}
