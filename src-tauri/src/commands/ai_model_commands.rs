use crate::services::ai::{CostBreakdown, CostCalculator, ModelInfo};
use crate::services::ai_translator::ProviderType;

/// 获取指定供应商的所有模型
///
/// 示例：
/// ```ts
/// const models = await invoke<ModelInfo[]>('get_provider_models', { provider: 'OpenAI' });
/// ```
#[tauri::command]
pub fn get_provider_models(provider: ProviderType) -> Vec<ModelInfo> {
    provider.get_models()
}

/// 获取指定模型的详细信息
///
/// 示例：
/// ```ts
/// const model = await invoke<ModelInfo>('get_model_info', {
///   provider: 'OpenAI',
///   modelId: 'gpt-4o-mini'
/// });
/// ```
#[tauri::command]
pub fn get_model_info(provider: ProviderType, model_id: String) -> Option<ModelInfo> {
    provider.get_model_info(&model_id)
}

/// 估算翻译成本
///
/// 基于字符数估算批量翻译的成本
///
/// 参数：
/// - `provider`: 供应商类型
/// - `model_id`: 模型ID
/// - `char_count`: 字符数
/// - `cache_hit_rate`: 可选的缓存命中率（0.0-1.0，默认0.3）
///
/// 示例：
/// ```ts
/// const cost = await invoke<number>('estimate_translation_cost', {
///   provider: 'OpenAI',
///   modelId: 'gpt-4o-mini',
///   charCount: 10000,
///   cacheHitRate: 0.3
/// });
/// ```
#[tauri::command]
pub fn estimate_translation_cost(
    provider: ProviderType,
    model_id: String,
    char_count: usize,
    cache_hit_rate: Option<f64>,
) -> Result<f64, String> {
    let model = provider
        .get_model_info(&model_id)
        .ok_or_else(|| format!("模型不存在: {}", model_id))?;

    let hit_rate = cache_hit_rate.unwrap_or(0.3); // 默认30%缓存命中率

    // 验证缓存命中率范围
    if hit_rate < 0.0 || hit_rate > 1.0 {
        return Err("缓存命中率必须在 0.0-1.0 之间".to_string());
    }

    let cost = CostCalculator::estimate_batch_cost(&model, char_count, hit_rate);

    Ok(cost)
}

/// 计算精确成本（基于实际token使用）
///
/// 基于实际的token统计计算精确成本
///
/// 参数：
/// - `provider`: 供应商类型
/// - `model_id`: 模型ID
/// - `input_tokens`: 输入token数
/// - `output_tokens`: 输出token数
/// - `cache_write_tokens`: 可选的缓存写入token数
/// - `cache_read_tokens`: 可选的缓存读取token数
///
/// 示例：
/// ```ts
/// const breakdown = await invoke<CostBreakdown>('calculate_precise_cost', {
///   provider: 'OpenAI',
///   modelId: 'gpt-4o-mini',
///   inputTokens: 1000,
///   outputTokens: 500,
///   cacheReadTokens: 300
/// });
/// ```
#[tauri::command]
pub fn calculate_precise_cost(
    provider: ProviderType,
    model_id: String,
    input_tokens: usize,
    output_tokens: usize,
    cache_write_tokens: Option<usize>,
    cache_read_tokens: Option<usize>,
) -> Result<CostBreakdown, String> {
    let model = provider
        .get_model_info(&model_id)
        .ok_or_else(|| format!("模型不存在: {}", model_id))?;

    let breakdown = CostCalculator::calculate_openai(
        &model,
        input_tokens,
        output_tokens,
        cache_write_tokens.unwrap_or(0),
        cache_read_tokens.unwrap_or(0),
    );

    Ok(breakdown)
}

/// 获取所有支持的供应商列表
///
/// 返回所有可用的AI供应商类型
///
/// 示例：
/// ```ts
/// const providers = await invoke<string[]>('get_all_providers');
/// // ["Moonshot", "OpenAI", "SparkDesk", ...]
/// ```
#[tauri::command]
pub fn get_all_providers() -> Vec<String> {
    use crate::services::ai_translator::ProviderType;
    vec![
        format!("{:?}", ProviderType::Moonshot),
        format!("{:?}", ProviderType::OpenAI),
        format!("{:?}", ProviderType::SparkDesk),
        format!("{:?}", ProviderType::Wenxin),
        format!("{:?}", ProviderType::Qianwen),
        format!("{:?}", ProviderType::GLM),
        format!("{:?}", ProviderType::Claude),
        format!("{:?}", ProviderType::Gemini),
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_provider_models() {
        let models = get_provider_models(ProviderType::OpenAI);
        assert!(!models.is_empty());

        // 验证返回的模型信息完整
        let first_model = &models[0];
        assert!(!first_model.id.is_empty());
        assert!(!first_model.name.is_empty());
        assert_eq!(first_model.provider, "OpenAI");
        assert!(first_model.context_window > 0);
    }

    #[test]
    fn test_get_model_info() {
        let model = get_model_info(ProviderType::OpenAI, "gpt-4o-mini".to_string());
        assert!(model.is_some());

        let model = model.unwrap();
        assert_eq!(model.id, "gpt-4o-mini");
        assert_eq!(model.provider, "OpenAI");
    }

    #[test]
    fn test_estimate_translation_cost() {
        let cost = estimate_translation_cost(
            ProviderType::OpenAI,
            "gpt-4o-mini".to_string(),
            10000,
            Some(0.3),
        );

        assert!(cost.is_ok());
        let cost_value = cost.unwrap();
        assert!(cost_value > 0.0);
        assert!(cost_value < 1.0); // 10000字符不应超过1美元
    }

    #[test]
    fn test_calculate_precise_cost() {
        let breakdown = calculate_precise_cost(
            ProviderType::OpenAI,
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

    #[test]
    fn test_invalid_cache_hit_rate() {
        let cost = estimate_translation_cost(
            ProviderType::OpenAI,
            "gpt-4o-mini".to_string(),
            10000,
            Some(1.5), // 无效：超过1.0
        );

        assert!(cost.is_err());
        assert!(cost.unwrap_err().contains("0.0-1.0"));
    }

    #[test]
    fn test_nonexistent_model() {
        let model = get_model_info(ProviderType::OpenAI, "nonexistent-model".to_string());
        assert!(model.is_none());

        let cost = estimate_translation_cost(
            ProviderType::OpenAI,
            "nonexistent-model".to_string(),
            10000,
            None,
        );
        assert!(cost.is_err());
        assert!(cost.unwrap_err().contains("模型不存在"));
    }
}
