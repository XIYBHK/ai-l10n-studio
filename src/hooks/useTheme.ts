import { useEffect, useMemo, useState } from 'react';
import { theme as antTheme } from 'antd';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useAppStore } from '../store/useAppStore';
import { lightTheme, darkTheme, semanticColors } from '../theme/config';
import { createModuleLogger } from '../utils/logger';

// 🏗️ 使用项目标准的防重复初始化框架模式（参考 StatsManagerV2）
let systemThemeListenerInitialized = false;
let systemThemeCleanup: (() => void) | null = null;

// 🏗️ 全局主题变化日志控制（防重复日志）
let lastLoggedThemeTransition: string | null = null;

/**
 * 🏗️ 智能主题变化日志记录器（全局去重）
 */
function logThemeChange(from: AppliedTheme, to: AppliedTheme, themeMode: ThemeMode, reason: string) {
  const transitionKey = `${from}->${to}:${themeMode}:${reason}`;
  
  // 🔇 防重复：相同的主题变化只记录一次
  if (lastLoggedThemeTransition === transitionKey) {
    return;
  }
  
  lastLoggedThemeTransition = transitionKey;
  
  // 📝 使用全局日志记录器
  const log = createModuleLogger('useTheme');
  log.debug('主题更新', { 
    from, 
    to, 
    themeMode,
    reason,
    timestamp: new Date().toLocaleTimeString()
  });
  
  // 🕐 500ms后清除记录，允许后续相同变化
  setTimeout(() => {
    if (lastLoggedThemeTransition === transitionKey) {
      lastLoggedThemeTransition = null;
    }
  }, 500);
}

// 🏗️ 全局管理器状态（用于缓存setSystemTheme函数）
let globalSetSystemTheme: ((theme: 'light' | 'dark') => void) | null = null;

/**
 * 🏗️ 全局系统主题管理器初始化（参考 clash-verge-rev）
 * 在应用启动时调用，确保全局状态正确初始化
 */
export function initializeGlobalSystemThemeManager(setSystemTheme: (theme: 'light' | 'dark') => void) {
  // 🏗️ 使用项目标准的防重复初始化模式
  if (systemThemeListenerInitialized) {
    return;
  }
  
  systemThemeListenerInitialized = true;
  globalSetSystemTheme = setSystemTheme; // 缓存函数引用
  
  if (typeof window !== 'undefined' && window.matchMedia) {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    let lastSystemTheme: AppliedTheme = mediaQuery.matches ? 'dark' : 'light';
    
    // 🏗️ 全局系统主题变化处理器（直接更新全局状态）
    const handleSystemThemeChange = (forceUpdate = false) => {
      const mediaQueryMatches = mediaQuery.matches;
      const newSystemTheme = mediaQueryMatches ? 'dark' : 'light';
      
      if (lastSystemTheme !== newSystemTheme || forceUpdate) {
        const log = createModuleLogger('SystemThemeManager');
        
        // 🔍 详细调试：显示所有检测信息
        const debugInfo = {
          mediaQueryMatches,
          mediaQueryMedia: mediaQuery.media,
          newSystemTheme,
          from: lastSystemTheme,
          to: newSystemTheme,
          forceUpdate,
          timestamp: new Date().toLocaleTimeString(),
          // 🔍 额外检测：直接查询当前媒体查询状态
          directCheck: window.matchMedia('(prefers-color-scheme: dark)').matches,
          // 🔍 检查是否有其他媒体查询干扰
          lightCheck: window.matchMedia('(prefers-color-scheme: light)').matches,
          // 🔍 检查CSS计算样式（备用检测方法）
          computedColorScheme: getComputedStyle(document.documentElement).colorScheme,
          // 🔍 用户实际预期（请在控制台确认）
          userNote: '请确认您的系统主题设置：Windows设置→个性化→颜色→选择模式',
        };
        
        if (forceUpdate) {
          log.debug('🚀 初始化系统主题（详细调试）', debugInfo);
        } else {
          log.debug('全局系统主题变化（详细调试）', debugInfo);
        }
        
        lastSystemTheme = newSystemTheme;

        // 🏗️ 直接更新全局状态（不再发送事件，避免多实例重复处理）
        if (globalSetSystemTheme) {
          globalSetSystemTheme(newSystemTheme);
        }
      }
    };

    // 🚀 立即执行一次，强制同步初始状态
    handleSystemThemeChange(true);
    
    const changeListener = () => handleSystemThemeChange();
    mediaQuery.addEventListener('change', changeListener);
    systemThemeCleanup = () => {
      mediaQuery.removeEventListener('change', changeListener);
      systemThemeListenerInitialized = false;
      systemThemeCleanup = null;
      globalSetSystemTheme = null; // 清理引用
    };
  }
}

/**
 * 🏗️ 清理全局系统主题监听器
 * 用于应用卸载时清理资源
 */
export function cleanupGlobalSystemThemeListener() {
  if (systemThemeCleanup) {
    systemThemeCleanup();
  }
}

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

// 创建模块专用日志记录器
const log = createModuleLogger('useTheme');

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
  
  // 🏗️ 使用全局systemTheme状态（参考 clash-verge-rev）
  const systemTheme = useAppStore((state: any) => state.systemTheme);
  const setSystemTheme = useAppStore((state: any) => state.setSystemTheme);

  // 🏗️ 直接计算实际主题（无状态延迟，参考 clash-verge-rev）
  const appliedTheme = useMemo((): AppliedTheme => {
    return themeMode === 'system' ? systemTheme : (themeMode as AppliedTheme);
  }, [themeMode, systemTheme]);

  // 🏗️ 组件初始化：确保全局管理器已初始化（参考 clash-verge-rev）
  useEffect(() => {
    // 🏗️ 确保全局管理器已初始化，传递setSystemTheme函数
    initializeGlobalSystemThemeManager(setSystemTheme);
    
    // 🏗️ 不再需要监听事件，直接从全局状态读取
    // 全局管理器会直接更新 useAppStore.systemTheme
  }, [setSystemTheme]); // 依赖setSystemTheme函数

  // 2. 同步 Tauri 窗口主题（用于原生标题栏）
  useEffect(() => {
    const appWindow = getCurrentWindow();
    appWindow.setTheme(appliedTheme).catch((err) => {
      log.error('❌ 设置 Tauri 窗口主题失败', err);
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
  const toggleTheme = (source: string = '未知') => {
    // 🔄 新逻辑：基于当前实际应用的主题来切换，而不是基于模式
    // 这样确保每次点击都有明确的视觉反馈
    const nextMode: ThemeMode = appliedTheme === 'light' ? 'dark' : 'light';

    log.debug('用户点击按钮', { 
      source: `${source}按钮`,
      currentMode: themeMode, 
      currentApplied: appliedTheme,
      nextMode: `${nextMode}（基于appliedTheme）`,
      timestamp: new Date().toLocaleTimeString()
    });
    
    setThemeMode(nextMode);
  };

  const setTheme = (mode: ThemeMode, source: string = '未知') => {
    // 🔄 防止设置相同的主题模式
    if (themeMode === mode) {
      log.debug('跳过重复设置', { 
        mode,
        source: `${source}选择`,
        reason: '主题模式相同'
      });
      return;
    }

    log.debug('直接设置主题', { 
      source: `${source}选择`,
      currentMode: themeMode,
      targetMode: mode,
      appliedTheme,
      timestamp: new Date().toLocaleTimeString()
    });
    
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
