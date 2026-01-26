//! 翻译统计模块
//!
//! 负责统计翻译过程中的token使用、成本计算和批量统计

use anyhow::Result;
use serde::{Deserialize, Serialize};

#[cfg(feature = "ts-rs")]
use ts_rs::TS;

/// Token 统计信息
#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "ts-rs", derive(TS))]
#[cfg_attr(feature = "ts-rs", ts(export, export_to = "../src/types/generated/"))]
pub struct TokenStats {
    pub input_tokens: u32,
    pub output_tokens: u32,
    pub total_tokens: u32,
    pub cost: f64,
}

impl Default for TokenStats {
    fn default() -> Self {
        Self {
            input_tokens: 0,
            output_tokens: 0,
            total_tokens: 0,
            cost: 0.0,
        }
    }
}

impl TokenStats {
    /// 创建新的 Token 统计
    pub fn new() -> Self {
        Self::default()
    }

    /// 更新 token 统计
    pub fn update(&mut self, input_tokens: u32, output_tokens: u32, total_tokens: u32) {
        self.input_tokens += input_tokens;
        self.output_tokens += output_tokens;
        self.total_tokens += total_tokens;
    }

    /// 添加成本
    pub fn add_cost(&mut self, cost: f64) {
        self.cost += cost;
    }

    /// 重置统计
    pub fn reset(&mut self) {
        *self = Self::default();
    }
}

/// 批量翻译统计
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct BatchStats {
    pub total: usize,
    pub tm_hits: usize,
    pub deduplicated: usize,
    pub ai_translated: usize,
    pub tm_learned: usize,
}

impl BatchStats {
    /// 创建新的批量统计
    pub fn new() -> Self {
        Self::default()
    }

    /// 初始化统计（设置总数）
    pub fn init(&mut self, total: usize) {
        self.total = total;
        self.tm_hits = 0;
        self.deduplicated = 0;
        self.ai_translated = 0;
        self.tm_learned = 0;
    }

    /// 重置统计
    pub fn reset(&mut self) {
        *self = Self::default();
    }

    /// 记录 TM 命中
    pub fn record_tm_hit(&mut self) {
        self.tm_hits += 1;
    }

    /// 记录去重
    pub fn record_deduplication(&mut self, count: usize) {
        self.deduplicated = count;
    }

    /// 记录 AI 翻译
    pub fn record_ai_translation(&mut self, count: usize) {
        self.ai_translated = count;
    }

    /// 记录 TM 学习
    pub fn record_tm_learning(&mut self) {
        self.tm_learned += 1;
    }
}

/// 计算并更新 token 成本
///
/// # 参数
/// - `token_stats`: 可变的 token 统计引用
/// - `provider_id`: AI 供应商 ID
/// - `model`: 模型名称
/// - `prompt_tokens`: 输入 token 数
/// - `completion_tokens`: 输出 token 数
///
/// # 返回
/// 成功返回 ()，失败返回错误
pub fn update_token_cost(
    token_stats: &mut TokenStats,
    provider_id: &str,
    model: &str,
    prompt_tokens: u32,
    completion_tokens: u32,
) -> Result<()> {
    use crate::services::ai::CostCalculator;
    use crate::services::ai::provider::with_global_registry;

    // 更新 token 统计
    let total_tokens = prompt_tokens + completion_tokens;
    token_stats.update(prompt_tokens, completion_tokens, total_tokens);

    // 使用 ModelInfo 计算精确成本
    // Fail Fast 架构设计：多AI供应商架构要求强制 ModelInfo 存在
    // 模型不存在 = 配置错误，应立即返回错误（见 docs/Architecture.md:195）
    let model_info = with_global_registry(|registry| {
        registry
            .get_provider(provider_id)
            .and_then(|provider| provider.get_model_info(model))
            .ok_or_else(|| {
                anyhow::anyhow!(
                    "模型信息不存在: provider={}, model={}. 请检查插件系统中的模型定义",
                    provider_id,
                    model
                )
            })
    })?;

    let breakdown = CostCalculator::calculate_openai(
        &model_info,
        prompt_tokens as usize,
        completion_tokens as usize,
        0, // TODO: 支持从 API 响应中提取缓存 token
        0,
    );

    token_stats.add_cost(breakdown.total_cost);

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_token_stats_default() {
        let stats = TokenStats::default();
        assert_eq!(stats.input_tokens, 0);
        assert_eq!(stats.output_tokens, 0);
        assert_eq!(stats.total_tokens, 0);
        assert_eq!(stats.cost, 0.0);
    }

    #[test]
    fn test_token_stats_update() {
        let mut stats = TokenStats::new();
        stats.update(100, 50, 150);
        assert_eq!(stats.input_tokens, 100);
        assert_eq!(stats.output_tokens, 50);
        assert_eq!(stats.total_tokens, 150);
    }

    #[test]
    fn test_token_stats_add_cost() {
        let mut stats = TokenStats::new();
        stats.add_cost(0.5);
        assert_eq!(stats.cost, 0.5);
        stats.add_cost(0.3);
        assert_eq!(stats.cost, 0.8);
    }

    #[test]
    fn test_batch_stats_default() {
        let stats = BatchStats::default();
        assert_eq!(stats.total, 0);
        assert_eq!(stats.tm_hits, 0);
        assert_eq!(stats.deduplicated, 0);
        assert_eq!(stats.ai_translated, 0);
        assert_eq!(stats.tm_learned, 0);
    }

    #[test]
    fn test_batch_stats_record() {
        let mut stats = BatchStats::new();
        stats.init(100);
        stats.record_tm_hit();
        stats.record_tm_hit();
        stats.record_deduplication(20);
        stats.record_ai_translation(78);
        stats.record_tm_learning();

        assert_eq!(stats.total, 100);
        assert_eq!(stats.tm_hits, 2);
        assert_eq!(stats.deduplicated, 20);
        assert_eq!(stats.ai_translated, 78);
        assert_eq!(stats.tm_learned, 1);
    }
}
