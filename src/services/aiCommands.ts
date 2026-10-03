import type {
  ModelConfiguration,
  ModelDefinition,
  ModelProviderProfile,
  ModelSelection,
  TestConnectionResult,
} from '../types/aiProvider';
import type { ModelInfo } from '../types/generated/ModelInfo';
import type { ProviderInfo } from '../types/generated/ProviderInfo';
import { invoke } from './apiClient';
import i18n from '../i18n/config';

export const modelConfigurationCommands = {
  async get(): Promise<ModelConfiguration> {
    return invoke<ModelConfiguration>('get_model_configuration', undefined, {
      errorMessage: i18n.t('modelSettings.loadFailed'),
    });
  },
  async saveProvider(
    profile: ModelProviderProfile,
    apiKey: string | null,
    defaultModelId?: string
  ): Promise<void> {
    return invoke<void>(
      'save_model_provider',
      { request: { profile, apiKey, defaultModelId: defaultModelId ?? null } },
      { errorMessage: i18n.t('modelSettings.saveFailed') }
    );
  },
  async removeProvider(providerId: string): Promise<void> {
    return invoke<void>(
      'remove_model_provider',
      { providerId },
      { errorMessage: i18n.t('modelSettings.removeFailed') }
    );
  },
  async setDefault(selection: ModelSelection | null): Promise<void> {
    return invoke<void>(
      'set_default_model',
      { selection },
      { errorMessage: i18n.t('modelSettings.defaultFailed') }
    );
  },
  async testProvider(
    profile: ModelProviderProfile,
    apiKey: string | null,
    modelId: string
  ): Promise<TestConnectionResult> {
    return invoke<TestConnectionResult>(
      'test_model_provider',
      { request: { profile, apiKey, modelId } },
      { errorMessage: i18n.t('modelSettings.testFailed') }
    );
  },
  async discoverModels(
    profile: ModelProviderProfile,
    apiKey: string | null
  ): Promise<ModelDefinition[]> {
    return invoke<ModelDefinition[]>(
      'discover_provider_models',
      { request: { profile, apiKey } },
      { errorMessage: i18n.t('modelSettings.discoverFailed') }
    );
  },
};

export const aiModelCommands = {
  async getProviderModels(providerId: string): Promise<ModelInfo[]> {
    return invoke<ModelInfo[]>(
      'get_provider_models',
      { providerId },
      {
        errorMessage: '获取模型列表失败',
      }
    );
  },

  async getModelInfo(providerId: string, modelId: string): Promise<ModelInfo | null> {
    return invoke<ModelInfo | null>(
      'get_model_info',
      { providerId, modelId },
      {
        errorMessage: '获取模型信息失败',
      }
    );
  },

  async estimateCost(
    providerId: string,
    modelId: string,
    totalChars: number,
    cacheHitRate?: number
  ): Promise<number> {
    return invoke<number>(
      'estimate_translation_cost',
      { providerId, modelId, totalChars, cacheHitRate: cacheHitRate ?? null },
      { errorMessage: '估算成本失败' }
    );
  },

  async calculatePreciseCost(
    providerId: string,
    modelId: string,
    inputTokens: number,
    outputTokens: number,
    cacheWriteTokens?: number,
    cacheReadTokens?: number
  ): Promise<number> {
    return invoke<number>(
      'calculate_precise_cost',
      {
        providerId,
        modelId,
        inputTokens,
        outputTokens,
        cacheWriteTokens: cacheWriteTokens ?? null,
        cacheReadTokens: cacheReadTokens ?? null,
      },
      { errorMessage: '计算成本失败' }
    );
  },
};

export const aiProviderCommands = {
  async getAll(): Promise<ProviderInfo[]> {
    return invoke<ProviderInfo[]>('get_all_providers', undefined, {
      errorMessage: '获取供应商列表失败',
    });
  },

  async getAllModels(): Promise<ModelInfo[]> {
    return invoke<ModelInfo[]>('get_all_models', undefined, {
      errorMessage: '获取所有模型列表失败',
    });
  },

  async findProviderForModel(modelId: string): Promise<ProviderInfo | null> {
    return invoke<ProviderInfo | null>(
      'find_provider_for_model',
      { modelId },
      {
        errorMessage: '查找模型供应商失败',
      }
    );
  },
};

export const systemPromptCommands = {
  async get(): Promise<string> {
    return invoke<string>('get_system_prompt', undefined, {
      errorMessage: '获取系统提示词失败',
    });
  },

  async set(prompt: string): Promise<void> {
    return invoke<void>(
      'update_system_prompt',
      { prompt },
      {
        errorMessage: '设置系统提示词失败',
      }
    );
  },

  async reset(): Promise<void> {
    return invoke<void>('reset_system_prompt', undefined, {
      errorMessage: '重置系统提示词失败',
    });
  },
};
