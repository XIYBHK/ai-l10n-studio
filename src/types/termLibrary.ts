// 术语库类型定义

export interface TermEntry {
  source: string;
  user_translation: string;
  ai_translation: string;
  context?: string;
  frequency: number;
  created_at: string;
}

export interface StyleSummary {
  prompt: string;
  based_on_terms: number;
  generated_at: string;
  version: number;
}

export interface TermLibraryMetadata {
  total_terms: number;
  last_term_added?: string;
  last_summary_update?: string;
  terms_at_last_summary: number;
}

export interface TermLibrary {
  terms: TermEntry[];
  style_summary?: StyleSummary;
  metadata: TermLibraryMetadata;
}

// 术语差异分析结果
export interface TermDifference {
  type: 'exact_match' | 'term_replacement' | 'style_refinement' | 'unknown';
  source_term?: string;
  ai_term?: string;
  user_term?: string;
  confidence: number; // 0-1
}
