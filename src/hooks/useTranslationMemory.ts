import useSWR from 'swr';
import type { TauriKey } from '../services/swr';

const TM_KEY: TauriKey = ['get_translation_memory'];

export function useTranslationMemory() {
  const { data, error, isLoading, mutate } = useSWR(TM_KEY, { 
    keepPreviousData: true,
    revalidateOnFocus: false, // 翻译记忆库不需要聚焦刷新
    revalidateOnReconnect: false,
    dedupingInterval: 2000, // 2秒内去重
  });
  return {
    tm: data as any,
    error,
    isLoading: !!isLoading,
    refresh: () => mutate(),
    mutate,
  } as const;
}


