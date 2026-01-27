/**
 * Tauri 相关类型导出
 *
 * 大部分类型由 ts-rs 自动生成（与 Rust 后端类型自动同步）
 * 仅保留前端特有的扩展类型
 */

import type { POEntry as BasePOEntry } from './generated/POEntry';

// 导出自动生成的类型（与后端 Rust 类型一致）
export type { TranslationStats } from './generated/TranslationStats';
export type { TokenStats } from './generated/TokenStats';
export type { TranslationReport } from './generated/TranslationReport';
export type { AppConfig } from './generated/AppConfig';
export type { ContextualRefineRequest } from './generated/ContextualRefineRequest';
export type { TranslationPair } from './generated/TranslationPair';

// 前端扩展类型

/**
 * POEntry 类型（前端扩展版本）
 * 合并后端生成的 POEntry 与前端特有的运行时状态字段
 *
 * 注意：在与后端通信时，需要排除 needsReview 和 translationSource 字段
 */
export interface POEntry extends BasePOEntry {
  needsReview?: boolean;
  translationSource?: 'tm' | 'dedup' | 'ai';
}

/**
 * 翻译记忆统计
 */
export interface MemoryStats {
  total_entries: number;
  hits: number;
  misses: number;
}

/**
 * 翻译记忆
 */
export interface TranslationMemory {
  memory: Record<string, string>;
  stats: MemoryStats;
}
