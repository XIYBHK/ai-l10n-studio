/**
 * 会话状态管理（瞬态）
 *
 * 职责：
 * - 管理翻译进度状态（isTranslating, progress, report）
 * - 管理会话统计（sessionStats）
 * - 不再管理 entries 相关状态（已迁移到 useTranslationStore）
 *
 * 注意：此 Store 的状态不持久化，应用关闭后清空
 */

import { create } from 'zustand';
import { TranslationReport, TranslationStats } from '../types/tauri';

interface SessionState {
  // 翻译状态
  isTranslating: boolean;
  progress: number;
  report: TranslationReport | null;

  // 📊 本次会话统计（打开文件后的所有翻译聚合）
  sessionStats: TranslationStats;

  // Actions - 翻译状态
  setTranslating: (isTranslating: boolean) => void;
  setProgress: (progress: number) => void;
  setReport: (report: TranslationReport | null) => void;

  // Actions - 会话统计
  updateSessionStats: (stats: TranslationStats) => void;
  setSessionStats: (stats: TranslationStats) => void; // 直接设置（用于 StatsEngine）
  resetSessionStats: () => void;
}

const initialSessionStats: TranslationStats = {
  total: 0,
  tm_hits: 0,
  deduplicated: 0,
  ai_translated: 0,
  token_stats: {
    input_tokens: 0,
    output_tokens: 0,
    total_tokens: 0,
    cost: 0,
  },
  tm_learned: 0,
};

export const useSessionStore = create<SessionState>((set, get) => ({
  // 初始状态
  isTranslating: false,
  progress: 0,
  report: null,
  sessionStats: initialSessionStats,

  // Actions - 翻译状态
  setTranslating: (isTranslating) => set({ isTranslating }),
  setProgress: (progress) => set({ progress }),
  setReport: (report) => set({ report }),

  // Actions - 📊 会话统计管理
  updateSessionStats: (stats) => {
    const { sessionStats } = get();
    // 数值化防御，避免出现字符串或 undefined 导致 NaN
    const delta: TranslationStats = {
      total: Number(stats.total ?? 0),
      tm_hits: Number(stats.tm_hits ?? 0),
      deduplicated: Number(stats.deduplicated ?? 0),
      ai_translated: Number(stats.ai_translated ?? 0),
      tm_learned: Number(stats.tm_learned ?? 0),
      token_stats: {
        input_tokens: Number(stats.token_stats?.input_tokens ?? 0),
        output_tokens: Number(stats.token_stats?.output_tokens ?? 0),
        total_tokens: Number(stats.token_stats?.total_tokens ?? 0),
        cost: Number(stats.token_stats?.cost ?? 0),
      },
    } as TranslationStats;

    const newStats: TranslationStats = {
      total: (sessionStats.total ?? 0) + delta.total,
      tm_hits: (sessionStats.tm_hits ?? 0) + delta.tm_hits,
      deduplicated: (sessionStats.deduplicated ?? 0) + delta.deduplicated,
      ai_translated: (sessionStats.ai_translated ?? 0) + delta.ai_translated,
      token_stats: {
        input_tokens: (sessionStats.token_stats.input_tokens ?? 0) + delta.token_stats.input_tokens,
        output_tokens:
          (sessionStats.token_stats.output_tokens ?? 0) + delta.token_stats.output_tokens,
        total_tokens: (sessionStats.token_stats.total_tokens ?? 0) + delta.token_stats.total_tokens,
        cost: (sessionStats.token_stats.cost ?? 0) + delta.token_stats.cost,
      },
      tm_learned: (sessionStats.tm_learned ?? 0) + delta.tm_learned,
    };
    set({ sessionStats: newStats });
  },

  setSessionStats: (stats) => {
    set({ sessionStats: stats });
  },

  resetSessionStats: () => {
    set({ sessionStats: initialSessionStats });
  },
}));
