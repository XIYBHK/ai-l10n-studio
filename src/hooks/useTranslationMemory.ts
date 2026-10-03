import useSWR from 'swr';
import { translationMemoryCommands } from '../services/termCommands';
import type { TranslationMemory } from '../types/tauri';

export const TRANSLATION_MEMORY_KEY = 'translation_memory';

export function useTranslationMemory() {
  const { data, error, isLoading, mutate } = useSWR<TranslationMemory>(
    TRANSLATION_MEMORY_KEY,
    () => translationMemoryCommands.get(),
    {
      keepPreviousData: true,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 2000,
    }
  );

  return {
    tm: data,
    error,
    isLoading: !!isLoading,
    refresh: mutate,
    mutate,
  } as const;
}
