import { create } from 'zustand';
import { POEntry, TranslationReport, AppConfig, TranslationStats } from '../types/tauri';
import { tauriStore } from './tauriStore';
import { createModuleLogger } from '../utils/logger';

// 创建模块专用日志记录器
const log = createModuleLogger('useAppStore');

// Phase 9: 支持三种主题模式
type ThemeMode = 'light' | 'dark' | 'system';
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
  
  // 🏗️ 系统主题状态（全局管理，参考 clash-verge-rev）
  systemTheme: 'light' | 'dark';

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
  setLanguage: (language: Language) => void;
  
  // 🏗️ 系统主题管理（全局单例）
  setSystemTheme: (systemTheme: 'light' | 'dark') => void;

  // 累计统计
  updateCumulativeStats: (stats: TranslationStats) => void;
  resetCumulativeStats: () => void;

  // 导航
  nextEntry: () => void;
  previousEntry: () => void;
}

export const useAppStore = create<AppState>()((set, get) => ({
  // 初始状态
  entries: [],
  currentEntry: null,
  currentIndex: -1,
  currentFilePath: null,
  isTranslating: false,
  progress: 0,
  report: null,
  config: null,
  theme: 'system', // Phase 9: 默认跟随系统
  language: 'zh-CN',
  
  // 🏗️ 系统主题状态（运行时检测，不持久化）
  systemTheme: (typeof window !== 'undefined' && window.matchMedia 
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : 'light') as 'light' | 'dark',
  cumulativeStats: {
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
  },

  // Actions
  setEntries: (entries) => {
    set({
      entries,
      currentEntry: entries.length > 0 ? entries[0] : null,
      currentIndex: entries.length > 0 ? 0 : -1,
    });
  },

  setCurrentFilePath: (path) => set({ currentFilePath: path }),

  setCurrentEntry: (entry) => {
    const { entries } = get();
    const index = entries.findIndex((e) => e === entry);
    set({ currentEntry: entry, currentIndex: index });
  },

  setCurrentIndex: (index) => {
    const { entries } = get();
    if (index >= 0 && index < entries.length) {
      set({
        currentIndex: index,
        currentEntry: entries[index],
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

  // 主题和语言 (持久化到 TauriStore)
  setTheme: (theme) => {
    // 🔄 防止重复设置相同主题（减少无意义的状态更新和日志）
    const currentTheme = get().theme;
    if (currentTheme === theme) {
      log.debug('跳过重复主题设置', { 
        theme, 
        reason: '主题相同', 
        timestamp: new Date().toLocaleTimeString() 
      });
      return;
    }
    
    set({ theme });
    // 异步保存到 TauriStore
    tauriStore.setTheme(theme).catch((err) => log.error('保存主题失败', err));
  },
  setLanguage: (language) => {
    const current = get().language;
    // 避免重复设置相同语言
    if (current === language) {
      return;
    }
    
    set({ language });
    // 异步保存到 TauriStore
    tauriStore
      .setLanguage(language)
      .catch((err) => console.error('[useAppStore] 保存语言失败:', err));
  },

  // 🏗️ 系统主题管理（全局单例，不持久化）
  setSystemTheme: (systemTheme) => {
    const current = get().systemTheme;
    if (current === systemTheme) {
      log.debug('跳过重复系统主题设置', { systemTheme, reason: '系统主题相同' });
      return;
    }
    
    log.debug('更新全局系统主题', { from: current, to: systemTheme });
    set({ systemTheme });
    // 🔄 系统主题不需要持久化到TauriStore，每次启动时重新检测
  },

  // 累计统计 (持久化到 TauriStore)
  updateCumulativeStats: (stats) => {
    const prev = get().cumulativeStats;
    const newStats = {
      total: prev.total + stats.total,
      tm_hits: prev.tm_hits + stats.tm_hits,
      deduplicated: prev.deduplicated + stats.deduplicated,
      ai_translated: prev.ai_translated + stats.ai_translated,
      token_stats: {
        input_tokens: prev.token_stats.input_tokens + stats.token_stats.input_tokens,
        output_tokens: prev.token_stats.output_tokens + stats.token_stats.output_tokens,
        total_tokens: prev.token_stats.total_tokens + stats.token_stats.total_tokens,
        cost: prev.token_stats.cost + stats.token_stats.cost,
      },
      tm_learned: prev.tm_learned + stats.tm_learned,
    };
    set({ cumulativeStats: newStats });

    // 异步保存到 TauriStore
    tauriStore
      .updateCumulativeStats({
        totalTranslated: newStats.total,
        totalTokens: newStats.token_stats.total_tokens,
        totalCost: newStats.token_stats.cost,
        sessionCount: prev.total > 0 ? 1 : 0, // 简化处理
        lastUpdated: Date.now(),
      })
      .catch((err) => console.error('[useAppStore] 保存累计统计失败:', err));
  },

  resetCumulativeStats: () => {
    const resetStats = {
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
    set({ cumulativeStats: resetStats });

    // 异步保存到 TauriStore
    tauriStore
      .updateCumulativeStats({
        totalTranslated: 0,
        totalTokens: 0,
        totalCost: 0,
        sessionCount: 0,
        lastUpdated: Date.now(),
      })
      .catch((err) => console.error('[useAppStore] 重置累计统计失败:', err));
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
}));

/**
 * 从 TauriStore 加载初始状态
 * 应该在应用启动时调用
 */
export async function loadPersistedState() {
  try {
    log.info('加载持久化状态...');

    // 初始化 TauriStore
    await tauriStore.init();

    // 加载主题（直接设置状态，避免循环调用 tauriStore.setTheme）
    const theme = await tauriStore.getTheme();
    useAppStore.setState({ theme });

    // 加载语言（直接设置状态，避免循环调用 tauriStore.setLanguage）
    const language = await tauriStore.getLanguage();
    useAppStore.setState({ language: language as any });

    // 加载累计统计
    const stats = await tauriStore.getCumulativeStats();
    useAppStore.setState({
      cumulativeStats: {
        total: stats.totalTranslated,
        tm_hits: 0,
        deduplicated: 0,
        ai_translated: 0,
        token_stats: {
          input_tokens: 0,
          output_tokens: 0,
          total_tokens: stats.totalTokens,
          cost: stats.totalCost,
        },
        tm_learned: 0,
      },
    });

    log.info('持久化状态加载成功', { theme, language, stats });
  } catch (error) {
    log.error('加载持久化状态失败', error);
  }
}
