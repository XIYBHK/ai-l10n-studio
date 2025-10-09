import type { TranslationStats } from '../types/tauri';

// 统一将任意来源的统计归一化为 TranslationStats
export function normalizeStats(input: any, fallbackTotal?: number): TranslationStats {
  const token = input?.token_stats || input?.tokens || {};
  const prompt = token.prompt_tokens ?? token.input_tokens ?? 0;
  const completion = token.completion_tokens ?? token.output_tokens ?? 0;
  const totalTokens = token.total_tokens ?? (prompt + completion);
  const cost = token.cost ?? 0;

  // 定位日志：归一化输入与输出（仅开发环境建议开启）
  if (typeof console !== 'undefined' && (import.meta as any)?.env?.MODE !== 'production') {
    // 为避免大对象刷屏，仅摘取关键字段
    try {
      console.debug('[normalizeStats] in', {
        total: input?.total,
        tm_hits: input?.tm_hits,
        deduplicated: input?.deduplicated,
        ai_translated: input?.ai_translated,
        token: {
          prompt_tokens: token.prompt_tokens,
          completion_tokens: token.completion_tokens,
          total_tokens: token.total_tokens,
          cost: token.cost,
        }
      });
    } catch {}
  }

  return {
    total: input?.total ?? fallbackTotal ?? 0,
    tm_hits: input?.tm_hits ?? 0,
    deduplicated: input?.deduplicated ?? 0,
    ai_translated: input?.ai_translated ?? 0,
    tm_learned: input?.tm_learned ?? 0,
    token_stats: {
      input_tokens: prompt ?? 0,
      output_tokens: completion ?? 0,
      total_tokens: totalTokens ?? 0,
      cost: cost ?? 0,
    },
  } as TranslationStats;
}

// 将 b 累加到 a，返回新的对象（不修改原对象）
export function accumulateStats(a: TranslationStats, b: TranslationStats): TranslationStats {
  return {
    total: (a.total ?? 0) + (b.total ?? 0),
    tm_hits: (a.tm_hits ?? 0) + (b.tm_hits ?? 0),
    deduplicated: (a.deduplicated ?? 0) + (b.deduplicated ?? 0),
    ai_translated: (a.ai_translated ?? 0) + (b.ai_translated ?? 0),
    tm_learned: (a.tm_learned ?? 0) + (b.tm_learned ?? 0),
    token_stats: {
      input_tokens: (a.token_stats?.input_tokens ?? 0) + (b.token_stats?.input_tokens ?? 0),
      output_tokens: (a.token_stats?.output_tokens ?? 0) + (b.token_stats?.output_tokens ?? 0),
      total_tokens: (a.token_stats?.total_tokens ?? 0) + (b.token_stats?.total_tokens ?? 0),
      cost: (a.token_stats?.cost ?? 0) + (b.token_stats?.cost ?? 0),
    },
  } as TranslationStats;
}


