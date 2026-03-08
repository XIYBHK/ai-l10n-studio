import { useEffect, useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import { lightTheme, darkTheme, semanticColors } from '../theme/config';
import { emit } from '@tauri-apps/api/event';
import { createModuleLogger } from '../utils/logger';

const log = createModuleLogger('useTheme');

type Theme = 'light' | 'dark' | 'system';

export const useTheme = () => {
  const themeMode = useAppStore((state) => state.theme);
  const systemTheme = useAppStore((state) => state.systemTheme);
  const setThemeMode = useAppStore((state) => state.setTheme);
  const setSystemTheme = useAppStore((state) => state.setSystemTheme);

  const appliedTheme = useMemo((): 'light' | 'dark' => {
    return themeMode === 'system' ? systemTheme : themeMode;
  }, [systemTheme, themeMode]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) {
      return;
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const syncSystemTheme = (matches: boolean) => {
      setSystemTheme(matches ? 'dark' : 'light');
    };

    syncSystemTheme(mediaQuery.matches);

    const handleChange = (event: MediaQueryListEvent) => {
      syncSystemTheme(event.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [setSystemTheme]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const root = window.document.documentElement;
    const body = window.document.body;

    root.setAttribute('data-theme', appliedTheme);
    body.setAttribute('data-theme', appliedTheme);

    root.classList.remove('light', 'dark');
    root.classList.add(appliedTheme);

    emit('theme:changed', { theme: themeMode, appliedTheme }).catch((err) => {
      console.error('[useTheme] 发送主题变更事件失败:', err);
    });

    log.debug('主题已切换', { themeMode, appliedTheme });
  }, [themeMode, appliedTheme]);

  const { themeConfig, colors } = useMemo(() => {
    const isDark = appliedTheme === 'dark';
    return {
      themeConfig: isDark ? darkTheme : lightTheme,
      colors: isDark ? semanticColors.dark : semanticColors.light,
    };
  }, [appliedTheme]);

  const toggleTheme = () => {
    const nextMode = appliedTheme === 'light' ? 'dark' : 'light';
    setThemeMode(nextMode);
  };

  const setTheme = (mode: Theme) => {
    setThemeMode(mode);
  };

  return {
    themeMode,
    appliedTheme,
    themeConfig,
    colors,
    toggleTheme,
    setTheme,
    isDark: appliedTheme === 'dark',
    isLight: appliedTheme === 'light',
    isSystem: themeMode === 'system',
  };
};

export type { Theme };
