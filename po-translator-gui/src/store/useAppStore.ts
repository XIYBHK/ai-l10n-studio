import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { POEntry, TranslationReport, AppConfig, TranslationStats } from '../types/tauri';

type ThemeMode = 'light' | 'dark';
type Language = 'zh-CN' | 'en-US';

interface AppState {
  // 文件状态
  entries: POEntry[];
  currentEntry: POEntry | null;
  currentIndex: number;
  currentFilePath: string | null; // 当前打开的文件路径
  
  // 翻译状态
  isTranslating: boolean;
  progress: number;
  report: TranslationReport | null;
  
  // 配置
  config: AppConfig | null;
  
  // 主题和语言（持久化）
  theme: ThemeMode;
  language: Language;
  
  // 累计统计（持久化）
  cumulativeStats: TranslationStats;
  
  // Actions
  setEntries: (entries: POEntry[]) => void;
  setCurrentEntry: (entry: POEntry | null) => void;
  setCurrentIndex: (index: number) => void;
  updateEntry: (index: number, entry: Partial<POEntry>) => void;
  setCurrentFilePath: (path: string | null) => void;
  
  setTranslating: (isTranslating: boolean) => void;
  setProgress: (progress: number) => void;
  setReport: (report: TranslationReport | null) => void;
  
  setConfig: (config: AppConfig) => void;
  
  // 主题和语言
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  setLanguage: (language: Language) => void;
  
  // 累计统计
  updateCumulativeStats: (stats: TranslationStats) => void;
  resetCumulativeStats: () => void;
  
  // 导航
  nextEntry: () => void;
  previousEntry: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // 初始状态
      entries: [],
      currentEntry: null,
      currentIndex: -1,
      currentFilePath: null,
      isTranslating: false,
      progress: 0,
      report: null,
      config: null,
      theme: 'light',
      language: 'zh-CN',
      cumulativeStats: {
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
      },
      
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
          set({ 
            currentIndex: index, 
            currentEntry: entries[index] 
          });
        }
      },
      
      updateEntry: (index, updates) => {
        const { entries } = get();
        if (index >= 0 && index < entries.length) {
          const newEntries = [...entries];
          newEntries[index] = { ...newEntries[index], ...updates };
          set({ entries: newEntries });
          
          // 如果更新的是当前条目，也要更新 currentEntry
          if (index === get().currentIndex) {
            set({ currentEntry: newEntries[index] });
          }
        }
      },
      
      setTranslating: (isTranslating) => set({ isTranslating }),
      setProgress: (progress) => set({ progress }),
      setReport: (report) => set({ report }),
      setConfig: (config) => set({ config }),
      
      // 主题和语言
      setTheme: (theme) => set({ theme }),
      toggleTheme: () => {
        const newTheme = get().theme === 'light' ? 'dark' : 'light';
        set({ theme: newTheme });
      },
      setLanguage: (language) => {
        set({ language });
      },
      
      // 累计统计
      updateCumulativeStats: (stats) => {
        const prev = get().cumulativeStats;
        set({
          cumulativeStats: {
            total: prev.total + stats.total,
            tm_hits: prev.tm_hits + stats.tm_hits,
            deduplicated: prev.deduplicated + stats.deduplicated,
            ai_translated: prev.ai_translated + stats.ai_translated,
            token_stats: {
              input_tokens: prev.token_stats.input_tokens + stats.token_stats.input_tokens,
              output_tokens: prev.token_stats.output_tokens + stats.token_stats.output_tokens,
              total_tokens: prev.token_stats.total_tokens + stats.token_stats.total_tokens,
              cost: prev.token_stats.cost + stats.token_stats.cost
            },
            tm_learned: prev.tm_learned + stats.tm_learned
          }
        });
      },
      
      resetCumulativeStats: () => {
        set({
          cumulativeStats: {
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
          }
        });
      },
      
      // 导航
      nextEntry: () => {
        const { currentIndex, entries } = get();
        if (currentIndex < entries.length - 1) {
          get().setCurrentIndex(currentIndex + 1);
        }
      },
      
      previousEntry: () => {
        const { currentIndex } = get();
        if (currentIndex > 0) {
          get().setCurrentIndex(currentIndex - 1);
        }
      },
    }),
    {
      name: 'app-storage',
      partialize: (state) => ({
        theme: state.theme,
        language: state.language,
        cumulativeStats: state.cumulativeStats,
      }),
    }
  )
);
