/**
 * 全局数据提供者（AppDataProvider）
 *
 * 参考 clash-verge-rev 设计，提供：
 * 1. 统一的数据访问接口
 * 2. 集中的刷新控制
 * 3. 全局加载状态管理
 * 4. 自动事件监听和数据同步
 *
 * 使用方式：
 * ```typescript
 * // 在 App.tsx 中包裹
 * <AppDataProvider>
 *   <YourApp />
 * </AppDataProvider>
 *
 * // 在组件中使用
 * const { config, aiConfigs, refreshAll } = useAppData();
 * ```
 */

import React, { createContext, useContext, useCallback, useMemo } from 'react';
import { useAppConfig, useAIConfigs, useSystemPrompt } from '../hooks/useConfig';
import { useTermLibrary } from '../hooks/useTermLibrary';
import { useTranslationMemory } from '../hooks/useTranslationMemory';
import { useDefaultTauriEventBridge } from '../hooks/useTauriEventBridge.enhanced';
import { createModuleLogger } from '../utils/logger';

// 🏗️ 使用项目标准的防重复初始化框架模式（参考 StatsManagerV2）
let appDataProviderLogged = false;

const log = createModuleLogger('AppDataProvider');

// ========================================
// 类型定义
// ========================================

interface AppDataContextType {
  // ===== 数据 =====
  /** 应用配置 */
  config: any | null;
  /** AI配置列表 */
  aiConfigs: any[];
  /** 当前活动的AI配置 */
  activeAIConfig: any | null;
  /** 系统提示词 */
  systemPrompt: string;
  /** 术语库 */
  termLibrary: any | null;
  /** 翻译记忆库 */
  translationMemory: any | null;

  // ===== 刷新方法 =====
  /** 刷新应用配置 */
  refreshConfig: () => Promise<void>;
  /** 刷新AI配置 */
  refreshAIConfigs: () => Promise<void>;
  /** 刷新系统提示词 */
  refreshSystemPrompt: () => Promise<void>;
  /** 刷新术语库 */
  refreshTermLibrary: () => Promise<void>;
  /** 刷新翻译记忆库 */
  refreshTranslationMemory: () => Promise<void>;
  /** 一键刷新所有数据 */
  refreshAll: () => Promise<void>;

  // ===== 状态 =====
  /** 是否正在加载（任一数据源正在加载） */
  isLoading: boolean;
  /** 是否有错误 */
  hasError: boolean;
}

// ========================================
// Context 定义
// ========================================

const AppDataContext = createContext<AppDataContextType | null>(null);

// ========================================
// Provider 组件
// ========================================

interface AppDataProviderProps {
  children: React.ReactNode;
}

