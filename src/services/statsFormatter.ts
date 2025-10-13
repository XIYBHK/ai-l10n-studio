/**
 * 统计格式化器 - 将统计系统 V2 和格式化工具整合
 *
 * 架构定位：
 * ┌─────────────────────────────────────────────────────────────┐
 * │ StatsEngine (事件溯源核心)                                   │
 * │   ↓ 产生原始统计数据                                         │
 * │ StatsFormatter (格式化层)                                    │
 * │   ↓ 使用 formatters.ts 转换为展示格式                        │
 * │ UI Components (直接使用格式化后的数据)                       │
 * └─────────────────────────────────────────────────────────────┘
 *
 * 设计原则：
 * 1. 单一职责：只负责格式化，不修改原始数据
 * 2. 类型安全：完整的 TypeScript 类型定义
 * 3. 可复用：提供多种格式化视图（简洁版、详细版、调试版）
 * 4. 可测试：纯函数，易于单元测试
 */

import { TranslationStats } from '../types/tauri';
import {
  formatCost,
  formatTokens,
  formatPercentage,
  formatCostByLocale,
} from '../utils/formatters';

// ==================== 格式化后的统计数据类型 ====================

/** 格式化后的效率指标 */
export interface FormattedEfficiencyMetrics {
  /** 记忆库命中 */
  tmHits: {
    raw: number; // 原始数值
    percentage: string; // "42.5%"
    label: string; // "记忆库命中"
  };
  /** 去重节省 */
  deduplicated: {
    raw: number;
    percentage: string;
    label: string;
  };
  /** AI调用 */
  aiTranslated: {
    raw: number;
    percentage: string;
    label: string;
  };
  /** API节省次数 */
  apiSavings: {
    count: number; // tm_hits + deduplicated
    label: string; // "节省了 42 次 API 调用"
  };
}

/** 格式化后的 Token 统计 */
export interface FormattedTokenStats {
  input: {
    raw: number;
    formatted: string; // "12,345"
  };
  output: {
    raw: number;
    formatted: string;
  };
  total: {
    raw: number;
    formatted: string;
  };
  cost: {
    raw: number;
    formatted: string; // "$0.0142" or "¥0.1024"
    formattedUSD: string; // 始终显示美元（用于调试）
  };
}

/** 格式化后的统计摘要 */
export interface FormattedStatsSummary {
  /** 效率指标 */
  efficiency: FormattedEfficiencyMetrics;
  /** Token 统计 */
  tokens: FormattedTokenStats;
  /** 原始数据（用于调试） */
  raw: TranslationStats;
  /** 是否有数据 */
  hasData: boolean;
}

// ==================== 统计格式化器类 ====================

/**
 * 统计格式化器
 *
 * 提供多种格式化视图，适配不同的展示场景
 */
export class StatsFormatter {
  /**
   * 格式化统计摘要（完整版）
   *
   * @param stats - 原始统计数据
   * @param locale - 语言设置（可选，用于多货币支持）
   * @returns 格式化后的统计摘要
   */
  static formatSummary(stats: TranslationStats, locale?: string): FormattedStatsSummary {
    // 安全访问所有字段
    const tmHits = stats.tm_hits ?? 0;
    const deduplicated = stats.deduplicated ?? 0;
    const aiTranslated = stats.ai_translated ?? 0;
    const cost = stats.token_stats?.cost ?? 0;
    const inputTokens = stats.token_stats?.input_tokens ?? 0;
    const outputTokens = stats.token_stats?.output_tokens ?? 0;
    const totalTokens = stats.token_stats?.total_tokens ?? 0;

    // 🔧 实际处理的总条目数 = tm_hits + deduplicated + ai_translated
    const actualTotal = tmHits + deduplicated + aiTranslated;

    // 判断是否有数据
    const hasData = actualTotal > 0;

    return {
      efficiency: {
        tmHits: {
          raw: tmHits,
          percentage: actualTotal > 0 ? formatPercentage(tmHits, actualTotal) : '0.0%',
          label: '记忆库命中',
        },
        deduplicated: {
          raw: deduplicated,
          percentage: actualTotal > 0 ? formatPercentage(deduplicated, actualTotal) : '0.0%',
          label: '去重节省',
        },
        aiTranslated: {
          raw: aiTranslated,
          percentage: actualTotal > 0 ? formatPercentage(aiTranslated, actualTotal) : '0.0%',
          label: 'AI调用',
        },
        apiSavings: {
          count: tmHits + deduplicated,
          label: `节省了 ${tmHits + deduplicated} 次 API 调用`,
        },
      },
      tokens: {
        input: {
          raw: inputTokens,
          formatted: formatTokens(inputTokens),
        },
        output: {
          raw: outputTokens,
          formatted: formatTokens(outputTokens),
        },
        total: {
          raw: totalTokens,
          formatted: formatTokens(totalTokens),
        },
        cost: {
          raw: cost,
          formatted: locale ? formatCostByLocale(cost, locale) : formatCost(cost),
          formattedUSD: formatCost(cost), // 始终提供美元格式
        },
      },
      raw: stats,
      hasData,
    };
  }

