/**
 * 统一的 Tauri API 调用封装
 * 提供类型安全、统一错误处理、日志记录
 */

import { invoke as tauriInvoke } from '@tauri-apps/api/tauri';
import { message } from 'antd';
import { createModuleLogger } from '../utils/logger';

const log = createModuleLogger('API');

/**
 * API 调用配置
 */
interface ApiOptions {
  showErrorMessage?: boolean;  // 是否自动显示错误消息
  errorMessage?: string;        // 自定义错误消息
  silent?: boolean;             // 静默模式（不记录日志）
}

/**
 * 统一的 API 调用封装
 */
export async function invoke<T>(
  command: string, 
  args?: Record<string, unknown>, 
  options: ApiOptions = {}
): Promise<T> {
  const { 
    showErrorMessage = true, 
    errorMessage, 
    silent = false 
  } = options;

  try {
    if (!silent) {
      log.debug(`📤 API调用: ${command}`, args);
    }

    const result = await tauriInvoke<T>(command, args);

    if (!silent) {
      log.debug(`📥 API响应: ${command}`, result);
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
  },

  async getProviders() {
    return invoke('get_provider_configs', undefined, {
      errorMessage: '获取服务商配置失败'
    });
  },
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
 * 翻译 API
 */
export const translatorApi = {
  /**
   * 翻译单个条目（Phase 5: 支持目标语言）
   */
  async translateEntry(text: string, apiKey: string, targetLanguage?: string) {
    return invoke<string>('translate_entry', { 
      text, 
      apiKey, 
      targetLanguage: targetLanguage || null 
    }, {
      errorMessage: '翻译失败',
      silent: false
    });
  },

  /**
   * 批量翻译（简单版本，不带统计，Phase 5: 支持目标语言）
   */
  async translateBatch(texts: string[], apiKey: string, targetLanguage?: string) {
    return invoke<string[]>('translate_batch', { 
      texts, 
      apiKey,
      targetLanguage: targetLanguage || null
    }, {
      errorMessage: '批量翻译失败',
      silent: false
    });
  },

  /**
   * 批量翻译（带统计信息，Phase 5: 支持目标语言）
   * 注意：此函数不会等待翻译完成，需要监听事件获取进度
   */
  async translateBatchWithStats(texts: string[], apiKey: string, targetLanguage?: string) {
    return invoke<void>('translate_batch_with_stats', { 
      texts, 
      apiKey,
      targetLanguage: targetLanguage || null
    }, {
      errorMessage: '批量翻译失败',
      silent: false
    });
  },

  /**
   * Contextual Refine - 携带上下文的精细翻译（Phase 7）
   * 绕过翻译记忆库，充分利用上下文信息提供高质量翻译
   */
  async contextualRefine(
    requests: import('../types/tauri').ContextualRefineRequest[],
    apiKey: string,
    targetLanguage: string
  ) {
    return invoke<string[]>('contextual_refine', {
      requests,
      apiKey,
      targetLanguage
    }, {
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
    return invoke<AIConfig[]>('get_all_ai_configs', {}, {
      errorMessage: '获取AI配置失败',
      silent: true,
    });
  },

  /**
   * 获取当前启用的AI配置
   */
  async getActiveConfig() {
    return invoke<AIConfig | null>('get_active_ai_config', {}, {
      errorMessage: '获取当前AI配置失败',
      silent: true,
    });
  },

  /**
   * 添加AI配置
   */
  async addConfig(config: AIConfig) {
    return invoke<void>('add_ai_config', { config }, {
      errorMessage: '添加AI配置失败',
    });
  },

  /**
   * 更新AI配置
   */
  async updateConfig(index: number, config: AIConfig) {
    return invoke<void>('update_ai_config', { index, config }, {
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
      apiKey,
      baseUrl: baseUrl || null,
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
  displayName: string;
  englishName: string;
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

