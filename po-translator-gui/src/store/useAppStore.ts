import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { POEntry, TranslationReport, AppConfig } from '../types/tauri';

type ThemeMode = 'light' | 'dark';
type Language = 'zh-CN' | 'en-US';

interface AppState {
  // 文件状态
  entries: POEntry[];
  currentEntry: POEntry | null;
  currentIndex: number;
  
  // 翻译状态
  isTranslating: boolean;
  progress: number;
  report: TranslationReport | null;
  
  // 配置
  config: AppConfig | null;
  
  // 主题和语言（持久化）
  theme: ThemeMode;
  language: Language;
  
  // Actions
  setEntries: (entries: POEntry[]) => void;
  setCurrentEntry: (entry: POEntry | null) => void;
  setCurrentIndex: (index: number) => void;
  updateEntry: (index: number, entry: Partial<POEntry>) => void;
  
  setTranslating: (isTranslating: boolean) => void;
  setProgress: (progress: number) => void;
  setReport: (report: TranslationReport | null) => void;
  
  setConfig: (config: AppConfig) => void;
  
  // 主题和语言
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  setLanguage: (language: Language) => void;
  
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
      isTranslating: false,
      progress: 0,
      report: null,
      config: null,
      theme: 'light',
      language: 'zh-CN',
      
      // Actions
      setEntries: (entries) => {
        set({ 
          entries, 
          currentEntry: entries.length > 0 ? entries[0] : null,
          currentIndex: entries.length > 0 ? 0 : -1
        });
      },
      
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
      }),
    }
  )
);
