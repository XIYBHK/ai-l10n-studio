import useSWR from 'swr';
import type { AIConfig } from '../types/aiProvider';
import { configCommands, aiConfigCommands, systemPromptCommands } from '../services/commands';

// 应用配置（整体）
const APP_CONFIG_KEY = 'app_config';
// AI 配置集合 & 当前启用项
const AI_CONFIGS_KEY = 'ai_configs';
const ACTIVE_AI_CONFIG_KEY = 'active_ai_config';
// 系统提示词
const SYSTEM_PROMPT_KEY = 'system_prompt';

export function useAppConfig() {
  const { data, error, isLoading, mutate } = useSWR(
    APP_CONFIG_KEY, 
    () => configCommands.get(),  // ✅ 迁移到统一命令层
    { 
      keepPreviousData: true,
      revalidateOnFocus: false, // 配置不需要聚焦刷新
      revalidateOnReconnect: false, // 配置不需要重连刷新
    }
  );
  return { config: data ?? null, error, isLoading: !!isLoading, mutate } as const;
}

export function useAIConfigs() {
  const all = useSWR(
    AI_CONFIGS_KEY, 
    () => aiConfigCommands.getAll(),  // ✅ 迁移到统一命令层
    { 
      keepPreviousData: true,
      revalidateOnFocus: false, // AI配置不需要聚焦刷新
      revalidateOnReconnect: false,
    }
  );
  const active = useSWR(
    ACTIVE_AI_CONFIG_KEY, 
    () => aiConfigCommands.getActive(),  // ✅ 迁移到统一命令层
    { 
      keepPreviousData: true,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    }
  );
  return {
    configs: (all.data as AIConfig[] | undefined) ?? [],
    loading: !!all.isLoading || !!active.isLoading,
    error: all.error || active.error,
    active: (active.data as AIConfig | null | undefined) ?? null,
    mutateAll: all.mutate,
    mutateActive: active.mutate,
  } as const;
}

export function useSystemPrompt() {
  const { data, error, isLoading, mutate } = useSWR(
    SYSTEM_PROMPT_KEY,
    () => systemPromptCommands.get(),  // ✅ 迁移到统一命令层
    {
      revalidateOnFocus: false, // 系统提示词不需要聚焦刷新
      revalidateOnReconnect: false,
      dedupingInterval: 5000, // 5秒内去重
    }
  );
  return { prompt: data ?? '', error, isLoading: !!isLoading, mutate } as const;
}


