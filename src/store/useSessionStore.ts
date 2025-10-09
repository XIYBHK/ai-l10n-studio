/**
 * 会话状态管理（瞬态）
 * 
 * 管理当前会话的临时状态，应用关闭后不保留
 */

import { create } from 'zustand';
import { POEntry, TranslationReport } from '../types/tauri';

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
  
  // Actions
  setEntries: (entries: POEntry[]) => void;
  setCurrentEntry: (entry: POEntry | null) => void;
  setCurrentIndex: (index: number) => void;
  updateEntry: (index: number, entry: Partial<POEntry>) => void;
  setCurrentFilePath: (path: string | null) => void;
  
  setTranslating: (isTranslating: boolean) => void;
  setProgress: (progress: number) => void;
  setReport: (report: TranslationReport | null) => void;
  
  // 导航
  nextEntry: () => void;
  previousEntry: () => void;
  
  // 重置
  reset: () => void;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  // 初始状态
  entries: [],
  currentEntry: null,
  currentIndex: -1,
  currentFilePath: null,
  isTranslating: false,
  progress: 0,
  report: null,
  
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
    });
  }
}));

