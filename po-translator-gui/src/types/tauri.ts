export interface POEntry {
  comments: string[];
  msgctxt: string;
  msgid: string;
  msgstr: string;
  line_start: number;
  needsReview?: boolean; // 标记是否需要确认（AI翻译后）
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
  total: number;           // 总条目数
  tm_hits: number;         // TM命中数
  deduplicated: number;    // 去重后数量
  ai_translated: number;   // AI翻译数
  token_stats: TokenStats; // Token统计
  tm_learned: number;      // 新学习短语数
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
}
