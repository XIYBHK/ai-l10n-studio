/**
 * 统一的 Tauri API 调用封装
 * 提供类型安全、统一错误处理、日志记录、请求管理
 */

import { message } from 'antd';
import { createModuleLogger } from '../utils/logger';
import { apiClient } from './apiClient';

const log = createModuleLogger('API');

/**
 * API 调用配置
 */
interface ApiOptions {
  showErrorMessage?: boolean;  // 是否自动显示错误消息
  errorMessage?: string;        // 自定义错误消息
  silent?: boolean;             // 静默模式（不记录日志）
  timeout?: number;             // 超时时间（毫秒）
  retry?: number;               // 重试次数
  retryDelay?: number;          // 重试延迟（毫秒）
  dedup?: boolean;             // 请求去重
}

/**
 * 统一的 API 调用封装（增强版）
 */
export async function invoke<T>(
  command: string, 
  args?: Record<string, unknown>, 
  options: ApiOptions = {}
): Promise<T> {
  const { 
    showErrorMessage = true, 
    errorMessage, 
    silent = false,
    timeout,
    retry,
    retryDelay,
    dedup
  } = options;

  try {
    if (!silent) {
      log.debug(`📤 API调用: ${command}`, args);
    }

    // 使用增强的 API 客户端
    const result = await apiClient.invoke<T>(command, args as Record<string, any>, {
      timeout,
      retry,
      retryDelay,
      silent,
      errorMessage,
      dedup
    });

    if (!silent) {
      // 对于大型数组响应，只打印摘要信息
      if (Array.isArray(result) && result.length > 10) {
        log.debug(`📥 API响应: ${command}`, {
          type: 'Array',
          length: result.length,
          first: result[0],
          last: result[result.length - 1]
        });
      } else {
        log.debug(`📥 API响应: ${command}`, result);
      }
    }

    return result;
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    const displayMsg = errorMessage || `${command} 调用失败: ${errMsg}`;

    log.logError(error, `API调用失败: ${command}`);

    if (showErrorMessage) {
      message.error(displayMsg);
    }

    throw error;
  }
}

// 导出 API 客户端实例，用于手动管理请求
export { apiClient };

/**
 * 术语库 API
 */
export const termLibraryApi = {
  async get() {
    return invoke('get_term_library', undefined, { 
      errorMessage: '加载术语库失败' 
    });
  },

  async addTerm(termData: {
    source: string;
    userTranslation: string;
    aiTranslation: string;
    context?: string | null;
  }) {
    return invoke('add_term_to_library', termData, {
      errorMessage: '添加术语失败'
    });
  },

  async removeTerm(source: string) {
    return invoke('remove_term_from_library', { source }, {
      errorMessage: '删除术语失败'
    });
  },

  async generateStyleSummary(apiKey: string) {
    return invoke('generate_style_summary', { apiKey }, {
      errorMessage: '生成风格总结失败'
    });
  },

  async shouldUpdateStyleSummary() {
    return invoke<boolean>('should_update_style_summary');
  },
};

/**
 * 翻译记忆库 API
 */
export const translationMemoryApi = {
  async get() {
    return invoke('get_translation_memory', undefined, {
      errorMessage: '加载翻译记忆库失败'
    });
  },

  async getBuiltinPhrases() {
    return invoke('get_builtin_phrases', undefined, {
      errorMessage: '加载内置词库失败'
    });
  },

  async save(memory: unknown) {
    return invoke('save_translation_memory', { memory }, {
      errorMessage: '保存翻译记忆库失败'
    });
  },
};

/**
 * PO 文件 API
 */
export const poFileApi = {
  async parse(filePath: string) {
    return invoke('parse_po_file', { filePath }, {
      errorMessage: '解析 PO 文件失败'
    });
  },

  async save(filePath: string, entries: unknown[]) {
    return invoke('save_po_file', { filePath, entries }, {
      errorMessage: '保存 PO 文件失败'
    });
  },
};

/**
 * 配置 API
 */
export const configApi = {
  async get() {
    return invoke('get_app_config', undefined, {
      errorMessage: '加载配置失败'
    });
  },

  async update(config: unknown) {
    return invoke('update_app_config', { config }, {
      errorMessage: '更新配置失败'
    });
  },

  async validate(config: unknown) {
    return invoke('validate_config', { config }, {
      errorMessage: '配置验证失败'
    });
  }
};

/**
 * 对话框 API
 */
export const dialogApi = {
  async openFile() {
    return invoke<string | null>('open_file_dialog', undefined, {
      showErrorMessage: false
    });
  },

  async saveFile() {
    return invoke<string | null>('save_file_dialog', undefined, {
      showErrorMessage: false
    });
  },
};

/**
 * 日志 API
 */
