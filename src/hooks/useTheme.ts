import { useEffect, useMemo } from 'react';
import { theme as antTheme } from 'antd';
import { useAppStore } from '../store/useAppStore';
import { lightTheme, darkTheme, semanticColors } from '../theme/config';

// 🚀 简化版主题系统 - 参考 cc-switch 的简洁实现
// 从原来的 253 行简化到 ~100 行

type Theme = 'light' | 'dark' | 'system';

// 简化的 useTheme Hook（直接操作 DOM，无复杂状态管理）
export const useTheme = () => {
  const themeMode = useAppStore((state: any) => state.theme);
  const setThemeMode = useAppStore((state: any) => state.setTheme);

  // 获取系统主题
  const getSystemTheme = (): 'light' | 'dark' => {
    if (typeof window === 'undefined' || !window.matchMedia) {
      return 'light';
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  };

  // 计算实际应用的主题（light 或 dark）
  const appliedTheme = useMemo((): 'light' | 'dark' => {
    return themeMode === 'system' ? getSystemTheme() : themeMode;
  }, [themeMode]);

  // 同步主题到 DOM 和本地存储
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

    // 保存到本地存储
    window.localStorage.setItem('theme', themeMode);
  }, [themeMode]);

  // 监听系统主题变化（仅在 system 模式下）
  useEffect(() => {
    if (themeMode !== 'system' || typeof window === 'undefined') {
      return;
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      // 强制触发重新渲染
      setThemeMode('system');
    };

    // 立即调用一次
    handleChange();

    // 监听变化
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [themeMode, setThemeMode]);

  // Ant Design 主题配置
  const themeConfig = useMemo(() => {
    return appliedTheme === 'dark' ? darkTheme : lightTheme;
  }, [appliedTheme]);

  const colors = useMemo(() => {
    return appliedTheme === 'dark' ? semanticColors.dark : semanticColors.light;
  }, [appliedTheme]);

  const algorithm = useMemo(() => {
    return appliedTheme === 'dark' ? antTheme.darkAlgorithm : antTheme.defaultAlgorithm;
  }, [appliedTheme]);

  // 简化的切换函数
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

// 保留类型导出以兼容现有代码
export type { Theme };
