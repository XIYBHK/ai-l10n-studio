import useSWR from 'swr';
import { translationMemoryCommands } from '../services/commands';

const TM_KEY = 'translation_memory';

export function useTranslationMemory() {
  const { data, error, isLoading, mutate } = useSWR(
    TM_KEY,
    () => translationMemoryCommands.get(),
    {
      keepPreviousData: true,
      revalidateOnFocus: false, // 翻译记忆库不需要聚焦刷新
      revalidateOnReconnect: false,
      dedupingInterval: 2000, // 2秒内去重
    }
  );
  return {
    tm: data as any,
    error,
    isLoading: !!isLoading,
    refresh: () => mutate(),
    mutate,
  } as const;
}
