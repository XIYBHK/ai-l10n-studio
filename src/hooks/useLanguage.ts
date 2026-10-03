import useSWR from 'swr';
import { i18nCommands } from '../services/translationCommands';

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
    languages: data ?? [],
    isLoading: !!isLoading,
    error,
    refresh: () => mutate(),
    mutate,
  } as const;
}
