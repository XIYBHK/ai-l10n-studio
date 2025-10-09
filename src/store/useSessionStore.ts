/**
 * 会话状态管理（瞬态）
 * 
 * 管理当前会话的临时状态，应用关闭后不保留
 */

import { create } from 'zustand';
import { POEntry, TranslationReport, TranslationStats } from '../types/tauri';

interface SessionState {
  // 文件状态
  entries: POEntry[];
  currentEntry: POEntry | null;
  currentIndex: number;
  currentFilePath: string | null;
  
  // 翻译状态
  isTranslating: boolean;
  progress: number;
  report: TranslationReport | null;
  
  // 📊 本次会话统计（打开文件后的所有翻译聚合）
  sessionStats: TranslationStats;
  
  // Actions
  setEntries: (entries: POEntry[]) => void;
  setCurrentEntry: (entry: POEntry | null) => void;
  setCurrentIndex: (index: number) => void;
  updateEntry: (index: number, entry: Partial<POEntry>) => void;
  setCurrentFilePath: (path: string | null) => void;
  
  setTranslating: (isTranslating: boolean) => void;
  setProgress: (progress: number) => void;
  setReport: (report: TranslationReport | null) => void;
  
  // 会话统计
  updateSessionStats: (stats: TranslationStats) => void;
  setSessionStats: (stats: TranslationStats) => void; // 直接设置（用于 StatsEngine）
  resetSessionStats: () => void;
  
  // 导航
  nextEntry: () => void;
  previousEntry: () => void;
  
  // 重置
  reset: () => void;
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
    cost: 0
  },
  tm_learned: 0
};

export const useSessionStore = create<SessionState>((set, get) => ({
  // 初始状态
  entries: [],
  currentEntry: null,
  currentIndex: -1,
  currentFilePath: null,
  isTranslating: false,
  progress: 0,
  report: null,
  sessionStats: initialSessionStats,
  
  // Actions
  setEntries: (entries) => {
    set({ 
      entries, 
      currentEntry: entries.length > 0 ? entries[0] : null,
      currentIndex: entries.length > 0 ? 0 : -1
    });
  },
  
  setCurrentFilePath: (path) => set({ currentFilePath: path }),
  
  setCurrentEntry: (entry) => {
    const { entries } = get();
    const index = entries.findIndex(e => e === entry);
    set({ currentEntry: entry, currentIndex: index });
  },
  
  setCurrentIndex: (index) => {
    const { entries } = get();
    if (index >= 0 && index < entries.length) {
      set({ currentIndex: index, currentEntry: entries[index] });
    }
  },
  
  updateEntry: (index, partialEntry) => {
    const { entries } = get();
    const updatedEntries = [...entries];
    updatedEntries[index] = { ...updatedEntries[index], ...partialEntry };
    
    set({ 
      entries: updatedEntries,
      currentEntry: updatedEntries[index]
    });
  },
  
  setTranslating: (isTranslating) => set({ isTranslating }),
  setProgress: (progress) => set({ progress }),
  setReport: (report) => set({ report }),
  
  // 📊 会话统计管理
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
        output_tokens: (sessionStats.token_stats.output_tokens ?? 0) + delta.token_stats.output_tokens,
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
  
  // 导航
  nextEntry: () => {
    const { entries, currentIndex } = get();
    const nextIndex = Math.min(currentIndex + 1, entries.length - 1);
    if (nextIndex !== currentIndex) {
      set({ 
        currentIndex: nextIndex, 
        currentEntry: entries[nextIndex] 
      });
    }
  },
  
  previousEntry: () => {
    const { currentIndex, entries } = get();
    const prevIndex = Math.max(currentIndex - 1, 0);
    if (prevIndex !== currentIndex) {
      set({ 
        currentIndex: prevIndex, 
        currentEntry: entries[prevIndex] 
      });
    }
  },
  
  // 重置所有状态
  reset: () => {
    set({
      entries: [],
      currentEntry: null,
      currentIndex: -1,
      currentFilePath: null,
      isTranslating: false,
      progress: 0,
      report: null,
      sessionStats: initialSessionStats, // 重置会话统计
    });
  }
}));

