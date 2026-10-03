import { useCallback, useEffect, useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import { lightTheme, darkTheme, semanticColors } from '../theme/config';
import { emit } from '@tauri-apps/api/event';

type Theme = 'light' | 'dark' | 'system';

export const useTheme = () => {
  const themeMode = useAppStore((state) => state.theme);
  const systemTheme = useAppStore((state) => state.systemTheme);
  const setThemeMode = useAppStore((state) => state.setTheme);

  const appliedTheme = useMemo((): 'light' | 'dark' => {
    return themeMode === 'system' ? systemTheme : themeMode;
  }, [systemTheme, themeMode]);

  const { themeConfig, colors } = useMemo(() => {
    const isDark = appliedTheme === 'dark';
    return {
      themeConfig: isDark ? darkTheme : lightTheme,
      colors: isDark ? semanticColors.dark : semanticColors.light,
    };
  }, [appliedTheme]);

  const toggleTheme = useCallback(() => {
    const nextMode = appliedTheme === 'light' ? 'dark' : 'light';
    setThemeMode(nextMode);
  }, [appliedTheme, setThemeMode]);
  const setTheme = setThemeMode;

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

export const useThemeRuntime = () => {
  const themeData = useTheme();
  const { appliedTheme, themeMode } = themeData;
  const setSystemTheme = useAppStore((state) => state.setSystemTheme);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const syncSystemTheme = (matches: boolean) => setSystemTheme(matches ? 'dark' : 'light');
    syncSystemTheme(mediaQuery.matches);
    const handleChange = (event: MediaQueryListEvent) => syncSystemTheme(event.matches);
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
      console.error('[useThemeRuntime] 发送主题变更事件失败:', err);
    });
  }, [themeMode, appliedTheme]);
  return themeData;
};

export type { Theme };
