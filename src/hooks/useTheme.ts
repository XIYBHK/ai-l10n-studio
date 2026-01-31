import { useEffect, useMemo } from 'react';
import { theme as antTheme } from 'antd';
import { useAppStore } from '../store/useAppStore';
import { lightTheme, darkTheme, semanticColors } from '../theme/config';
import { emit } from '@tauri-apps/api/event';
import { createModuleLogger } from '../utils/logger';

const log = createModuleLogger('useTheme');

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
    const body = window.document.body;
    
    // 确定实际应用的主题
    const effectiveTheme = themeMode === 'system' ? getSystemTheme() : themeMode;
    
    // 使用 data-theme 属性触发 CSS 变量切换（性能优化）
    root.setAttribute('data-theme', effectiveTheme);
    body.setAttribute('data-theme', effectiveTheme);
    
    // 为兼容性保留 class（某些组件可能依赖）
    root.classList.remove('light', 'dark');
    root.classList.add(effectiveTheme);

    // 本地存储
    window.localStorage.setItem('theme', themeMode);

    // 发送事件通知
    emit('theme:changed', { theme: themeMode }).catch((err) => {
      console.error('[useTheme] 发送主题变更事件失败:', err);
    });
    
    log.debug('主题已切换', { themeMode, effectiveTheme });
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
