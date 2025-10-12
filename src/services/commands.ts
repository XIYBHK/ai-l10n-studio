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

import { invoke } from './api';
import type { POEntry, TranslationStats, ContextualRefineRequest } from '../types/tauri';
import type { AIConfig, ProviderType } from '../types/aiProvider';
import type { TermLibrary } from '../types/termLibrary';
import type { ModelInfo } from '../types/generated/ModelInfo';

// ========================================
// 命令常量定义（集中管理，避免硬编码）
// ========================================

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
  AI_CONFIG_DELETE: 'delete_ai_config',
  AI_CONFIG_TEST_CONNECTION: 'test_ai_connection',

  // AI 模型相关
  AI_MODEL_GET_PROVIDER_MODELS: 'get_provider_models',
  AI_MODEL_GET_INFO: 'get_model_info',
  AI_MODEL_ESTIMATE_COST: 'estimate_translation_cost',
  AI_MODEL_CALCULATE_COST: 'calculate_precise_cost',

  // 系统提示词相关
  SYSTEM_PROMPT_GET: 'get_system_prompt',
  SYSTEM_PROMPT_SET: 'set_system_prompt',
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
  TM_SAVE: 'save_translation_memory',

  // PO 文件相关
  PO_PARSE: 'parse_po_file',
  PO_SAVE: 'save_po_file',

  // 文件格式检测相关
  FILE_FORMAT_DETECT: 'detect_file_format',
  FILE_METADATA_GET: 'get_file_metadata',

  // 翻译相关
  TRANSLATE_ENTRY: 'translate_entry',
  TRANSLATE_BATCH: 'batch_translate',
  CONTEXTUAL_REFINE: 'contextual_refine',

  // 对话框相关
  DIALOG_OPEN_FILE: 'open_file_dialog',
  DIALOG_SAVE_FILE: 'save_file_dialog',

  // 日志相关
  LOG_GET: 'get_app_logs',
  LOG_CLEAR: 'clear_app_logs',
  PROMPT_LOG_GET: 'get_prompt_logs',
  PROMPT_LOG_CLEAR: 'clear_prompt_logs',

  // 语言和本地化相关
  I18N_GET_SUPPORTED: 'get_supported_langs', // 修正：与后端命令一致
  I18N_GET_SYSTEM_LOCALE: 'get_system_locale',
  LANGUAGE_DETECT: 'detect_text_language',
  LANGUAGE_GET_DEFAULT_TARGET: 'get_default_target_lang',
} as const;

// ========================================
// 类型安全的命令调用封装
// ========================================

/**
 * 配置命令
 */
export const configCommands = {
  async get() {
    return invoke<any>(COMMANDS.CONFIG_GET, undefined, {
      errorMessage: '加载配置失败',
    });
  },

  async update(config: any) {
    return invoke<void>(
      COMMANDS.CONFIG_UPDATE,
      { config },
      {
        errorMessage: '更新配置失败',
      }
    );
  },

  async validate(config: any) {
    return invoke<boolean>(
      COMMANDS.CONFIG_VALIDATE,
      { config },
      {
        errorMessage: '配置验证失败',
      }
    );
  },
};

/**
 * AI配置命令
 */