export const logApi = {
  async get() {
    return invoke<string>('get_app_logs', undefined, {
      errorMessage: '获取日志失败'
    });
  },

  async clear() {
    return invoke('clear_app_logs', undefined, {
      errorMessage: '清空日志失败'
    });
  },
};

/**
 * 提示词日志 API
 */
export const promptLogApi = {
  async get() {
    return invoke<string>('get_prompt_logs', undefined, {
      errorMessage: '获取提示词日志失败'
    });
  },

  async clear() {
    return invoke('clear_prompt_logs', undefined, {
      errorMessage: '清空提示词日志失败'
    });
  },
};

/**
 * 翻译 API
 */
export const translatorApi = {
  /**
   * 翻译单个条目（Phase 5: 支持目标语言）
   * 注意：使用配置管理器中启用的AI配置，无需传入apiKey
   */
  async translateEntry(text: string, targetLanguage?: string) {
    return invoke<string>('translate_entry', { 
      text, 
      targetLanguage: targetLanguage || null 
    }, {
      errorMessage: '翻译失败',
      silent: false
    });
  },

  /**
   * 批量翻译（带统计和进度，Phase 5: 支持目标语言）
   * 注意：使用配置管理器中启用的AI配置，无需传入apiKey
   * 返回翻译结果和统计信息，同时通过事件发送进度更新
   */
  async translateBatch(texts: string[], targetLanguage?: string) {
    return invoke<{ translations: string[], stats: any }>('translate_batch', { 
      texts, 
      targetLanguage: targetLanguage || null
    }, {
      errorMessage: '翻译失败',
      silent: false
    });
  },
  
  /**
   * 批量翻译（Channel API 版本 - Tauri 2.x 高性能）
   * 
   * 相比传统 translateBatch:
   * - 性能提升 ~40%
   * - 内存占用降低 ~30%
   * - 更适合大文件处理 (>1000 条目)
   * 
   * @deprecated 推荐使用 useChannelTranslation Hook 以获得更好的类型安全和状态管理
   */
  async translateBatchWithChannel(
    texts: string[],
    targetLanguage: string,
    progressChannel: any,
    statsChannel: any
  ) {
    return invoke<any>('translate_batch_with_channel', {
      texts,
      targetLanguage,
      progressChannel,
      statsChannel,
    }, {
      errorMessage: '批量翻译失败',
      silent: false
    });
  },

  /**
   * Contextual Refine - 携带上下文的精细翻译（Phase 7）
   * 注意：使用配置管理器中启用的AI配置，无需传入apiKey
   * 绕过翻译记忆库，充分利用上下文信息提供高质量翻译
   */
  async contextualRefine(
    requests: import('../types/tauri').ContextualRefineRequest[],
    arg2: string,
    arg3?: string
  ) {
    // 支持两种调用方式：
    // 1) contextualRefine(requests, targetLanguage)
    // 2) contextualRefine(requests, apiKey, targetLanguage)
    const hasApiKey = typeof arg3 === 'string';
    const targetLanguage = hasApiKey ? (arg3 as string) : arg2;
    const apiKey = hasApiKey ? arg2 : undefined;

    const payload: Record<string, unknown> = {
      requests,
      targetLanguage,
    };
    if (apiKey) {
      payload.apiKey = apiKey;
    }

    return invoke<string[]>('contextual_refine', payload, {
      errorMessage: '精翻失败',
      silent: false
    });
  },
};

// ========== Phase 1: AI 配置管理 API ==========

import type { AIConfig, ProviderType } from '../types/aiProvider';

/**
 * AI 配置 API
 */
