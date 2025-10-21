/**
 * Claude AI 供应商插件实现
 * 
 * 这是 Phase 3 插件化架构的示例，展示如何创建独立的供应商插件
 */

use super::super::super::provider::AIProvider;
use super::super::super::ModelInfo;

/// Claude AI 供应商实现
pub struct ClaudeProvider;

impl AIProvider for ClaudeProvider {
    fn id(&self) -> &'static str {
        "claude"
    }

    fn display_name(&self) -> &'static str {
        "Anthropic Claude"
    }

    fn default_url(&self) -> &'static str {
        "https://api.anthropic.com/v1"
    }

    fn default_model(&self) -> &'static str {
        "claude-3-5-sonnet-20241022"
    }

    fn get_models(&self) -> Vec<ModelInfo> {
        vec![
            // Claude 3.5 Sonnet - 最强大的模型
            ModelInfo {
                id: "claude-3-5-sonnet-20241022".to_string(),
                name: "Claude 3.5 Sonnet".to_string(),
                max_input_tokens: 200000,
                max_output_tokens: 8192,
                input_price: 3.0,   // $3 per million tokens
                output_price: 15.0, // $15 per million tokens
                cache_reads_price: None,
                cache_writes_price: None,
                supports_cache: false,
                supports_images: true,
                recommended: true,
                description: Some("最强大的 Claude 模型，适合复杂推理和分析任务".to_string()),
            },
            
            // Claude 3.5 Haiku - 快速模型
            ModelInfo {
                id: "claude-3-5-haiku-20241022".to_string(),
                name: "Claude 3.5 Haiku".to_string(),
                max_input_tokens: 200000,
                max_output_tokens: 8192,
                input_price: 1.0,   // $1 per million tokens
                output_price: 5.0,  // $5 per million tokens
                cache_reads_price: None,
                cache_writes_price: None,
                supports_cache: false,
                supports_images: true,
                recommended: false,
                description: Some("快速响应的 Claude 模型，适合简单翻译任务".to_string()),
            },
            
            // Claude 3 Opus - 最高质量（但较慢）
            ModelInfo {
                id: "claude-3-opus-20240229".to_string(),
                name: "Claude 3 Opus".to_string(),
                max_input_tokens: 200000,
                max_output_tokens: 4096,
                input_price: 15.0,  // $15 per million tokens
                output_price: 75.0, // $75 per million tokens
                cache_reads_price: None,
                cache_writes_price: None,
                supports_cache: false,
                supports_images: true,
                recommended: false,
                description: Some("最高质量的 Claude 模型，适合最重要的翻译任务".to_string()),
            },
        ]
    }
}

/// 创建 Claude 供应商实例
pub fn create_claude_provider() -> ClaudeProvider {
    ClaudeProvider
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_claude_provider_info() {
        let provider = ClaudeProvider;
        
        assert_eq!(provider.id(), "claude");
        assert_eq!(provider.display_name(), "Anthropic Claude");
        assert_eq!(provider.default_url(), "https://api.anthropic.com/v1");
        assert_eq!(provider.default_model(), "claude-3-5-sonnet-20241022");
    }

    #[test]
    fn test_claude_models() {
        let provider = ClaudeProvider;
        let models = provider.get_models();
        
        assert!(models.len() >= 3);
        
        // 检查推荐模型
        let recommended_models: Vec<_> = models.iter()
            .filter(|m| m.recommended)
            .collect();
        assert_eq!(recommended_models.len(), 1);
        assert_eq!(recommended_models[0].id, "claude-3-5-sonnet-20241022");
        
        // 检查图像支持
        for model in &models {
            assert!(model.supports_images, "所有 Claude 模型都应该支持图像");
        }
    }

    #[test]
    fn test_model_pricing() {
        let provider = ClaudeProvider;
        let models = provider.get_models();
        
        for model in &models {
            assert!(model.input_price > 0.0, "输入价格应该大于 0");
            assert!(model.output_price > 0.0, "输出价格应该大于 0");
            assert!(model.output_price >= model.input_price, "输出价格通常应该高于输入价格");
        }
    }
}
