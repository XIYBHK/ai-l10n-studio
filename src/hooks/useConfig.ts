import useSWR from 'swr';
import { configCommands } from '../services/configCommands';
import { modelConfigurationCommands, systemPromptCommands } from '../services/aiCommands';
import type { ModelConfiguration } from '../types/aiProvider';
const DEFAULT_CONFIGURATION: ModelConfiguration = { providers: [], defaultModel: null };
export function useAppConfig() {
  const { data, error, isLoading, mutate } = useSWR('app_config', () => configCommands.get(), {
    keepPreviousData: true,
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
  });
  return { config: data ?? null, error, isLoading: !!isLoading, mutate } as const;
}
export function useModelConfiguration() {
  const { data, error, isLoading, mutate } = useSWR<ModelConfiguration>(
    'model_configuration',
    () => modelConfigurationCommands.get(),
    { keepPreviousData: true, revalidateOnFocus: false, revalidateOnReconnect: false }
  );
  return {
    configuration: data ?? DEFAULT_CONFIGURATION,
    loading: !!isLoading,
    error,
    mutate,
  } as const;
}
export function useSystemPrompt() {
  const { data, error, isLoading, mutate } = useSWR(
    'system_prompt',
    () => systemPromptCommands.get(),
    { revalidateOnFocus: false, revalidateOnReconnect: false }
  );
  return { prompt: data ?? '', error, isLoading: !!isLoading, mutate } as const;
}
export function useActiveAIConfig() {
  const { configuration } = useModelConfiguration();
  const selection = configuration.defaultModel;
  const provider = selection
    ? configuration.providers.find((p) => p.profile.id === selection.providerId)
    : undefined;
  return {
    activeAIConfig:
      provider && selection
        ? {
            providerId: provider.profile.id,
            model: selection.modelId,
            displayName: provider.profile.displayName,
            catalogProviderId: provider.profile.catalogProviderId,
            hasApiKey: provider.hasApiKey,
          }
        : null,
  } as const;
}
