import { useEffect, useMemo } from 'react';
import { theme as antTheme } from 'antd';
import { useAppStore } from '../store/useAppStore';
import { lightTheme, darkTheme, semanticColors } from '../theme/config';
import { emit } from '@tauri-apps/api/event';

type Theme = 'light' | 'dark' | 'system';

export const useTheme = () => {
  const themeMode = useAppStore((state) => state.theme);
  const setThemeMode = useAppStore((state) => state.setTheme);

  const getSystemTheme = (): 'light' | 'dark' => {
    if (typeof window === 'undefined' || !window.matchMedia) {
      return 'light';
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  };

  const appliedTheme = useMemo((): 'light' | 'dark' => {
    return themeMode === 'system' ? getSystemTheme() : themeMode;
  }, [themeMode]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');

    if (themeMode === 'system') {
      const isDark = getSystemTheme() === 'dark';
      root.classList.add(isDark ? 'dark' : 'light');
    } else {
      root.classList.add(themeMode);
    }

    const currentColors = appliedTheme === 'dark' ? semanticColors.dark : semanticColors.light;
    Object.entries(currentColors).forEach(([key, value]) => {
      root.style.setProperty(`--color-${key}`, value as string);
    });

    window.localStorage.setItem('theme', themeMode);

    emit('theme:changed', { theme: themeMode }).catch((err) => {
      console.error('[useTheme] 发送主题变更事件失败:', err);
    });
  }, [themeMode, appliedTheme]);

  useEffect(() => {
    if (themeMode !== 'system' || typeof window === 'undefined') {
      return;
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      setThemeMode('system');
    };

    handleChange();
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [themeMode, setThemeMode]);

  const { themeConfig, colors, algorithm } = useMemo(() => {
    const isDark = appliedTheme === 'dark';
    return {
      themeConfig: isDark ? darkTheme : lightTheme,
      colors: isDark ? semanticColors.dark : semanticColors.light,
      algorithm: isDark ? antTheme.darkAlgorithm : antTheme.defaultAlgorithm,
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
    algorithm,
    toggleTheme,
    setTheme,
    isDark: appliedTheme === 'dark',
    isLight: appliedTheme === 'light',
    isSystem: themeMode === 'system',
  };
};

export type { Theme };
