import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { AppConfig, TranslationStats } from '../types/tauri';
import { tauriStore } from './tauriStore';
import { createModuleLogger } from '../utils/logger';

const log = createModuleLogger('useAppStore');

// Phase 9: 支持三种主题模式
type ThemeMode = 'light' | 'dark' | 'system';
type Language = 'zh-CN' | 'en-US';

function normalizeLanguage(language: string | null | undefined): Language {
  if (!language) {
    return 'zh-CN';
  }

  const normalized = language.toLowerCase();
  if (normalized === 'en' || normalized === 'en-us') {
    return 'en-US';
  }

  return 'zh-CN';
}

// 统计数据初始值常量
const INITIAL_STATS: TranslationStats = {
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

function getInitialSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined' || !window.matchMedia) {
    return 'light';
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export interface AppState {
  // 配置
  config: AppConfig | null;

  // 主题和语言（持久化）
  theme: ThemeMode;
  language: Language;

  // 🏗️ 系统主题状态（全局管理，参考 clash-verge-rev）
  systemTheme: 'light' | 'dark';

  // 累计统计（持久化）
  cumulativeStats: TranslationStats;

  // Actions - 配置
  setConfig: (config: AppConfig) => void;

  // Actions - 主题和语言
  setTheme: (theme: ThemeMode) => void;
  setLanguage: (language: Language) => void;

  // 🏗️ 系统主题管理（全局单例）
  setSystemTheme: (systemTheme: 'light' | 'dark') => void;

  // Actions - 累计统计
  updateCumulativeStats: (stats: TranslationStats) => void;
  resetCumulativeStats: () => void;
}

export const useAppStore = create<AppState>()(
  devtools(
    (set, get) => ({
      // 初始状态
      config: null,
      theme: 'system', // Phase 9: 默认跟随系统
      language: 'zh-CN',

      // 系统主题状态（运行时检测，不持久化）
      systemTheme: getInitialSystemTheme(),
      cumulativeStats: INITIAL_STATS,

      // Actions - 配置
      setConfig: (config) => set({ config }),

      // 主题和语言（持久化）
      setTheme: (theme) => {
        const currentTheme = get().theme;
        if (currentTheme === theme) {
          log.debug('跳过重复主题设置', {
            theme,
            reason: '主题相同',
            timestamp: new Date().toLocaleTimeString(),
          });
          return;
        }

        set({ theme });
        tauriStore.setTheme(theme).catch((err) => log.error('保存主题失败', err));
      },
      setLanguage: (language) => {
        const current = get().language;
        if (current === language) {
          return;
        }

        set({ language });
        tauriStore.setLanguage(language).catch((err) => log.error('保存语言失败', err));
      },

      // 系统主题管理（全局单例，不持久化）
      setSystemTheme: (systemTheme) => {
        const current = get().systemTheme;
        if (current === systemTheme) {
          log.debug('跳过重复系统主题设置', { systemTheme, reason: '系统主题相同' });
          return;
        }

        log.debug('更新全局系统主题', { from: current, to: systemTheme });
        set({ systemTheme });
      },

      // 累计统计（持久化到 TauriStore）
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

        tauriStore
          .updateCumulativeStats({
            totalTranslated: newStats.total,
            totalTokens: newStats.token_stats.total_tokens,
            totalCost: newStats.token_stats.cost,
            sessionCount: prev.total > 0 ? 1 : 0,
            lastUpdated: Date.now(),
            tmHits: newStats.tm_hits,
            deduplicated: newStats.deduplicated,
            aiTranslated: newStats.ai_translated,
            tmLearned: newStats.tm_learned,
            inputTokens: newStats.token_stats.input_tokens,
            outputTokens: newStats.token_stats.output_tokens,
          })
          .catch((err) => log.error('保存累计统计失败', err));
      },

      resetCumulativeStats: () => {
        set({ cumulativeStats: INITIAL_STATS });

        tauriStore
          .updateCumulativeStats({
            totalTranslated: 0,
            totalTokens: 0,
            totalCost: 0,
            sessionCount: 0,
            lastUpdated: Date.now(),
            tmHits: 0,
            deduplicated: 0,
            aiTranslated: 0,
            tmLearned: 0,
            inputTokens: 0,
            outputTokens: 0,
          })
          .catch((err) => log.error('重置累计统计失败', err));
      },
    }),
    { name: 'AppStore' }
  )
);

// ============================================
// 原子化 Selectors
// ============================================

// 状态 Selectors
export const selectTheme = (state: AppState) => state.theme;
export const selectLanguage = (state: AppState) => state.language;
export const selectSystemTheme = (state: AppState) => state.systemTheme;
export const selectConfig = (state: AppState) => state.config;
export const selectCumulativeStatsApp = (state: AppState) => state.cumulativeStats;

// Actions Selectors
export const selectSetTheme = (state: AppState) => state.setTheme;
export const selectSetLanguage = (state: AppState) => state.setLanguage;
export const selectSetSystemTheme = (state: AppState) => state.setSystemTheme;
export const selectSetConfig = (state: AppState) => state.setConfig;
export const selectUpdateCumulativeStatsApp = (state: AppState) => state.updateCumulativeStats;
export const selectResetCumulativeStatsApp = (state: AppState) => state.resetCumulativeStats;

// 便捷 Hooks
export const useThemeMode = () => useAppStore(selectTheme);
export const useLanguage = () => useAppStore(selectLanguage);
export const useSystemTheme = () => useAppStore(selectSystemTheme);
export const useSetThemeAction = () => useAppStore(selectSetTheme);
export const useSetLanguageAction = () => useAppStore(selectSetLanguage);

/**
 * 从 TauriStore 加载初始状态
 * 应该在应用启动时调用
 */
export async function loadPersistedState() {
  try {
    log.info('加载持久化状态...');

    await tauriStore.init();

    const theme = await tauriStore.getTheme();
    useAppStore.setState({ theme });

    const language = await tauriStore.getLanguage();
    useAppStore.setState({ language: normalizeLanguage(language) });

    const stats = await tauriStore.getCumulativeStats();
    useAppStore.setState({
      cumulativeStats: {
        total: stats.totalTranslated,
        tm_hits: stats.tmHits,
        deduplicated: stats.deduplicated,
        ai_translated: stats.aiTranslated,
        token_stats: {
          input_tokens: stats.inputTokens,
          output_tokens: stats.outputTokens,
          total_tokens: stats.totalTokens,
          cost: stats.totalCost,
        },
        tm_learned: stats.tmLearned,
      },
    });

    log.info('持久化状态加载成功', { theme, language, stats });
  } catch (error) {
    log.error('加载持久化状态失败', error);
  }
}