export function AppDataProvider({ children }: AppDataProviderProps) {
  // 🏗️ 使用项目标准的防重复框架模式，减少日志频率
  if (!appDataProviderLogged) {
    appDataProviderLogged = true;
    log.debug('渲染 AppDataProvider（初次）');
  }

  // ===== 数据源集成 =====
  const {
    config,
    mutate: mutateConfig,
    isLoading: configLoading,
    error: configError,
  } = useAppConfig();

  const {
    configs: aiConfigs,
    active: activeAIConfig,
    mutateAll: mutateAIConfigs,
    mutateActive: mutateActiveAIConfig,
    loading: aiLoading,
    error: aiError,
  } = useAIConfigs();

  const {
    prompt: systemPrompt,
    mutate: mutateSystemPrompt,
    isLoading: promptLoading,
    error: promptError,
  } = useSystemPrompt();

  const {
    termLibrary,
    mutate: mutateTermLibrary,
    isLoading: termLoading,
    error: termError,
  } = useTermLibrary({ enabled: true });

  const {
    tm: translationMemory,
    mutate: mutateTranslationMemory,
    isLoading: memoryLoading,
    error: memoryError,
  } = useTranslationMemory();

  // ===== 自动事件监听 =====
  useDefaultTauriEventBridge();

  // ===== 刷新方法 =====
  const refreshConfig = useCallback(async () => {
    log.debug('刷新配置');
    await mutateConfig();
  }, [mutateConfig]);

  const refreshAIConfigs = useCallback(async () => {
    log.debug('刷新AI配置');
    await Promise.all([mutateAIConfigs(), mutateActiveAIConfig()]);
  }, [mutateAIConfigs, mutateActiveAIConfig]);

  const refreshSystemPrompt = useCallback(async () => {
    log.debug('刷新系统提示词');
    await mutateSystemPrompt();
  }, [mutateSystemPrompt]);

  const refreshTermLibrary = useCallback(async () => {
    log.debug('刷新术语库');
    await mutateTermLibrary();
  }, [mutateTermLibrary]);

  const refreshTranslationMemory = useCallback(async () => {
    log.debug('刷新翻译记忆库');
    await mutateTranslationMemory();
  }, [mutateTranslationMemory]);

  // ⭐ 统一刷新接口 - 这是核心功能
  const refreshAll = useCallback(async () => {
    log.info('🔄 开始刷新所有数据...');
    const startTime = performance.now();

    try {
      await Promise.all([
        refreshConfig(),
        refreshAIConfigs(),
        refreshSystemPrompt(),
        refreshTermLibrary(),
        refreshTranslationMemory(),
      ]);

      const duration = (performance.now() - startTime).toFixed(2);
      log.info(`✅ 刷新完成，耗时 ${duration}ms`);
    } catch (error) {
      log.error('刷新失败', error);
      throw error;
    }
  }, [
    refreshConfig,
    refreshAIConfigs,
    refreshSystemPrompt,
    refreshTermLibrary,
    refreshTranslationMemory,
  ]);

  // ===== 状态聚合 =====
  const isLoading = useMemo(() => {
    return configLoading || aiLoading || promptLoading || termLoading || memoryLoading;
  }, [configLoading, aiLoading, promptLoading, termLoading, memoryLoading]);

  const hasError = useMemo(() => {
    return !!(configError || aiError || promptError || termError || memoryError);
  }, [configError, aiError, promptError, termError, memoryError]);

  // ===== Context Value =====
  const value = useMemo<AppDataContextType>(
    () => ({
      // 数据
      config,
      aiConfigs,
      activeAIConfig,
      systemPrompt,
      termLibrary,
      translationMemory,

      // 刷新方法（使用 useCallback 稳定引用）
      refreshConfig,
      refreshAIConfigs,
      refreshSystemPrompt,
      refreshTermLibrary,
      refreshTranslationMemory,
      refreshAll,

      // 状态
      isLoading,
      hasError,
    }),
    [
      // 🔄 简化依赖数组，只包含真正影响 context value 的数据
      // 数据依赖
      config,
      aiConfigs,
      activeAIConfig,
      systemPrompt,
      termLibrary,
      translationMemory,
      // 状态依赖
      isLoading,
      hasError,
      // 方法依赖（已通过 useCallback 稳定）
      refreshAll,
    ]
  );

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

// ========================================
// Custom Hook
// ========================================

/**
 * 使用全局应用数据
 *
 * ⚠️ 必须在 AppDataProvider 内部使用
 *
 * @example
 * ```typescript
 * function SettingsModal() {
 *   const { config, refreshAll, isLoading } = useAppData();
 *
 *   const handleSave = async () => {
 *     await configApi.save(config);
 *     await refreshAll(); // 一键刷新所有数据
 *   };
 * }
 * ```
 */
export function useAppData(): AppDataContextType {
  const context = useContext(AppDataContext);

  if (!context) {
    throw new Error('useAppData must be used within AppDataProvider');
  }

  return context;
}

/**
 * 有条件地使用全局应用数据
 *
 * 如果在 AppDataProvider 外部使用，返回 null 而不是抛出错误
 */
export function useAppDataOptional(): AppDataContextType | null {
  return useContext(AppDataContext);
}
