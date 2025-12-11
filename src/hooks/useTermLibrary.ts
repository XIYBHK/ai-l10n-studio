import { useEffect } from 'react';
import useSWR from 'swr';
import { listen } from '@tauri-apps/api/event';
import type { TermLibrary } from '../types/termLibrary';
import { termLibraryCommands } from '../services/commands';

const KEY = 'term_library';

interface UseTermLibraryOptions {
  enabled?: boolean; // 是否启用请求
}

export function useTermLibrary(options?: UseTermLibraryOptions) {
  const { enabled = true } = options || {};

  const { data, error, isLoading, mutate } = useSWR(
    enabled ? KEY : null, // enabled=false 时不请求
    () => termLibraryCommands.get() as Promise<TermLibrary>,
    {
      revalidateOnFocus: false, // 术语库不需要聚焦刷新
      revalidateOnReconnect: false,
      dedupingInterval: 2000, // 2秒内去重
    }
  );

  // 监听翻译完成事件，自动刷新术语库（术语库在翻译后可能更新）
  useEffect(() => {
    if (!enabled) return;

    let unlisten: (() => void) | undefined;

    listen('translation:after', () => {
      mutate(); // 翻译完成后刷新术语库
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      unlisten?.();
    };
  }, [enabled, mutate]);

  return {
    termLibrary: data ?? null,
    error,
    isLoading: !!isLoading,
    refresh: () => mutate(),
    mutate,
  } as const;
}
