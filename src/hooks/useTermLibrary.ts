import useSWR from 'swr';
import type { TermLibrary } from '../types/termLibrary';
import { termLibraryCommands } from '../services/termCommands';

export const TERM_LIBRARY_KEY = 'term_library';

interface UseTermLibraryOptions {
  enabled?: boolean;
}

export function useTermLibrary(options?: UseTermLibraryOptions) {
  const { enabled = true } = options || {};

  const { data, error, isLoading, mutate } = useSWR(
    enabled ? TERM_LIBRARY_KEY : null,
    () => termLibraryCommands.get() as Promise<TermLibrary>,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 2000,
    }
  );

  return {
    termLibrary: data ?? null,
    error,
    isLoading: !!isLoading,
    refresh: mutate,
    mutate,
  } as const;
}
