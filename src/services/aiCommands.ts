import type { AIConfig, AIConfigSummary } from '../types/aiProvider';
import type { ModelInfo } from '../types/generated/ModelInfo';
import type { ProviderInfo } from '../types/generated/ProviderInfo';
import { invoke } from './commandClient';
import { COMMANDS } from './commandKeys';

export const aiConfigCommands = {
  async getAll(): Promise<AIConfigSummary[]> {
    return invoke<AIConfigSummary[]>(COMMANDS.AI_CONFIG_GET_ALL, undefined, {
      errorMessage: '获取AI配置列表失败',
    });
  },

  async getActive(): Promise<AIConfigSummary | null> {
    return invoke<AIConfigSummary | null>(COMMANDS.AI_CONFIG_GET_ACTIVE, undefined, {
      errorMessage: '获取当前AI配置失败',
    });
  },

  async setActive(indexStr: string): Promise<void> {
    const index = parseInt(indexStr, 10);
    if (isNaN(index) || index < 0) {
      throw new Error(`无效的配置索引: ${indexStr}`);
    }

    return invoke<void>(
      COMMANDS.AI_CONFIG_SET_ACTIVE,
      { index },
      {
        errorMessage: '设置活动AI配置失败',
      }
    );
  },

  async add(config: AIConfig): Promise<void> {
    return invoke<void>(COMMANDS.AI_CONFIG_ADD, { config }, { errorMessage: '添加AI配置失败' });
  },

  async update(index: number, config: AIConfig): Promise<void> {
    if (index < 0 || !Number.isInteger(index)) {
      throw new Error(`无效的配置索引: ${index}`);
    }

    return invoke<void>(
      COMMANDS.AI_CONFIG_UPDATE,
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
      COMMANDS.AI_CONFIG_DELETE,
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
      COMMANDS.AI_CONFIG_TEST_CONNECTION,
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
      COMMANDS.AI_MODEL_GET_PROVIDER_MODELS,
      { providerId },
      {
        errorMessage: '获取模型列表失败',
      }
    );
  },

  async getModelInfo(providerId: string, modelId: string): Promise<ModelInfo | null> {
    return invoke<ModelInfo | null>(
      COMMANDS.AI_MODEL_GET_INFO,
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
      COMMANDS.AI_MODEL_ESTIMATE_COST,
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
      COMMANDS.AI_MODEL_CALCULATE_COST,
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
    return invoke<ProviderInfo[]>(COMMANDS.AI_PROVIDER_GET_ALL, undefined, {
      errorMessage: '获取供应商列表失败',
    });
  },

  async getAllModels(): Promise<ModelInfo[]> {
    return invoke<ModelInfo[]>(COMMANDS.AI_PROVIDER_GET_ALL_MODELS, undefined, {
      errorMessage: '获取所有模型列表失败',
    });
  },

  async findProviderForModel(modelId: string): Promise<ProviderInfo | null> {
    return invoke<ProviderInfo | null>(
      COMMANDS.AI_PROVIDER_FIND_BY_MODEL,
      { modelId },
      {
        errorMessage: '查找模型供应商失败',
      }
    );
  },
};

export const systemPromptCommands = {
  async get(): Promise<string> {
    return invoke<string>(COMMANDS.SYSTEM_PROMPT_GET, undefined, {
      errorMessage: '获取系统提示词失败',
    });
  },

  async set(prompt: string): Promise<void> {
    return invoke<void>(
      COMMANDS.SYSTEM_PROMPT_SET,
      { prompt },
      {
        errorMessage: '设置系统提示词失败',
      }
    );
  },

  async reset(): Promise<void> {
    return invoke<void>(COMMANDS.SYSTEM_PROMPT_RESET, undefined, {
      errorMessage: '重置系统提示词失败',
    });
  },
};
