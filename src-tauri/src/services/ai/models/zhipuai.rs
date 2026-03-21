use crate::services::ai::model_info::ModelInfo;

/// 智谱AI 模型列表
///
/// 数据来源：https://models.dev (anomalyco/models.dev)
/// 特点：开源免费，中文优化，支持视觉理解
/// 更新时间：2025-01-28
/// GLM-4.7-Flash：最新免费模型，200K 上下文
pub fn get_zhipuai_models() -> Vec<ModelInfo> {
    vec![
        // ========== 推荐模型（免费）==========
        ModelInfo {
            id: "glm-4.7-flash".to_string(),
            name: "GLM-4.7-Flash".to_string(),
            provider: "智谱AI".to_string(),
            context_window: 200000, // 200K 上下文
            max_output_tokens: 131072,
            // 免费（开源模型）
            input_price: 0.0,
            output_price: 0.0,
            cache_reads_price: Some(0.0),
            cache_writes_price: Some(0.0),
            supports_cache: true,
            supports_images: false,
            description: Some("最新免费模型，200K上下文，性价比极高".to_string()),
            recommended: true,
        },
        ModelInfo {
            id: "glm-4.5-flash".to_string(),
            name: "GLM-4.5-Flash".to_string(),
            provider: "智谱AI".to_string(),
            context_window: 131072, // 128K 上下文
            max_output_tokens: 98304,
            // 免费（开源模型）
            input_price: 0.0,
            output_price: 0.0,
            cache_reads_price: Some(0.0),
            cache_writes_price: Some(0.0),
            supports_cache: true,
            supports_images: false,
            description: Some("免费模型，128K上下文".to_string()),
            recommended: false,
        },
        ModelInfo {
            id: "glm-4.6v-flash".to_string(),
            name: "GLM-4.6V-Flash".to_string(),
            provider: "智谱AI".to_string(),
            context_window: 128000,
            max_output_tokens: 32768,
            // 免费（开源视觉模型）
            input_price: 0.0,
            output_price: 0.0,
            cache_reads_price: None,
            cache_writes_price: None,
            supports_cache: false,
            supports_images: true,
            description: Some("免费视觉模型，支持图片理解".to_string()),
            recommended: false,
        },
        // ========== 性价比模型 ==========
        ModelInfo {
            id: "glm-4.5-air".to_string(),
            name: "GLM-4.5-Air".to_string(),
            provider: "智谱AI".to_string(),
            context_window: 131072,
            max_output_tokens: 98304,
            // USD per 1M tokens
            input_price: 0.2,
            output_price: 1.1,
            cache_reads_price: Some(0.03), // 节省 85%
            cache_writes_price: Some(0.0), // 免费缓存写入
            supports_cache: true,
            supports_images: false,
            description: Some("超低成本模型，缓存免费".to_string()),
            recommended: true,
        },
        // ========== 标准模型 ==========
        ModelInfo {
            id: "glm-4.7".to_string(),
            name: "GLM-4.7".to_string(),
            provider: "智谱AI".to_string(),
            context_window: 204800, // 200K 上下文
            max_output_tokens: 131072,
            // USD per 1M tokens
            input_price: 0.6,
            output_price: 2.2,
            cache_reads_price: Some(0.11),
            cache_writes_price: Some(0.0), // 免费缓存写入
            supports_cache: true,
            supports_images: false,
            description: Some("最新标准模型，200K上下文".to_string()),
            recommended: false,
        },
        ModelInfo {
            id: "glm-4.6".to_string(),
            name: "GLM-4.6".to_string(),
            provider: "智谱AI".to_string(),
            context_window: 204800,
            max_output_tokens: 131072,
            // USD per 1M tokens
            input_price: 0.6,
            output_price: 2.2,
            cache_reads_price: Some(0.11),
            cache_writes_price: Some(0.0),
            supports_cache: true,
            supports_images: false,
            description: Some("标准模型，200K上下文".to_string()),
            recommended: false,
        },
        ModelInfo {
            id: "glm-4.5".to_string(),
            name: "GLM-4.5".to_string(),
            provider: "智谱AI".to_string(),
            context_window: 131072,
            max_output_tokens: 98304,
            // USD per 1M tokens
            input_price: 0.6,
            output_price: 2.2,
            cache_reads_price: Some(0.11),
            cache_writes_price: Some(0.0),
            supports_cache: true,
            supports_images: false,
            description: Some("标准模型，128K上下文".to_string()),
            recommended: false,
        },
        // ========== 视觉模型 ==========
        ModelInfo {
            id: "glm-4.6v".to_string(),
            name: "GLM-4.6V".to_string(),
            provider: "智谱AI".to_string(),
            context_window: 128000,
            max_output_tokens: 32768,
            // USD per 1M tokens
            input_price: 0.3,
            output_price: 0.9,
            cache_reads_price: None,
            cache_writes_price: None,
            supports_cache: false,
            supports_images: true,
            description: Some("视觉理解模型".to_string()),
            recommended: false,
        },
        ModelInfo {
            id: "glm-4.5v".to_string(),
            name: "GLM-4.5V".to_string(),
            provider: "智谱AI".to_string(),
            context_window: 64000,
            max_output_tokens: 16384,
            // USD per 1M tokens
            input_price: 0.6,
            output_price: 1.8,
            cache_reads_price: None,
            cache_writes_price: None,
            supports_cache: false,
            supports_images: true,
            description: Some("视觉理解模型".to_string()),
            recommended: false,
        },
    ]
}

#[cfg(test)]
#[allow(clippy::unwrap_used)]
mod tests {
    use super::*;

    #[test]
    fn test_get_zhipuai_models() {
        let models = get_zhipuai_models();
        assert!(models.len() >= 9);

        // 检查 GLM-4.7-Flash
        let flash = models.iter().find(|m| m.id == "glm-4.7-flash").unwrap();
        assert_eq!(flash.provider, "智谱AI");
        assert_eq!(flash.input_price, 0.0); // 免费
        assert_eq!(flash.output_price, 0.0);
        assert!(flash.recommended);
        assert!(flash.supports_cache);
        assert_eq!(flash.context_window, 200000);

        // 检查 GLM-4.5-Air
        let air = models.iter().find(|m| m.id == "glm-4.5-air").unwrap();
        assert_eq!(air.provider, "智谱AI");
        assert_eq!(air.input_price, 0.2);
        assert_eq!(air.output_price, 1.1);
        assert!(air.recommended);
    }

    #[test]
    fn test_free_models() {
        let models = get_zhipuai_models();

        // 验证免费模型
        let free_models = models
            .iter()
            .filter(|m| m.input_price == 0.0 && m.output_price == 0.0)
            .count();

        assert!(free_models >= 3, "应该有至少3个免费模型");
    }

    #[test]
    fn test_cache_support() {
        let models = get_zhipuai_models();

        // 验证 Flash 和 Air 模型支持缓存
        let flash = models.iter().find(|m| m.id == "glm-4.7-flash").unwrap();
        assert!(flash.supports_cache);
        assert!(flash.cache_reads_price.is_some());

        let air = models.iter().find(|m| m.id == "glm-4.5-air").unwrap();
        assert!(air.supports_cache);
        assert!(air.cache_reads_price.is_some());
    }
}
