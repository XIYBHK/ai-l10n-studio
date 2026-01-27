/**
 * 术语库相关类型
 */

// 导出自动生成的类型
export type { TermEntry } from './generated/TermEntry';
export type { StyleSummary } from './generated/StyleSummary';

/**
 * 术语库元数据
 */
export interface TermLibraryMetadata {
  total_terms: number;
  last_term_added?: string;
  last_summary_update?: string;
  terms_at_last_summary: number;
}

/**
 * 术语库
 */
export interface TermLibrary {
  terms: TermEntry[];
  style_summary?: StyleSummary;
  metadata: TermLibraryMetadata;
}

/**
 * 术语差异分析结果
 */
export interface TermDifference {
  type: 'exact_match' | 'term_replacement' | 'style_refinement' | 'unknown';
  source_term?: string;
  ai_term?: string;
  user_term?: string;
  confidence: number;
}
