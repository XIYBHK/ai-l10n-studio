/**
 * 设置状态管理（持久化）
 *
 * 管理用户设置，应用关闭后保留
 * 使用 TauriStore 替代 localStorage
 */

import { create } from 'zustand';
import { AppConfig } from '../types/tauri';
import { tauriStore } from './tauriStore';

type ThemeMode = 'light' | 'dark';
type Language = 'zh-CN' | 'en-US';

interface SettingsState {
  // 主题和语言
  theme: ThemeMode;
  language: Language;

  // 配置
  config: AppConfig | null;

  // Actions
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  setLanguage: (language: Language) => void;
  setConfig: (config: AppConfig) => void;
}

export const useSettingsStore = create<SettingsState>()((set, get) => ({
  // 初始状态
  theme: 'light',
  language: 'zh-CN',
  config: null,

  // Actions (持久化到 TauriStore)
  setTheme: (theme) => {
    set({ theme });
    tauriStore
      .setTheme(theme)
      .catch((err) => console.error('[useSettingsStore] 保存主题失败:', err));
  },

  toggleTheme: () => {
    const { theme } = get();
    const newTheme = theme === 'light' ? 'dark' : 'light';
    set({ theme: newTheme });
    tauriStore
      .setTheme(newTheme)
      .catch((err) => console.error('[useSettingsStore] 保存主题失败:', err));
  },

  setLanguage: (language) => {
    set({ language });
    tauriStore
      .setLanguage(language)
      .catch((err) => console.error('[useSettingsStore] 保存语言失败:', err));
  },

  setConfig: (config) => set({ config }),
}));

/**
 * 从 TauriStore 加载设置
 */
export async function loadSettings() {
  try {
    await tauriStore.init();

    const theme = await tauriStore.getTheme();
    const language = await tauriStore.getLanguage();

    useSettingsStore.setState({ theme, language });

    console.log('[useSettingsStore] 设置加载成功', { theme, language });
  } catch (error) {
    console.error('[useSettingsStore] 加载设置失败:', error);
  }
}
