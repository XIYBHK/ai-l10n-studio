import type { ModelApi, ModelProviderProfile, ModelProviderSummary } from '../types/aiProvider';

interface ModelPreset {
  id: string;
  labelKey: string;
  baseUrl: string;
  api: ModelApi;
  modelId: string;
}

// Ordinary mainland-China API endpoints. Sources and verification date: docs/ModelPresets.md.
export const MODEL_PRESETS: readonly ModelPreset[] = [
  {
    id: 'deepseek',
    labelKey: 'modelSettings.quick.deepseek',
    baseUrl: 'https://api.deepseek.com',
    api: 'openai-completions',
    modelId: 'deepseek-flash',
  },
  {
    id: 'qwen',
    labelKey: 'modelSettings.quick.qwen',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    api: 'openai-completions',
    modelId: 'qwen-plus',
  },
  {
    id: 'kimi',
    labelKey: 'modelSettings.quick.kimi',
    baseUrl: 'https://api.moonshot.cn/v1',
    api: 'openai-completions',
    modelId: 'kimi-k3',
  },
  {
    id: 'zhipu',
    labelKey: 'modelSettings.quick.zhipu',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    api: 'openai-completions',
    modelId: 'glm-5.2',
  },
  {
    id: 'minimax',
    labelKey: 'modelSettings.quick.minimax',
    baseUrl: 'https://api.minimax.cn/anthropic/v1',
    api: 'anthropic-messages',
    modelId: 'MiniMax-M3',
  },
  {
    id: 'siliconflow',
    labelKey: 'modelSettings.quick.siliconflow',
    baseUrl: 'https://api.siliconflow.cn/v1',
    api: 'openai-completions',
    modelId: 'deepseek-ai/DeepSeek-V4-Flash',
  },
];

export function createPresetProfile(
  preset: ModelPreset,
  displayName: string,
  providers: ModelProviderSummary[]
): ModelProviderProfile {
  const ids = new Set(providers.map(({ profile }) => profile.id));
  let id = preset.id;
  let suffix = 2;
  while (ids.has(id)) id = `${preset.id}-${suffix++}`;
  return {
    id,
    displayName,
    // Quick presets do not inherit stale model limits or pricing from the plugin catalog.
    catalogProviderId: null,
    baseUrl: preset.baseUrl,
    api: preset.api,
    models: [{ id: preset.modelId, name: null, contextWindow: null, maxTokens: null }],
    proxy: null,
  };
}
