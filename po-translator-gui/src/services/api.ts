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
   * 翻译单个条目
   */
  async translateEntry(text: string, apiKey: string) {
    return invoke<string>('translate_entry', { text, apiKey }, {
      errorMessage: '翻译失败',
      silent: false
    });
  },

  /**
   * 批量翻译（简单版本，不带统计）
   */
  async translateBatch(texts: string[], apiKey: string) {
    return invoke<string[]>('translate_batch', { texts, apiKey }, {
      errorMessage: '批量翻译失败',
      silent: false
    });
  },

  /**
   * 批量翻译（带统计信息）
   * 注意：此函数不会等待翻译完成，需要监听事件获取进度
   */
  async translateBatchWithStats(texts: string[], apiKey: string) {
    return invoke<void>('translate_batch_with_stats', { texts, apiKey }, {
      errorMessage: '批量翻译失败',
      silent: false
    });
  },
};