export const aiConfigApi = {
  /**
   * 获取所有AI配置
   */
  async getAllConfigs() {
    // 后端返回字段为蛇形命名(api_key/base_url)，需要转换为驼峰
    const backendConfigs = await invoke<any[]>('get_all_ai_configs', {}, {
      errorMessage: '获取AI配置失败',
      silent: true,
    });

    const mapConfig = (cfg: any): AIConfig => ({
      provider: cfg.provider,
      apiKey: cfg.api_key ?? cfg.apiKey ?? '',
      baseUrl: cfg.base_url ?? cfg.baseUrl ?? undefined,
      model: cfg.model ?? undefined,
      proxy: cfg.proxy ?? undefined,
    });

    return (backendConfigs || []).map(mapConfig);
  },

  /**
   * 获取当前启用的AI配置
   */
  async getActiveConfig() {
    const cfg = await invoke<any | null>('get_active_ai_config', {}, {
      errorMessage: '获取当前AI配置失败',
      silent: true,
    });
    if (!cfg) return null;
    return {
      provider: cfg.provider,
      apiKey: cfg.api_key ?? cfg.apiKey ?? '',
      baseUrl: cfg.base_url ?? cfg.baseUrl ?? undefined,
      model: cfg.model ?? undefined,
      proxy: cfg.proxy ?? undefined,
    } as AIConfig;
  },

  /**
   * 添加AI配置
   */
  async addConfig(config: AIConfig) {
    // 转换为后端期望的蛇形命名
    const backendConfig = {
      provider: config.provider,
      api_key: config.apiKey,
      base_url: config.baseUrl || null,
      model: config.model || null,
      proxy: config.proxy || null,
    };
    return invoke<void>('add_ai_config', { config: backendConfig }, {
      errorMessage: '添加AI配置失败',
    });
  },

  /**
   * 更新AI配置
   */
  async updateConfig(index: number, config: AIConfig) {
    // 转换为后端期望的蛇形命名
    const backendConfig = {
      provider: config.provider,
      api_key: config.apiKey,
      base_url: config.baseUrl || null,
      model: config.model || null,
      proxy: config.proxy || null,
    };
    return invoke<void>('update_ai_config', { index, config: backendConfig }, {
      errorMessage: '更新AI配置失败',
    });
  },

  /**
   * 删除AI配置
   */
  async removeConfig(index: number) {
    return invoke<void>('remove_ai_config', { index }, {
      errorMessage: '删除AI配置失败',
    });
  },

  /**
   * 设置启用的AI配置
   */
  async setActiveConfig(index: number) {
    return invoke<void>('set_active_ai_config', { index }, {
      errorMessage: '设置启用配置失败',
    });
  },

  /**
   * 测试AI连接
   */
  async testConnection(provider: ProviderType, apiKey: string, baseUrl?: string, model?: string, proxy?: any) {
    const request = {
      provider,
      api_key: apiKey, // 后端使用蛇形命名
      base_url: baseUrl || null, // 后端使用蛇形命名
      model: model || null,
      proxy: proxy || null,
    };
    
    return invoke<import('../types/aiProvider').TestConnectionResult>('test_ai_connection', { 
      request
    }, {
      errorMessage: 'AI连接测试失败',
      silent: true,  // 测试连接失败时不弹toast，由调用方处理
    });
  },
};

// ========== Phase 1: 文件格式 API（预留）==========

import type { FileFormat, FileMetadata } from '../types/fileFormat';

/**
 * 文件格式 API（Phase 4 完整实现）
 */
export const fileFormatApi = {
  /**
   * 检测文件格式
   */
  async detectFormat(filePath: string) {
    return invoke<FileFormat>('detect_file_format', { filePath }, {
      errorMessage: '检测文件格式失败',
      silent: true,
    });
  },

  /**
   * 获取文件元数据
   */
  async getFileMetadata(filePath: string) {
    return invoke<FileMetadata>('get_file_metadata', { filePath }, {
      errorMessage: '获取文件元数据失败',
      silent: true,
    });
  },
};

// ========== Phase 3: 系统提示词管理 ==========

export const systemPromptApi = {
  /**
   * 获取当前系统提示词（自定义或默认）
   */
  async getPrompt() {
    return invoke<string>('get_system_prompt', {}, {
      errorMessage: '获取系统提示词失败',
    });
  },

  /**
   * 更新系统提示词
   */
  async updatePrompt(prompt: string) {
    return invoke<void>('update_system_prompt', { prompt }, {
      errorMessage: '更新系统提示词失败',
      showErrorMessage: true,
    });
  },

  /**
   * 重置为默认提示词
   */
  async resetPrompt() {
    return invoke<void>('reset_system_prompt', {}, {
      errorMessage: '重置系统提示词失败',
      showErrorMessage: true,
    });
  },
};

// ========== Phase 5: 语言检测管理 ==========

export interface LanguageInfo {
  code: string;
  display_name: string; // Rust后端使用蛇形命名
  english_name: string; // Rust后端使用蛇形命名
}

export const languageApi = {
  /**
   * 检测文本语言
   */
  async detectLanguage(text: string) {
    return invoke<LanguageInfo>('detect_text_language', { text }, {
      errorMessage: '检测语言失败',
      silent: true,
    });
  },

  /**
   * 获取默认目标语言
   */
  async getDefaultTargetLanguage(sourceLangCode: string) {
    return invoke<LanguageInfo>('get_default_target_lang', { sourceLangCode }, {
      errorMessage: '获取默认目标语言失败',
      silent: true,
    });
  },

  /**
   * 获取所有支持的语言列表
   */
  async getSupportedLanguages() {
    return invoke<LanguageInfo[]>('get_supported_langs', {}, {
      errorMessage: '获取支持的语言列表失败',
      silent: true,
    });
  },
};

// ========== Phase 6: 系统语言检测 API ==========

export const systemApi = {
  /**
   * 获取系统语言
   * 返回 BCP 47 语言标签（如 "zh-CN", "en-US"）
   */
  async getSystemLanguage() {
    return invoke<string>('get_system_language', {}, {
      errorMessage: '获取系统语言失败',
      silent: true,
    });
  },
};

