use crate::services::ai::provider::with_global_registry;
use crate::services::ai::{CostBreakdown, CostCalculator, ModelInfo, ProviderInfo};

#[tauri::command]
pub fn get_provider_models(provider_id: String) -> Result<Vec<ModelInfo>, String> {
    with_global_registry(|registry| {
        registry
            .get_provider(&provider_id)
            .map(|provider| provider.get_models())
            .ok_or_else(|| {
                let all_ids = registry.get_provider_ids();
                format!("未找到供应商: '{}' (可用: {:?})", provider_id, all_ids)
            })
    })
}

#[tauri::command]
pub fn get_model_info(provider_id: String, model_id: String) -> Result<Option<ModelInfo>, String> {
    with_global_registry(|registry| {
        registry
            .get_provider(&provider_id)
            .map(|provider| provider.get_model_info(&model_id))
            .ok_or_else(|| format!("未找到供应商: {}", provider_id))
    })
}

#[tauri::command]
pub fn estimate_translation_cost(
    provider_id: String,
    model_id: String,
    char_count: usize,
    cache_hit_rate: Option<f64>,
) -> Result<f64, String> {
    let model = with_global_registry(|registry| {
        registry
            .get_provider(&provider_id)
            .and_then(|provider| provider.get_model_info(&model_id))
            .ok_or_else(|| format!("未找到模型: {} (供应商: {})", model_id, provider_id))
    })?;

    let hit_rate = cache_hit_rate.unwrap_or(0.3);
    if !(0.0..=1.0).contains(&hit_rate) {
        return Err("缓存命中率必须在 0.0-1.0 之间".to_string());
    }

    Ok(CostCalculator::estimate_batch_cost(
        &model, char_count, hit_rate,
    ))
}

#[tauri::command]
pub fn calculate_precise_cost(
    provider_id: String,
    model_id: String,
    input_tokens: usize,
    output_tokens: usize,
    cache_write_tokens: Option<usize>,
    cache_read_tokens: Option<usize>,
) -> Result<CostBreakdown, String> {
    let model = with_global_registry(|registry| {
        registry
            .get_provider(&provider_id)
            .and_then(|provider| provider.get_model_info(&model_id))
            .ok_or_else(|| format!("未找到模型: {} (供应商: {})", model_id, provider_id))
    })?;

    Ok(CostCalculator::calculate_openai(
        &model,
        input_tokens,
        output_tokens,
        cache_write_tokens.unwrap_or(0),
        cache_read_tokens.unwrap_or(0),
    ))
}

#[tauri::command]
pub fn get_all_providers() -> Result<Vec<ProviderInfo>, String> {
    Ok(with_global_registry(|registry| {
        registry.get_all_providers()
    }))
}

#[tauri::command]
pub fn get_all_models() -> Result<Vec<ModelInfo>, String> {
    Ok(with_global_registry(|registry| registry.get_all_models()))
}

#[tauri::command]
pub fn find_provider_for_model(model_id: String) -> Result<Option<ProviderInfo>, String> {
    Ok(with_global_registry(|registry| {
        registry
            .find_provider_for_model(&model_id)
            .map(|provider| provider.get_provider_info())
    }))
}

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used)]
mod tests {
    use super::*;
    use crate::services::ai::providers::register_all_providers;

    #[tokio::test]
    async fn test_get_provider_models() {
        // 测试环境：手动注册供应商（生产环境在 init.rs 中自动注册）
        let _ = register_all_providers();

        let models = get_provider_models("openai".to_string());
        assert!(models.is_ok());
        let models = models.unwrap();
        assert!(!models.is_empty());

        // 验证返回的模型信息完整
        let first_model = &models[0];
        assert!(!first_model.id.is_empty());
        assert!(!first_model.name.is_empty());
        assert_eq!(first_model.provider, "OpenAI");
        assert!(first_model.context_window > 0);
    }

    #[tokio::test]
    async fn test_get_model_info() {
        let _ = register_all_providers();

        let model = get_model_info("openai".to_string(), "gpt-4o-mini".to_string());
        assert!(model.is_ok());
        let model = model.unwrap();
        assert!(model.is_some());

        let model = model.unwrap();
        assert_eq!(model.id, "gpt-4o-mini");
        assert_eq!(model.provider, "OpenAI");
    }

    #[tokio::test]
    async fn test_estimate_translation_cost() {
        let _ = register_all_providers();

        let cost = estimate_translation_cost(
            "openai".to_string(),
            "gpt-4o-mini".to_string(),
            10000,
            Some(0.3),
        );

        assert!(cost.is_ok());
        let cost_value = cost.unwrap();
        assert!(cost_value > 0.0);
        assert!(cost_value < 1.0); // 10000字符不应超过1美元
    }

    #[tokio::test]
    async fn test_calculate_precise_cost() {
        let _ = register_all_providers();

        let breakdown = calculate_precise_cost(
            "openai".to_string(),
            "gpt-4o-mini".to_string(),
            1000,
            500,
            None,
            Some(300),
        );

        assert!(breakdown.is_ok());
        let breakdown = breakdown.unwrap();
        assert_eq!(breakdown.input_tokens, 1000);
        assert_eq!(breakdown.output_tokens, 500);
        assert_eq!(breakdown.cache_read_tokens, 300);
        assert!(breakdown.total_cost > 0.0);
        assert!(breakdown.cache_savings > 0.0);
        assert!((breakdown.cache_hit_rate - 30.0).abs() < 0.1);
    }

    #[tokio::test]
    async fn test_invalid_cache_hit_rate() {
        let _ = register_all_providers();

        let cost = estimate_translation_cost(
            "openai".to_string(),
            "gpt-4o-mini".to_string(),
            10000,
            Some(1.5), // 无效：超过1.0
        );

        assert!(cost.is_err());
        assert!(cost.unwrap_err().contains("0.0-1.0"));
    }

    #[tokio::test]
    async fn test_nonexistent_model() {
        let _ = register_all_providers();

        let model = get_model_info("openai".to_string(), "nonexistent-model".to_string());
        assert!(model.is_ok());
        let model = model.unwrap();
        assert!(model.is_none());

        let cost = estimate_translation_cost(
            "openai".to_string(),
            "nonexistent-model".to_string(),
            10000,
            None,
        );
        assert!(cost.is_err());
        assert!(cost.unwrap_err().contains("未找到模型"));
    }
}
