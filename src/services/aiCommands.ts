import type { AIConfig, AIConfigSummary } from '../types/aiProvider';
import type { ModelInfo } from '../types/generated/ModelInfo';
import type { ProviderInfo } from '../types/generated/ProviderInfo';
import { invoke } from './apiClient';

export const aiConfigCommands = {
  async getAll(): Promise<AIConfigSummary[]> {
    return invoke<AIConfigSummary[]>('get_all_ai_configs', undefined, {
      errorMessage: '获取AI配置列表失败',
    });
  },

  async getActive(): Promise<AIConfigSummary | null> {
    return invoke<AIConfigSummary | null>('get_active_ai_config', undefined, {
      errorMessage: '获取当前AI配置失败',
    });
  },

  async setActive(indexStr: string): Promise<void> {
    const index = parseInt(indexStr, 10);
    if (isNaN(index) || index < 0) {
      throw new Error(`无效的配置索引: ${indexStr}`);
    }

    return invoke<void>(
      'set_active_ai_config',
      { index },
      {
        errorMessage: '设置活动AI配置失败',
      }
    );
  },

  async add(config: AIConfig): Promise<void> {
    return invoke<void>('add_ai_config', { config }, { errorMessage: '添加AI配置失败' });
  },

  async update(index: number, config: AIConfig): Promise<void> {
    if (index < 0 || !Number.isInteger(index)) {
      throw new Error(`无效的配置索引: ${index}`);
    }

    return invoke<void>(
      'update_ai_config',
      { index, config },
      {
        errorMessage: '更新AI配置失败',
      }
    );
  },

  async delete(indexStr: string): Promise<void> {
    const index = parseInt(indexStr, 10);
    if (isNaN(index) || index < 0) {
      throw new Error(`无效的配置索引: ${indexStr}`);
    }

    return invoke<void>(
      'remove_ai_config',
      { index },
      {
        errorMessage: '删除AI配置失败',
      }
    );
  },

  async testConnection(
    providerId: string,
    apiKey: string,
    baseUrl?: string,
    model?: string,
    proxy?: unknown
  ): Promise<{ success: boolean; message: string }> {
    return invoke<{ success: boolean; message: string }>(
      'test_ai_connection',
      {
        request: {
          providerId,
          apiKey,
          baseUrl: baseUrl || null,
          model: model || null,
          proxy: proxy || null,
        },
      },
      {
        errorMessage: 'AI连接测试失败',
        silent: true,
      }
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
