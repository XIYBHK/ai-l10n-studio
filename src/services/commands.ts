/**
 * 统一命令层（Command Layer）
 * 参考 clash-verge-rev，提供类型安全的命令常量和调用封装
 *
 * 设计原则：
 * 1. 所有 Tauri 命令集中定义，避免字符串硬编码
 * 2. 完整的 TypeScript 类型标注
 * 3. 统一的错误处理和日志
 * 4. 便于重构和维护
 */

import { apiClient } from './apiClient';
import { open, save } from '@tauri-apps/plugin-dialog';
import type {
  POEntry,
  ContextualRefineRequest,
  AppConfig,
  TranslationMemory,
} from '../types/tauri';
import type { AIConfig } from '../types/aiProvider';
import type { TermLibrary } from '../types/termLibrary';
import type { ModelInfo } from '../types/generated/ModelInfo';
import type { ProviderInfo } from '../types/generated/ProviderInfo';

const invoke = apiClient.invoke.bind(apiClient);

export const COMMANDS = {
  // 配置相关
  CONFIG_GET: 'get_app_config',
  CONFIG_UPDATE: 'update_app_config',
  CONFIG_VALIDATE: 'validate_config',

  // AI配置相关
  AI_CONFIG_GET_ALL: 'get_all_ai_configs',
  AI_CONFIG_GET_ACTIVE: 'get_active_ai_config',
  AI_CONFIG_SET_ACTIVE: 'set_active_ai_config',
  AI_CONFIG_ADD: 'add_ai_config',
  AI_CONFIG_UPDATE: 'update_ai_config',
  AI_CONFIG_DELETE: 'remove_ai_config',
  AI_CONFIG_TEST_CONNECTION: 'test_ai_connection',

  // AI 模型相关
  AI_MODEL_GET_PROVIDER_MODELS: 'get_provider_models',
  AI_MODEL_GET_INFO: 'get_model_info',
  AI_MODEL_ESTIMATE_COST: 'estimate_translation_cost',
  AI_MODEL_CALCULATE_COST: 'calculate_precise_cost',

  // 🆕 动态供应商相关 (Phase 2)
  AI_PROVIDER_GET_ALL: 'get_all_providers',
  AI_PROVIDER_GET_ALL_MODELS: 'get_all_models',
  AI_PROVIDER_FIND_BY_MODEL: 'find_provider_for_model',

  // 系统提示词相关
  SYSTEM_PROMPT_GET: 'get_system_prompt',
  SYSTEM_PROMPT_SET: 'update_system_prompt', // 修正：与后端命令名一致
  SYSTEM_PROMPT_RESET: 'reset_system_prompt',

  // 术语库相关
  TERM_LIBRARY_GET: 'get_term_library',
  TERM_LIBRARY_ADD: 'add_term_to_library',
  TERM_LIBRARY_REMOVE: 'remove_term_from_library',
  TERM_LIBRARY_GENERATE_STYLE: 'generate_style_summary',
  TERM_LIBRARY_SHOULD_UPDATE: 'should_update_style_summary',

  // 翻译记忆库相关
  TM_GET: 'get_translation_memory',
  TM_GET_BUILTIN: 'get_builtin_phrases',
  TM_MERGE_BUILTIN: 'merge_builtin_phrases',
  TM_SAVE: 'save_translation_memory',

  // PO 文件相关
  PO_PARSE: 'parse_po_file',
  PO_SAVE: 'save_po_file',

  // 文件格式检测相关
  FILE_FORMAT_DETECT: 'detect_file_format',
  FILE_METADATA_GET: 'get_file_metadata',

  // 翻译相关
  TRANSLATE_ENTRY: 'translate_entry',
  CONTEXTUAL_REFINE: 'contextual_refine',

  // 对话框相关
  DIALOG_OPEN_FILE: 'open_file_dialog',
  DIALOG_SAVE_FILE: 'save_file_dialog',

  // 日志相关
  LOG_GET: 'get_app_logs',
  LOG_CLEAR: 'clear_app_logs',
  LOG_FRONTEND_GET: 'get_frontend_logs', // 🔄 前端日志获取
  PROMPT_LOG_GET: 'get_prompt_logs',
  PROMPT_LOG_CLEAR: 'clear_prompt_logs',

  // 语言和本地化相关
  I18N_GET_SUPPORTED: 'get_supported_langs', // 修正：与后端命令一致
  I18N_GET_SYSTEM_LOCALE: 'get_system_locale',
  LANGUAGE_DETECT: 'detect_text_language',
  LANGUAGE_GET_DEFAULT_TARGET: 'get_default_target_lang',

  // 系统相关
  SYSTEM_GET_LOG_DIRECTORY: 'get_log_directory_path',
  SYSTEM_OPEN_LOG_DIRECTORY: 'open_log_directory',
  SYSTEM_GET_NATIVE_THEME: 'get_native_system_theme',
} as const;

