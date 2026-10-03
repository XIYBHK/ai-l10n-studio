//! 翻译统计模块
//!
//! 负责统计翻译过程中的token使用、成本计算和批量统计

use serde::{Deserialize, Serialize};

#[cfg(feature = "ts-rs")]
use ts_rs::TS;

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[cfg_attr(feature = "ts-rs", derive(TS))]
#[cfg_attr(
    feature = "ts-rs",
    ts(export, export_to = "../../src/types/generated/")
)]
pub struct TranslationStats {
    pub total: usize,
    pub tm_hits: usize,
    pub deduplicated: usize,
    pub ai_translated: usize,
    pub token_stats: TokenStats,
    pub tm_learned: usize,
}

/// Token 统计信息
#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "ts-rs", derive(TS))]
#[cfg_attr(
    feature = "ts-rs",
    ts(export, export_to = "../../src/types/generated/")
)]
pub struct TokenStats {
    pub input_tokens: u32,
    pub output_tokens: u32,
    pub total_tokens: u32,
    pub cost: f64,
    /// Requests omitted from `cost` because no price is known.
    pub unpriced_requests: u32,
}

impl Default for TokenStats {
    fn default() -> Self {
        Self {
            input_tokens: 0,
            output_tokens: 0,
            total_tokens: 0,
            cost: 0.0,
            unpriced_requests: 0,
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
