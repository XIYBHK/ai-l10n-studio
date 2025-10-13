import useSWR from 'swr';
import type { TauriKey } from '../services/swr';

export function useValidateConfig(config: unknown | null | undefined) {
  // 只有在传入 config 时才进行验证；否则不发起请求
  const key: TauriKey | null = config ? ['validate_config', { config }] : null;
  const { data, error, isLoading, mutate } = useSWR(key, {
    revalidateOnFocus: false,
    dedupingInterval: 300,
  });
  return {
    result: data as any,
    error,
    isLoading: !!isLoading,
    refresh: () => mutate(),
    mutate,
  } as const;
}
