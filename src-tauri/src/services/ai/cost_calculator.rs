use super::model_info::ModelInfo;
use serde::{Deserialize, Serialize};

#[cfg(feature = "ts-rs")]
use ts_rs::TS;

/// 成本明细
///
/// 提供详细的成本分解，包括缓存节省信息
#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "ts-rs", derive(TS))]
#[cfg_attr(feature = "ts-rs", ts(export, export_to = "../src/types/generated/"))]
pub struct CostBreakdown {
    // ========== Token 统计 ==========
    /// 输入 token 数量（包含缓存）
    pub input_tokens: usize,

    /// 输出 token 数量
    pub output_tokens: usize,

    /// 缓存写入 token 数量
    pub cache_write_tokens: usize,

    /// 缓存读取 token 数量
    pub cache_read_tokens: usize,

    // ========== 成本明细（USD）==========
    /// 常规输入成本
    pub input_cost: f64,

    /// 输出成本
    pub output_cost: f64,

    /// 缓存写入成本
    pub cache_write_cost: f64,

    /// 缓存读取成本
    pub cache_read_cost: f64,

    /// 总成本
    pub total_cost: f64,

    // ========== 节省信息 ==========
    /// 缓存节省的金额（USD）
    pub cache_savings: f64,

    /// 缓存命中率（百分比，如 30.5 表示30.5%）
    pub cache_hit_rate: f64,
}

/// 成本计算器
///
/// 参考：Roo-Code 的成本计算逻辑
/// 支持 OpenAI 协议的精确成本计算
pub struct CostCalculator;

impl CostCalculator {
    /// OpenAI 协议成本计算
    ///
    /// OpenAI 的 usage 返回格式：
    /// ```json
    /// {
    ///   "prompt_tokens": 1500,           // 包含所有输入（含缓存）
    ///   "completion_tokens": 500,         // 输出
    ///   "prompt_tokens_details": {
    ///     "cached_tokens": 300,           // 缓存读取
    ///     "text_tokens": 1200             // 新输入
    ///   }
    /// }
    /// ```
    ///
    /// 参数说明：
    /// - `input_tokens`: 总输入 token 数（包含缓存）
    /// - `cache_read_tokens`: 从缓存读取的 token 数
    /// - `cache_write_tokens`: 写入缓存的 token 数（首次请求）
    ///
    /// 成本计算公式：
    /// - 常规输入 = (input_tokens - cache_write_tokens - cache_read_tokens) * input_price
    /// - 缓存写入 = cache_write_tokens * cache_writes_price
    /// - 缓存读取 = cache_read_tokens * cache_reads_price (通常是 input_price 的 10%)
    /// - 输出 = output_tokens * output_price
    pub fn calculate_openai(
        model: &ModelInfo,
        input_tokens: usize,
        output_tokens: usize,
        cache_write_tokens: usize,
        cache_read_tokens: usize,
    ) -> CostBreakdown {
        // 计算非缓存输入
        let uncached_input = input_tokens
            .saturating_sub(cache_write_tokens)
            .saturating_sub(cache_read_tokens);

        // 计算各部分成本（USD per million tokens）
        let input_cost = (uncached_input as f64 / 1_000_000.0) * model.input_price;
        let output_cost = (output_tokens as f64 / 1_000_000.0) * model.output_price;
        let cache_write_cost = (cache_write_tokens as f64 / 1_000_000.0)
            * model.cache_writes_price.unwrap_or(model.input_price);
        let cache_read_cost = (cache_read_tokens as f64 / 1_000_000.0)
            * model.cache_reads_price.unwrap_or(model.input_price);

        // 计算缓存节省
        // 如果没有缓存，这部分 token 将按正常价格计费
        let cache_savings = if cache_read_tokens > 0 {
            let full_input_cost = (cache_read_tokens as f64 / 1_000_000.0) * model.input_price;
            full_input_cost - cache_read_cost
        } else {
            0.0
        };

        // 计算缓存命中率
        let cache_hit_rate = if input_tokens > 0 {
            (cache_read_tokens as f64 / input_tokens as f64) * 100.0
        } else {
            0.0
        };

        CostBreakdown {
            input_tokens,
            output_tokens,
            cache_write_tokens,
            cache_read_tokens,
            input_cost,
            output_cost,
            cache_write_cost,
            cache_read_cost,
            total_cost: input_cost + output_cost + cache_write_cost + cache_read_cost,
            cache_savings,
            cache_hit_rate,
        }
    }

