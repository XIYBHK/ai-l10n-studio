import { useEffect } from 'react';
import useSWR from 'swr';
import { listen } from '@tauri-apps/api/event';
import { translationMemoryCommands } from '../services/commands';

const TM_KEY = 'translation_memory';

export function useTranslationMemory() {
  const { data, error, isLoading, mutate } = useSWR(TM_KEY, () => translationMemoryCommands.get(), {
    keepPreviousData: true,
    revalidateOnFocus: false, // 翻译记忆库不需要聚焦刷新
    revalidateOnReconnect: false,
    dedupingInterval: 2000, // 2秒内去重
  });

  // 监听翻译完成事件，自动刷新记忆库
  useEffect(() => {
    let unlisten: (() => void) | undefined;

    listen('translation:after', () => {
      mutate(); // 翻译完成后刷新记忆库
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      unlisten?.();
    };
  }, [mutate]);

  return {
    tm: data as any,
    error,
    isLoading: !!isLoading,
    refresh: () => mutate(),
    mutate,
  } as const;
}
