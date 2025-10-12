import useSWR from 'swr';
import type { TauriKey } from '../services/swr';

// 后端日志（字符串）
const BACKEND_LOGS_KEY: TauriKey = ['get_app_logs'];
// 提示词日志（字符串）
const PROMPT_LOGS_KEY: TauriKey = ['get_prompt_logs'];

interface UseLogsOptions {
  refreshInterval?: number;
  enabled?: boolean; // 是否启用 SWR（用于条件化请求）
}

export function useBackendLogs(options?: UseLogsOptions) {
  const { enabled = true, refreshInterval = 2000 } = options || {};

  const { data, error, isLoading, mutate } = useSWR<string>(
    enabled ? BACKEND_LOGS_KEY : null, // enabled=false 时不请求
    {
      refreshInterval: enabled ? refreshInterval : 0,
      revalidateOnFocus: false,
    }
  );
  return {
    logs: data ?? '',
    error,
    isLoading: !!isLoading,
    refresh: () => mutate(),
    mutate,
  } as const;
}

export function usePromptLogs(options?: UseLogsOptions) {
  const { enabled = true, refreshInterval = 2000 } = options || {};

  const { data, error, isLoading, mutate } = useSWR<string>(
    enabled ? PROMPT_LOGS_KEY : null, // enabled=false 时不请求
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
