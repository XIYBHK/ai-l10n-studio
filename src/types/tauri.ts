export interface POEntry {
  comments: string[];
  msgctxt: string;
  msgid: string;
  msgstr: string;
  line_start: number;
  needsReview?: boolean; // 标记是否需要确认（AI翻译后）
  translationSource?: 'tm' | 'dedup' | 'ai'; // 翻译来源：TM命中、去重、AI翻译
}

export interface TranslationReport {
  file: string;
  total_entries: number;
  need_translation: number;
  translated: number;
  failed: number;
  translations: TranslationPair[];
  token_stats: TokenStats;
}

export interface TranslationPair {
  original: string;
  translation: string;
}

export interface TokenStats {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  cost: number;
}

export interface TranslationStats {
  total: number; // 总条目数
  tm_hits: number; // TM命中数
  deduplicated: number; // 去重后数量
  ai_translated: number; // AI翻译数
  token_stats: TokenStats; // Token统计
  tm_learned: number; // 新学习短语数
}

export interface TranslationMemory {
  memory: Record<string, string>;
  stats: MemoryStats;
}

export interface MemoryStats {
  total_entries: number;
  hits: number;
  misses: number;
}

export interface AppConfig {
  api_key: string;
  base_url: string;
  batch_size: number;
  use_translation_memory: boolean;
  // 日志配置
  log_level?: 'debug' | 'info' | 'warn' | 'error';
  log_retention_days?: number;
  log_max_size?: number;
  log_max_count?: number;
}

// Phase 7: Contextual Refine 请求类型
export interface ContextualRefineRequest {
  msgid: string;
  msgctxt?: string;
  comment?: string;
  previousEntry?: string; // 🔧 改为 camelCase
  nextEntry?: string; // 🔧 改为 camelCase
}
