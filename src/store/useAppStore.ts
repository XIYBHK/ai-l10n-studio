import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { AppConfig } from '../types/tauri';
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

  // Actions - 配置
  setConfig: (config: AppConfig) => void;

  // Actions - 主题和语言
  setTheme: (theme: ThemeMode) => void;
  setLanguage: (language: Language) => void;

  // 系统主题管理（全局单例）
  setSystemTheme: (systemTheme: 'light' | 'dark') => void;
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

// Actions Selectors
export const selectSetTheme = (state: AppState) => state.setTheme;
export const selectSetLanguage = (state: AppState) => state.setLanguage;
export const selectSetSystemTheme = (state: AppState) => state.setSystemTheme;
export const selectSetConfig = (state: AppState) => state.setConfig;

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

    log.info('持久化状态加载成功', { theme, language });
  } catch (error) {
    log.error('加载持久化状态失败', error);
  }
}