export const aiConfigCommands = {
  async getAll() {
    return invoke<AIConfig[]>(COMMANDS.AI_CONFIG_GET_ALL, undefined, {
      errorMessage: '获取AI配置列表失败',
    });
  },

  async getActive() {
    return invoke<AIConfig | null>(COMMANDS.AI_CONFIG_GET_ACTIVE, undefined, {
      errorMessage: '获取当前AI配置失败',
    });
  },

  async setActive(id: string) {
    return invoke<void>(
      COMMANDS.AI_CONFIG_SET_ACTIVE,
      { id },
      {
        errorMessage: '设置活动AI配置失败',
      }
    );
  },

  async add(config: AIConfig) {
    return invoke<string>(
      COMMANDS.AI_CONFIG_ADD,
      { config },
      {
        errorMessage: '添加AI配置失败',
      }
    );
  },

  async update(id: string, config: AIConfig) {
    return invoke<void>(
      COMMANDS.AI_CONFIG_UPDATE,
      { id, config },
      {
        errorMessage: '更新AI配置失败',
      }
    );
  },

  async delete(id: string) {
    return invoke<void>(
      COMMANDS.AI_CONFIG_DELETE,
      { id },
      {
        errorMessage: '删除AI配置失败',
      }
    );
  },

  async testConnection(
    provider: ProviderType,
    apiKey: string,
    baseUrl?: string,
    model?: string,
    proxy?: any
  ) {
    const request = {
      provider,
      api_key: apiKey,
      base_url: baseUrl || null,
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

/**
 * AI 模型命令
 */
export const aiModelCommands = {
  async getProviderModels(provider: string) {
    return invoke<ModelInfo[]>(
      COMMANDS.AI_MODEL_GET_PROVIDER_MODELS,
      { provider },
      {
        errorMessage: '获取模型列表失败',
      }
    );
  },

  async getModelInfo(provider: string, modelId: string) {
    return invoke<ModelInfo | null>(
      COMMANDS.AI_MODEL_GET_INFO,
      { provider, modelId },
      {
        errorMessage: '获取模型信息失败',
      }
    );
  },

  async estimateCost(provider: string, modelId: string, totalChars: number, cacheHitRate?: number) {
    return invoke<number>(
      COMMANDS.AI_MODEL_ESTIMATE_COST,
      {
        provider,
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
    provider: string,
    modelId: string,
    inputTokens: number,
    outputTokens: number,
    cacheWriteTokens?: number,
    cacheReadTokens?: number
  ) {
    return invoke<number>(
      COMMANDS.AI_MODEL_CALCULATE_COST,
      {
        provider,
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

/**
 * 系统提示词命令
 */
export const systemPromptCommands = {
  async get() {
    return invoke<string>(COMMANDS.SYSTEM_PROMPT_GET, undefined, {
      errorMessage: '获取系统提示词失败',
    });
  },

  async set(prompt: string) {
    return invoke<void>(
      COMMANDS.SYSTEM_PROMPT_SET,
      { prompt },
      {
        errorMessage: '设置系统提示词失败',
      }
    );
  },

  async reset() {
    return invoke<void>(COMMANDS.SYSTEM_PROMPT_RESET, undefined, {
      errorMessage: '重置系统提示词失败',
    });
  },
};

/**
 * 术语库命令
 */
export const termLibraryCommands = {
  async get() {
    return invoke<TermLibrary>(COMMANDS.TERM_LIBRARY_GET, undefined, {
      errorMessage: '加载术语库失败',
    });
  },

  async addTerm(termData: {
    source: string;
    userTranslation: string;
    aiTranslation: string;
    context?: string | null;
  }) {
    return invoke<void>(COMMANDS.TERM_LIBRARY_ADD, termData, {
      errorMessage: '添加术语失败',
    });
  },

  async removeTerm(source: string) {
    return invoke<void>(
      COMMANDS.TERM_LIBRARY_REMOVE,
      { source },
      {
        errorMessage: '删除术语失败',
      }
    );
  },

  async generateStyleSummary(apiKey: string) {
    return invoke<string>(
      COMMANDS.TERM_LIBRARY_GENERATE_STYLE,
      { apiKey },
      {
        errorMessage: '生成风格总结失败',
      }
    );
  },

  async shouldUpdateStyleSummary() {
    return invoke<boolean>(COMMANDS.TERM_LIBRARY_SHOULD_UPDATE);
  },
};

/**
 * 翻译记忆库命令
 */
export const translationMemoryCommands = {
  async get() {
    return invoke<any>(COMMANDS.TM_GET, undefined, {
      errorMessage: '加载翻译记忆库失败',
    });
  },

  async getBuiltinPhrases() {
    return invoke<any>(COMMANDS.TM_GET_BUILTIN, undefined, {
      errorMessage: '加载内置词库失败',
    });
  },

  async save(memory: any) {
    return invoke<void>(
      COMMANDS.TM_SAVE,
      { memory },
      {
        errorMessage: '保存翻译记忆库失败',
      }
    );
  },
};

/**
 * PO文件命令
 */
export const poFileCommands = {
  async parse(filePath: string) {
    return invoke<POEntry[]>(
      COMMANDS.PO_PARSE,
      { filePath },
      {
        errorMessage: '解析 PO 文件失败',
      }
    );
  },

  async save(filePath: string, entries: POEntry[]) {
    return invoke<void>(
      COMMANDS.PO_SAVE,
      { filePath, entries },
      {
        errorMessage: '保存 PO 文件失败',
      }
    );
  },
};

/**
 * 文件格式检测命令
 */
export const fileFormatCommands = {
  async detect(filePath: string) {
    return invoke<string>(
      COMMANDS.FILE_FORMAT_DETECT,
      { filePath },
      {
        errorMessage: '检测文件格式失败',
      }
    );
  },

  async getMetadata(filePath: string) {
    return invoke<any>(
      COMMANDS.FILE_METADATA_GET,
      { filePath },
      {
        errorMessage: '获取文件元数据失败',
      }
    );
  },
};

/**
 * 翻译命令
 */
export const translatorCommands = {
  async translateEntry(text: string, targetLanguage?: string) {
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

  async batchTranslate(
    entries: POEntry[],
    _onProgress?: (progress: number) => void,
    _onStats?: (stats: TranslationStats) => void,
    targetLanguage?: string
  ) {
    return invoke<POEntry[]>(
      COMMANDS.TRANSLATE_BATCH,
      {
        entries,
        targetLanguage: targetLanguage || null,
      },
      {
        errorMessage: '批量翻译失败',
        silent: false,
      }
    );
  },

  async contextualRefine(requests: ContextualRefineRequest[], targetLanguage: string) {
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

/**
 * 对话框命令
 */
export const dialogCommands = {
  async openFile() {
    return invoke<string | null>(COMMANDS.DIALOG_OPEN_FILE, undefined, {
      showErrorMessage: false,
    });
  },

  async saveFile() {
    return invoke<string | null>(COMMANDS.DIALOG_SAVE_FILE, undefined, {
      showErrorMessage: false,
    });
  },
};

/**
 * 日志命令
 */
export const logCommands = {
  async get() {
    return invoke<string>(COMMANDS.LOG_GET, undefined, {
      errorMessage: '获取日志失败',
    });
  },

  async clear() {
    return invoke<void>(COMMANDS.LOG_CLEAR, undefined, {
      errorMessage: '清空日志失败',
    });
  },

  async getPromptLogs() {
    return invoke<string>(COMMANDS.PROMPT_LOG_GET, undefined, {
      errorMessage: '获取提示词日志失败',
    });
  },

  async clearPromptLogs() {
    return invoke<void>(COMMANDS.PROMPT_LOG_CLEAR, undefined, {
      errorMessage: '清空提示词日志失败',
    });
  },
};

/**
 * 国际化命令
 */
export const i18nCommands = {
  async getSupportedLanguages() {
    return invoke<string[]>(COMMANDS.I18N_GET_SUPPORTED, undefined, {
      errorMessage: '获取支持的语言列表失败',
    });
  },

  async getSystemLocale() {
    return invoke<string>(COMMANDS.I18N_GET_SYSTEM_LOCALE, undefined, {
      errorMessage: '获取系统语言失败',
    });
  },

  async detectLanguage(text: string) {
    return invoke<{ code: string; display_name: string }>(
      COMMANDS.LANGUAGE_DETECT,
      { text },
      {
        errorMessage: '语言检测失败',
      }
    );
  },

  async getDefaultTargetLanguage(sourceLanguageCode: string) {
    return invoke<{ code: string; display_name: string }>(
      COMMANDS.LANGUAGE_GET_DEFAULT_TARGET,
      { sourceLanguageCode },
      {
        errorMessage: '获取默认目标语言失败',
      }
    );
  },
};
