import { useEffect } from 'react';
import useSWR from 'swr';
import { listen } from '@tauri-apps/api/event';
import { translationMemoryCommands } from '../services/commands';

const TM_KEY = 'translation_memory';

export function useTranslationMemory() {
  const { data, error, isLoading, mutate } = useSWR(TM_KEY, () => translationMemoryCommands.get(), {
    keepPreviousData: true,
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    dedupingInterval: 2000,
  });

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    listen('translation:after', () => {
      mutate();
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