    /// 估算批量翻译成本
    ///
    /// 基于字符数估算 token 数量
    /// 规则：
    /// - 4 字符 ≈ 1 token（英文/中文混合经验值）
    /// - 翻译场景：输出 token ≈ 输入 token
    ///
    /// 参数：
    /// - `total_chars`: 总字符数
    /// - `cache_hit_rate`: 预期缓存命中率（0.0-1.0）
    pub fn estimate_batch_cost(model: &ModelInfo, total_chars: usize, cache_hit_rate: f64) -> f64 {
        let estimated_input_tokens = (total_chars / 4) as f64;
        let estimated_output_tokens = estimated_input_tokens; // 翻译场景输入输出大致相等

        // 考虑缓存
        let cache_read_tokens = estimated_input_tokens * cache_hit_rate;
        let normal_input_tokens = estimated_input_tokens - cache_read_tokens;

        let input_cost = (normal_input_tokens / 1_000_000.0) * model.input_price;
        let output_cost = (estimated_output_tokens / 1_000_000.0) * model.output_price;
        let cache_read_cost = (cache_read_tokens / 1_000_000.0)
            * model.cache_reads_price.unwrap_or(model.input_price);

        input_cost + output_cost + cache_read_cost
    }

    /// 简化成本计算（向后兼容）
    ///
    /// 不考虑缓存，只计算基本的输入输出成本
    pub fn calculate_simple(model: &ModelInfo, input_tokens: usize, output_tokens: usize) -> f64 {
        let input_cost = (input_tokens as f64 / 1_000_000.0) * model.input_price;
        let output_cost = (output_tokens as f64 / 1_000_000.0) * model.output_price;
        input_cost + output_cost
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_model() -> ModelInfo {
        ModelInfo {
            id: "gpt-4o-mini".to_string(),
            name: "GPT-4o Mini".to_string(),
            provider: "OpenAI".to_string(),
            context_window: 128000,
            max_output_tokens: 16384,
            input_price: 0.15,                // $0.15 per 1M
            output_price: 0.60,               // $0.60 per 1M
            cache_reads_price: Some(0.075),   // 50% off
            cache_writes_price: Some(0.1875), // 25% more
            supports_cache: true,
            supports_images: true,
            description: None,
            recommended: true,
        }
    }

    #[test]
    fn test_calculate_openai_no_cache() {
        let model = create_test_model();

        // 测试：无缓存场景
        // 1000 input + 500 output
        // 期望：(1000/1M)*0.15 + (500/1M)*0.60 = 0.00015 + 0.0003 = 0.00045
        let breakdown = CostCalculator::calculate_openai(&model, 1000, 500, 0, 0);

        assert_eq!(breakdown.input_tokens, 1000);
        assert_eq!(breakdown.output_tokens, 500);
        assert_eq!(breakdown.cache_read_tokens, 0);
        assert!((breakdown.total_cost - 0.00045).abs() < 0.000001);
        assert_eq!(breakdown.cache_savings, 0.0);
        assert_eq!(breakdown.cache_hit_rate, 0.0);
    }

    #[test]
    fn test_calculate_openai_with_cache() {
        let model = create_test_model();

        // 测试：有缓存场景
        // 总输入 1000，其中 300 来自缓存
        // 期望：
        // - 常规输入: (700/1M)*0.15 = 0.000105
        // - 缓存读取: (300/1M)*0.075 = 0.0000225
        // - 输出: (500/1M)*0.60 = 0.0003
        // - 总计: 0.0004275
        // - 缓存节省: (300/1M)*(0.15-0.075) = 0.0000225
        let breakdown = CostCalculator::calculate_openai(&model, 1000, 500, 0, 300);

        assert_eq!(breakdown.input_tokens, 1000);
        assert_eq!(breakdown.cache_read_tokens, 300);
        assert!((breakdown.total_cost - 0.0004275).abs() < 0.000001);
        assert!((breakdown.cache_savings - 0.0000225).abs() < 0.0000001);
        assert!((breakdown.cache_hit_rate - 30.0).abs() < 0.1);
    }

    #[test]
    fn test_estimate_batch_cost() {
        let model = create_test_model();

        // 测试：10000 字符，30% 缓存命中率
        // 估算：10000/4 = 2500 tokens input
        // - 正常输入: 1750 tokens (70%)
        // - 缓存读取: 750 tokens (30%)
        // - 输出: 2500 tokens (100%)
        // 成本：
        // - 正常输入: (1750/1M)*0.15 = 0.0002625
        // - 缓存读取: (750/1M)*0.075 = 0.00005625
        // - 输出: (2500/1M)*0.60 = 0.0015
        // 总计: 0.00181875
        let cost = CostCalculator::estimate_batch_cost(&model, 10000, 0.3);
        assert!((cost - 0.00181875).abs() < 0.000001);
    }

    #[test]
    fn test_simple_calculation() {
        let model = create_test_model();
        let cost = CostCalculator::calculate_simple(&model, 1000, 500);
        assert!((cost - 0.00045).abs() < 0.000001);
    }
}
