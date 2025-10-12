import { invoke as apiInvoke } from './api';

type SWRConfiguration = any;

// SWR Key 规范：优先使用 [command, args]，也兼容纯字符串 command
export type TauriKey = [command: string, args?: Record<string, unknown> | null];

function isTauriKey(key: unknown): key is TauriKey {
  return Array.isArray(key) && typeof key[0] === 'string';
}

export async function tauriFetcher<T = unknown>(key: unknown): Promise<T> {
  if (isTauriKey(key)) {
    const [command, args] = key;
    // SWR 请求默认静默且不弹错误 toast，避免后台轮询干扰用户
    return apiInvoke<T>(command, args ?? undefined, {
      showErrorMessage: false,
      silent: true,
      dedup: true,
    });
  }
  if (typeof key === 'string') {
    return apiInvoke<T>(key, undefined, {
      showErrorMessage: false,
      silent: true,
      dedup: true,
    });
  }
  throw new Error('Invalid SWR key: expected string or [command, args]');
}

export const defaultSWRConfig: SWRConfiguration = {
  fetcher: tauriFetcher,
  // 更符合桌面应用的感知刷新节奏
  revalidateOnFocus: true,
  focusThrottleInterval: 2000,
  // 请求去重与错误重试（后端已做统一错误处理）
  dedupingInterval: 500,
  errorRetryCount: 2,
  shouldRetryOnError: true,
};
