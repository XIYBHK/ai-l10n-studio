import { useEffect } from 'react';
import useSWR from 'swr';
import { listen } from '@tauri-apps/api/event';
import type { TermLibrary } from '../types/termLibrary';
import { termLibraryCommands } from '../services/commands';

const KEY = 'term_library';

interface UseTermLibraryOptions {
  enabled?: boolean;
}

export function useTermLibrary(options?: UseTermLibraryOptions) {
  const { enabled = true } = options || {};

  const { data, error, isLoading, mutate } = useSWR(
    enabled ? KEY : null,
    () => termLibraryCommands.get() as Promise<TermLibrary>,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 2000,
    }
  );

  useEffect(() => {
    if (!enabled) return;

    let unlisten: (() => void) | undefined;

    listen('translation:after', () => {
      mutate();
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