  /**
   * 格式化效率指标（简洁版）
   *
   * @param stats - 原始统计数据
   * @returns 效率指标文本数组
   */
  static formatEfficiencyBrief(stats: TranslationStats): string[] {
    const summary = this.formatSummary(stats);

    if (!summary.hasData) {
      return ['暂无数据'];
    }

    return [
      `记忆库命中: ${summary.efficiency.tmHits.percentage}`,
      `去重节省: ${summary.efficiency.deduplicated.percentage}`,
      `AI调用: ${summary.efficiency.aiTranslated.percentage}`,
    ];
  }

  /**
   * 格式化成本摘要（一行文本）
   *
   * @param stats - 原始统计数据
   * @param locale - 语言设置
   * @returns 成本摘要文本
   */
  static formatCostSummary(stats: TranslationStats, locale?: string): string {
    const summary = this.formatSummary(stats, locale);

    if (!summary.hasData) {
      return '暂无数据';
    }

    return `${summary.tokens.total.formatted} tokens · ${summary.tokens.cost.formatted}`;
  }

  /**
   * 格式化调试信息（完整原始数据 + 格式化数据）
   *
   * @param stats - 原始统计数据
   * @returns 调试信息对象
   */
  static formatDebugInfo(stats: TranslationStats) {
    const summary = this.formatSummary(stats);

    return {
      timestamp: new Date().toISOString(),
      hasData: summary.hasData,
      rawStats: stats,
      formatted: {
        efficiency: summary.efficiency,
        tokens: summary.tokens,
      },
      calculations: {
        actualTotal: (stats.tm_hits ?? 0) + (stats.deduplicated ?? 0) + (stats.ai_translated ?? 0),
        apiSavings: (stats.tm_hits ?? 0) + (stats.deduplicated ?? 0),
      },
    };
  }

  /**
   * 批量格式化（用于多个统计数据对比）
   *
   * @param statsList - 统计数据数组
   * @param locale - 语言设置
   * @returns 格式化后的摘要数组
   */
  static formatBatch(statsList: TranslationStats[], locale?: string): FormattedStatsSummary[] {
    return statsList.map((stats) => this.formatSummary(stats, locale));
  }
}

// ==================== 便捷导出函数 ====================

/**
 * 快速格式化统计摘要
 *
 * @example
 * const formatted = formatStats(sessionStats);
 * console.log(formatted.efficiency.tmHits.percentage); // "42.5%"
 * console.log(formatted.tokens.cost.formatted);        // "$0.0142"
 */
export const formatStats = StatsFormatter.formatSummary;

/**
 * 快速格式化效率指标
 *
 * @example
 * const metrics = formatEfficiency(sessionStats);
 * // ["记忆库命中: 42.5%", "去重节省: 15.0%", "AI调用: 42.5%"]
 */
export const formatEfficiency = StatsFormatter.formatEfficiencyBrief;

/**
 * 快速格式化成本
 *
 * @example
 * const cost = formatCostSummary(sessionStats);
 * // "12,345 tokens · $0.0142"
 */
export const formatCostSummary = StatsFormatter.formatCostSummary;

/**
 * 快速获取调试信息
 *
 * @example
 * console.log('统计调试信息:', formatDebugInfo(sessionStats));
 */
export const formatDebugInfo = StatsFormatter.formatDebugInfo;
