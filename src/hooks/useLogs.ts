import useSWR from 'swr';
import type { TauriKey } from '../services/swr';
import { logCommands } from '../services/commands';

// 后端日志（字符串数组）
const BACKEND_LOGS_KEY: TauriKey = ['get_app_logs'];
// 🔄 前端日志（字符串数组）
const FRONTEND_LOGS_KEY: TauriKey = ['get_frontend_logs'];
// 提示词日志（字符串）
const PROMPT_LOGS_KEY: TauriKey = ['get_prompt_logs'];

interface UseLogsOptions {
  refreshInterval?: number;
  enabled?: boolean; // 是否启用 SWR（用于条件化请求）
}

export function useBackendLogs(options?: UseLogsOptions) {
  const { enabled = true, refreshInterval = 2000 } = options || {};

  const { data, error, isLoading, mutate } = useSWR(
    enabled ? BACKEND_LOGS_KEY : null, // enabled=false 时不请求
    () => logCommands.get() as Promise<string[]>,
    {
      refreshInterval: enabled ? refreshInterval : 0,
      revalidateOnFocus: false,
    }
  );
  return {
    logs: data ? data.join('\n') : '', // 将字符串数组合并为字符串
    logLines: data ?? [], // 提供原始数组
    error,
    isLoading: !!isLoading,
    refresh: () => mutate(),
    mutate,
  } as const;
}

// 🔄 前端日志 Hook
export function useFrontendLogs(options?: UseLogsOptions) {
  const { enabled = true, refreshInterval = 10000 } = options || {}; // 前端日志刷新频率较低

  const { data, error, isLoading, mutate } = useSWR(
    enabled ? FRONTEND_LOGS_KEY : null,
    () => logCommands.getFrontend() as Promise<string[]>,
    {
      refreshInterval: enabled ? refreshInterval : 0,
      revalidateOnFocus: false,
    }
  );
  return {
    logs: data ? data.join('\n') : '', // 将字符串数组合并为字符串
    logLines: data ?? [], // 提供原始数组
    error,
    isLoading: !!isLoading,
    refresh: () => mutate(),
    mutate,
  } as const;
}

export function usePromptLogs(options?: UseLogsOptions) {
  const { enabled = true, refreshInterval = 2000 } = options || {};

  const { data, error, isLoading, mutate } = useSWR(
    enabled ? PROMPT_LOGS_KEY : null, // enabled=false 时不请求
    () => logCommands.getPromptLogs() as Promise<string>,
    {
      refreshInterval: enabled ? refreshInterval : 0,
      revalidateOnFocus: false,
    }
  );
  return {
    promptLogs: data ?? '',
    error,
    isLoading: !!isLoading,
    refresh: () => mutate(),
    mutate,
  } as const;
}
