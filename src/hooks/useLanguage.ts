import useSWR from 'swr';
import type { TauriKey } from '../services/swr';
import type { LanguageInfo } from '../services/api';

const SUPPORTED_LANGS_KEY: TauriKey = ['get_supported_langs'];

export function useSupportedLanguages() {
  const { data, error, isLoading, mutate } = useSWR(SUPPORTED_LANGS_KEY, {
    keepPreviousData: true,
  });
  return {
    languages: (data as LanguageInfo[] | undefined) ?? [],
    isLoading: !!isLoading,
    error,
    refresh: () => mutate(),
    mutate,
  } as const;
}
