import useSWR from 'swr';
import type { LanguageInfo } from '../types/generated/LanguageInfo';
import { i18nCommands } from '../services/commands';

const SUPPORTED_LANGS_KEY = 'supported_languages';

export function useSupportedLanguages() {
  const { data, error, isLoading, mutate } = useSWR(
    SUPPORTED_LANGS_KEY,
    () => i18nCommands.getSupportedLanguages(),
    {
      keepPreviousData: true,
    }
  );
  return {
    languages: (data as LanguageInfo[] | undefined) ?? [],
    isLoading: !!isLoading,
    error,
    refresh: () => mutate(),
    mutate,
  } as const;
}
