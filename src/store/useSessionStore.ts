/**
 * 会话状态管理（瞬态）
 *
 * 职责：
 * - 管理翻译进度状态（isTranslating, progress, report）
 * - 管理会话统计（sessionStats）
 *
 * 注意：此 Store 的状态不持久化，应用关闭后清空
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { TranslationReport, TranslationStats } from '../types/tauri';

const INITIAL_SESSION_STATS: TranslationStats = {
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

interface SessionState {
  // 翻译状态
  isTranslating: boolean;
  progress: number;
  report: TranslationReport | null;

  // 本次会话统计（打开文件后的所有翻译聚合）
  sessionStats: TranslationStats;

  // Actions - 翻译状态
  setTranslating: (isTranslating: boolean) => void;
  setProgress: (progress: number) => void;
  setReport: (report: TranslationReport | null) => void;

  // Actions - 会话统计
  updateSessionStats: (stats: TranslationStats) => void;
  setSessionStats: (stats: TranslationStats) => void;
  resetSessionStats: () => void;
}

export const useSessionStore = create<SessionState>()(
  devtools(
    (set, get) => ({
      // 初始状态
      isTranslating: false,
      progress: 0,
      report: null,
      sessionStats: INITIAL_SESSION_STATS,

      // Actions - 翻译状态
      setTranslating: (isTranslating) => set({ isTranslating }),
      setProgress: (progress) => set({ progress }),
      setReport: (report) => set({ report }),

      // Actions - 会话统计管理
      updateSessionStats: (stats) => {
        const { sessionStats } = get();
        const newStats: TranslationStats = {
          total: sessionStats.total + stats.total,
          tm_hits: sessionStats.tm_hits + stats.tm_hits,
          deduplicated: sessionStats.deduplicated + stats.deduplicated,
          ai_translated: sessionStats.ai_translated + stats.ai_translated,
          token_stats: {
            input_tokens: sessionStats.token_stats.input_tokens + stats.token_stats.input_tokens,
            output_tokens: sessionStats.token_stats.output_tokens + stats.token_stats.output_tokens,
            total_tokens: sessionStats.token_stats.total_tokens + stats.token_stats.total_tokens,
            cost: sessionStats.token_stats.cost + stats.token_stats.cost,
          },
          tm_learned: sessionStats.tm_learned + stats.tm_learned,
        };
        set({ sessionStats: newStats });
      },

      setSessionStats: (stats) => {
        set({ sessionStats: stats });
      },

      resetSessionStats: () => {
        set({ sessionStats: INITIAL_SESSION_STATS });
      },
    }),
    { name: 'SessionStore' }
  )
);

// ============================================
// 原子化 Selectors
// ============================================

// 基础状态 Selectors
export const selectIsTranslating = (state: SessionState) => state.isTranslating;
export const selectProgress = (state: SessionState) => state.progress;
export const selectReport = (state: SessionState) => state.report;
export const selectSessionStats = (state: SessionState) => state.sessionStats;

// Actions Selectors
export const selectSetTranslating = (state: SessionState) => state.setTranslating;
export const selectSetProgress = (state: SessionState) => state.setProgress;
export const selectSetReport = (state: SessionState) => state.setReport;
export const selectUpdateSessionStats = (state: SessionState) => state.updateSessionStats;
export const selectSetSessionStats = (state: SessionState) => state.setSessionStats;
export const selectResetSessionStats = (state: SessionState) => state.resetSessionStats;

// 便捷 Hooks
export const useIsTranslating = () => useSessionStore(selectIsTranslating);
export const useProgress = () => useSessionStore(selectProgress);
export const useReport = () => useSessionStore(selectReport);
export const useSessionStats = () => useSessionStore(selectSessionStats);

// Actions Hooks
export const useSetTranslating = () => useSessionStore(selectSetTranslating);
export const useSetProgress = () => useSessionStore(selectSetProgress);
export const useUpdateSessionStats = () => useSessionStore(selectUpdateSessionStats);
export const useResetSessionStats = () => useSessionStore(selectResetSessionStats);