export const configCommands = {
  async get(): Promise<AppConfig> {
    return invoke<AppConfig>(COMMANDS.CONFIG_GET, undefined, {
      errorMessage: '加载配置失败',
    });
  },

  async update(config: Record<string, unknown>): Promise<void> {
    return invoke<void>(
      COMMANDS.CONFIG_UPDATE,
      { config },
      {
        errorMessage: '更新配置失败',
      }
    );
  },

  async validate(config: Record<string, unknown>): Promise<boolean> {
    return invoke<boolean>(
      COMMANDS.CONFIG_VALIDATE,
      { config },
      {
        errorMessage: '配置验证失败',
      }
    );
  },
};

export const aiConfigCommands = {
  async getAll(): Promise<AIConfig[]> {
    return invoke<AIConfig[]>(COMMANDS.AI_CONFIG_GET_ALL, undefined, {
      errorMessage: '获取AI配置列表失败',
    });
  },

  async getActive(): Promise<AIConfig | null> {
    return invoke<AIConfig | null>(COMMANDS.AI_CONFIG_GET_ACTIVE, undefined, {
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
    return invoke<void>(
      COMMANDS.AI_CONFIG_ADD,
      { config },
      {
        errorMessage: '添加AI配置失败',
      }
    );
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
    proxy?: any
  ): Promise<{ success: boolean; message: string }> {
    const request = {
      providerId,
      apiKey,
      baseUrl: baseUrl || null,
      model: model || null,
      proxy: proxy || null,
    };

    return invoke<{ success: boolean; message: string }>(
      COMMANDS.AI_CONFIG_TEST_CONNECTION,
      { request },
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
      {
        providerId,
        modelId,
        totalChars,
        cacheHitRate: cacheHitRate ?? null,
      },
      {
        errorMessage: '估算成本失败',
      }
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
      {
        errorMessage: '计算成本失败',
      }
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

export const termLibraryCommands = {
  async get(): Promise<TermLibrary> {
    return invoke<TermLibrary>(COMMANDS.TERM_LIBRARY_GET, undefined, {
      errorMessage: '加载术语库失败',
    });
  },

  async addTerm(termData: {
    source: string;
    userTranslation: string;
    aiTranslation: string;
    context?: string | null;
  }): Promise<void> {
    return invoke<void>(COMMANDS.TERM_LIBRARY_ADD, termData, {
      errorMessage: '添加术语失败',
    });
  },

  async removeTerm(source: string): Promise<void> {
    return invoke<void>(
      COMMANDS.TERM_LIBRARY_REMOVE,
      { source },
      {
        errorMessage: '删除术语失败',
      }
    );
  },

  async generateStyleSummary(): Promise<string> {
    return invoke<string>(COMMANDS.TERM_LIBRARY_GENERATE_STYLE, undefined, {
      errorMessage: '生成风格总结失败',
    });
  },

  async shouldUpdateStyleSummary(): Promise<boolean> {
    return invoke<boolean>(COMMANDS.TERM_LIBRARY_SHOULD_UPDATE);
  },
};

export const translationMemoryCommands = {
  async get(): Promise<TranslationMemory> {
    return invoke<TranslationMemory>(COMMANDS.TM_GET, undefined, {
      errorMessage: '加载翻译记忆库失败',
    });
  },

  async getBuiltinPhrases(): Promise<TranslationMemory> {
    return invoke<TranslationMemory>(COMMANDS.TM_GET_BUILTIN, undefined, {
      errorMessage: '加载内置词库失败',
    });
  },

  async mergeBuiltinPhrases(): Promise<number> {
    return invoke<number>(COMMANDS.TM_MERGE_BUILTIN, undefined, {
      errorMessage: '合并内置词库失败',
    });
  },

  async save(memory: Record<string, unknown>): Promise<void> {
    return invoke<void>(
      COMMANDS.TM_SAVE,
      { memory },
      {
        errorMessage: '保存翻译记忆库失败',
      }
    );
  },
};

export const poFileCommands = {
  async parse(filePath: string): Promise<POEntry[]> {
    return invoke<POEntry[]>(
      COMMANDS.PO_PARSE,
      { filePath },
      {
        errorMessage: '解析 PO 文件失败',
      }
    );
  },

  async save(filePath: string, entries: POEntry[]): Promise<void> {
    return invoke<void>(
      COMMANDS.PO_SAVE,
      { filePath, entries },
      {
        errorMessage: '保存 PO 文件失败',
      }
    );
  },
};

export const fileFormatCommands = {
  async detect(filePath: string): Promise<string> {
    return invoke<string>(
      COMMANDS.FILE_FORMAT_DETECT,
      { filePath },
      {
        errorMessage: '检测文件格式失败',
      }
    );
  },

  async getMetadata(filePath: string): Promise<any> {
    return invoke<any>(
      COMMANDS.FILE_METADATA_GET,
      { filePath },
      {
        errorMessage: '获取文件元数据失败',
      }
    );
  },
};

export const translatorCommands = {
  async translateEntry(text: string, targetLanguage?: string): Promise<string> {
    return invoke<string>(
      COMMANDS.TRANSLATE_ENTRY,
      {
        text,
        targetLanguage: targetLanguage || null,
      },
      {
        errorMessage: '翻译失败',
        silent: false,
      }
    );
  },

  async contextualRefine(
    requests: ContextualRefineRequest[],
    targetLanguage: string
  ): Promise<string[]> {
    return invoke<string[]>(
      COMMANDS.CONTEXTUAL_REFINE,
      {
        requests,
        targetLanguage,
      },
      {
        errorMessage: 'Contextual Refine 失败',
        silent: false,
      }
    );
  },
};

export const dialogCommands = {
  async openFile(): Promise<string | null> {
    const result = await open({
      multiple: false,
      directory: false,
      filters: [
        { name: 'PO Files', extensions: ['po'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });
    return result as string | null;
  },

  async saveFile(): Promise<string | null> {
    const result = await save({
      filters: [
        { name: 'PO Files', extensions: ['po'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });
    return result as string | null;
  },
};

export const logCommands = {
  async get(): Promise<string[]> {
    return invoke<string[]>(COMMANDS.LOG_GET, undefined, {
      errorMessage: '获取后端日志失败',
    });
  },

  async clear(): Promise<void> {
    return invoke<void>(COMMANDS.LOG_CLEAR, undefined, {
      errorMessage: '清空后端日志失败',
    });
  },

  async getFrontend(): Promise<string[]> {
    return invoke<string[]>(COMMANDS.LOG_FRONTEND_GET, undefined, {
      errorMessage: '获取前端日志失败',
    });
  },

  async getPromptLogs(): Promise<string> {
    return invoke<string>(COMMANDS.PROMPT_LOG_GET, undefined, {
      errorMessage: '获取提示词日志失败',
    });
  },

  async clearPromptLogs(): Promise<void> {
    return invoke<void>(COMMANDS.PROMPT_LOG_CLEAR, undefined, {
      errorMessage: '清空提示词日志失败',
    });
  },
};

export const i18nCommands = {
  async getSupportedLanguages(): Promise<string[]> {
    return invoke<string[]>(COMMANDS.I18N_GET_SUPPORTED, undefined, {
      errorMessage: '获取支持的语言列表失败',
    });
  },

  async getSystemLocale(): Promise<string> {
    return invoke<string>(COMMANDS.I18N_GET_SYSTEM_LOCALE, undefined, {
      errorMessage: '获取系统语言失败',
    });
  },

  async detectLanguage(text: string): Promise<{ code: string; display_name: string }> {
    return invoke<{ code: string; display_name: string }>(
      COMMANDS.LANGUAGE_DETECT,
      { text },
      {
        errorMessage: '语言检测失败',
      }
    );
  },

  async getDefaultTargetLanguage(
    sourceLangCode: string
  ): Promise<{ code: string; display_name: string }> {
    return invoke<{ code: string; display_name: string }>(
      COMMANDS.LANGUAGE_GET_DEFAULT_TARGET,
      { sourceLangCode },
      {
        errorMessage: '获取默认目标语言失败',
      }
    );
  },
};

export const systemCommands = {
  async getLogDirectoryPath(): Promise<string> {
    return invoke<string>(COMMANDS.SYSTEM_GET_LOG_DIRECTORY, undefined, {
      errorMessage: '获取日志目录路径失败',
    });
  },

  async openLogDirectory(): Promise<void> {
    return invoke<void>(COMMANDS.SYSTEM_OPEN_LOG_DIRECTORY, undefined, {
      errorMessage: '打开日志目录失败',
    });
  },

  async getNativeSystemTheme(): Promise<string> {
    return invoke<string>(COMMANDS.SYSTEM_GET_NATIVE_THEME, undefined, {
      errorMessage: '获取系统主题失败',
    });
  },
};
