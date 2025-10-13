import { useEffect, useMemo, useState } from 'react';
import { theme as antTheme } from 'antd';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useAppStore } from '../store/useAppStore';
import { lightTheme, darkTheme, semanticColors } from '../theme/config';

/**
 * 主题模式类型
 * - 'light': 浅色主题
 * - 'dark': 深色主题
 * - 'system': 跟随系统
 */
export type ThemeMode = 'light' | 'dark' | 'system';

/**
 * 实际应用的主题（不含 system）
 */
export type AppliedTheme = 'light' | 'dark';

/**
 * Phase 9: 增强版主题系统
 *
 * 特性：
 * 1. 支持三种模式：light/dark/system
 * 2. 系统主题自动监听和同步
 * 3. Tauri 窗口主题同步
 * 4. 持久化存储主题偏好
 *
 * 参考：clash-verge-rev/use-custom-theme.ts
 */
export const useTheme = () => {
  const themeMode = useAppStore((state: any) => state.theme);
  const setThemeMode = useAppStore((state: any) => state.setTheme);

  // Phase 9: 智能初始主题推断（避免闪烁）
  // 1. 如果用户选择了 light/dark，直接使用
  // 2. 如果是 system，先用系统 prefers-color-scheme 检测（同步，无闪烁）
  const getInitialTheme = (): AppliedTheme => {
    if (themeMode !== 'system') {
      return themeMode as AppliedTheme;
    }

    // 使用 CSS media query 同步检测系统主题（无闪烁）
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    return 'light'; // 降级
  };

  // 当前实际应用的主题（解析 system 为 light/dark）
  const [appliedTheme, setAppliedTheme] = useState<AppliedTheme>(getInitialTheme);

  // 1. 处理 system 模式：监听系统主题变化
  useEffect(() => {
    if (themeMode !== 'system') {
      // 非 system 模式：直接使用用户选择的主题
      setAppliedTheme(themeMode as AppliedTheme);
      return;
    }

    // Phase 9 优化：优先使用 CSS media query（同步，无闪烁）
    if (typeof window !== 'undefined' && window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

      // 设置初始主题
      setAppliedTheme(mediaQuery.matches ? 'dark' : 'light');

      // 监听系统主题变化（现代浏览器支持）
      const handleChange = (e: MediaQueryListEvent) => {
        console.log('[Theme] System theme changed (CSS):', e.matches ? 'dark' : 'light');
        setAppliedTheme(e.matches ? 'dark' : 'light');
      };

      mediaQuery.addEventListener('change', handleChange);

      return () => {
        mediaQuery.removeEventListener('change', handleChange);
      };
    }

    // 降级：使用 Tauri API（异步，可能闪烁）
    let isMounted = true;
    const appWindow = getCurrentWindow();

    appWindow
      .theme()
      .then((systemTheme) => {
        if (isMounted && systemTheme) {
          setAppliedTheme(systemTheme as AppliedTheme);
        }
      })
      .catch((err) => {
        console.error('[Theme] Failed to get system theme:', err);
        setAppliedTheme('light');
      });

    const unlistenPromise = appWindow.onThemeChanged(({ payload }) => {
      if (isMounted) {
        console.log('[Theme] System theme changed (Tauri):', payload);
        setAppliedTheme(payload as AppliedTheme);
      }
    });

    return () => {
      isMounted = false;
      unlistenPromise
        .then((unlisten) => {
          if (typeof unlisten === 'function') {
            unlisten();
          }
        })
        .catch((err) => {
          console.error('[Theme] Failed to unlisten theme changes:', err);
        });
    };
  }, [themeMode]);

  // 2. 同步 Tauri 窗口主题（用于原生标题栏）
  useEffect(() => {
    const appWindow = getCurrentWindow();

    appWindow.setTheme(appliedTheme).catch((err) => {
      console.error('[Theme] Failed to set window theme:', err);
    });
  }, [appliedTheme]);

  // 3. Ant Design 主题配置
  const themeConfig = useMemo(() => {
    return appliedTheme === 'dark' ? darkTheme : lightTheme;
  }, [appliedTheme]);

  const colors = useMemo(() => {
    return appliedTheme === 'dark' ? semanticColors.dark : semanticColors.light;
  }, [appliedTheme]);

  const algorithm = useMemo(() => {
    return appliedTheme === 'dark' ? antTheme.darkAlgorithm : antTheme.defaultAlgorithm;
  }, [appliedTheme]);

  // 4. 主题切换函数
  const toggleTheme = () => {
    // 循环切换：light -> dark -> system -> light
    const nextMode: ThemeMode =
      themeMode === 'light' ? 'dark' : themeMode === 'dark' ? 'system' : 'light';

    setThemeMode(nextMode);
  };

  const setTheme = (mode: ThemeMode) => {
    setThemeMode(mode);
  };

  return {
    // 用户选择的模式（可能是 system）
    themeMode,
    // 实际应用的主题（light 或 dark）
    appliedTheme,
    // Ant Design 配置
    themeConfig,
    colors,
    algorithm,
    // 操作函数
    toggleTheme,
    setTheme,
    // 便捷属性
    isDark: appliedTheme === 'dark',
    isLight: appliedTheme === 'light',
    isSystem: themeMode === 'system',
  };
};
