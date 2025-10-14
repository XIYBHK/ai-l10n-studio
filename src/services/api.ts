/**
 * 统一的 Tauri API 调用封装
 * 提供类型安全、统一错误处理、日志记录、请求管理
 */

import { message } from 'antd';
import { createModuleLogger } from '../utils/logger';
import { apiClient } from './apiClient';
import { convertKeysToSnakeCase } from '../utils/paramConverter';

const log = createModuleLogger('API');

/**
 * API 调用配置
 */
interface ApiOptions {
  showErrorMessage?: boolean; // 是否自动显示错误消息
  errorMessage?: string; // 自定义错误消息
  silent?: boolean; // 静默模式（不记录日志）
  timeout?: number; // 超时时间（毫秒）
  retry?: number; // 重试次数
  retryDelay?: number; // 重试延迟（毫秒）
  dedup?: boolean; // 请求去重
  autoConvertParams?: boolean; // 是否自动转换参数为 snake_case（默认true）
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
    dedup,
    autoConvertParams = true, // 默认启用自动参数转换
  } = options;

  try {
    // 🔄 自动参数转换：camelCase → snake_case
    let processedArgs = args;
    if (autoConvertParams && args) {
      processedArgs = convertKeysToSnakeCase(args as Record<string, any>);
      
      if (!silent && JSON.stringify(args) !== JSON.stringify(processedArgs)) {
        log.debug(`🔄 参数转换: ${command}`, { 
          original: args, 
          converted: processedArgs 
        });
      }
    }

    if (!silent) {
      log.debug(`📤 API调用: ${command}`, processedArgs);
    }

    // 使用增强的 API 客户端
    const result = await apiClient.invoke<T>(command, processedArgs as Record<string, any>, {
      timeout,
      retry,
      retryDelay,
      silent,
      errorMessage,
      dedup,
    });

    if (!silent) {
      // 对于大型数组响应，只打印摘要信息
      if (Array.isArray(result) && result.length > 10) {
        log.debug(`📥 API响应: ${command}`, {
          type: 'Array',
          length: result.length,
          first: result[0],
          last: result[result.length - 1],
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

// ============================================================
// ⚠️ 已迁移到 commands.ts (Phase 1.4 完成)
// ============================================================
// poFileApi → poFileCommands
// dialogApi → dialogCommands
// translatorApi → translatorCommands
// languageApi → i18nCommands
// ============================================================

/**
 * 配置 API
 */
export const configApi = {
  async get() {
    return invoke('get_app_config', undefined, {
      errorMessage: '加载配置失败',
    });
  },

  async update(config: unknown) {
    return invoke(
      'update_app_config',
      { config },
      {
        errorMessage: '更新配置失败',
      }
    );
  },

  async validate(config: unknown) {
    return invoke(
      'validate_config',
      { config },
      {
        errorMessage: '配置验证失败',
      }
    );
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
    return invoke<FileFormat>(
      'detect_file_format',
      { filePath },
      {
        errorMessage: '检测文件格式失败',
        silent: true,
      }
    );
  },

  /**
   * 获取文件元数据
   */
  async getFileMetadata(filePath: string) {
    return invoke<FileMetadata>(
      'get_file_metadata',
      { filePath },
      {
        errorMessage: '获取文件元数据失败',
        silent: true,
      }
    );
  },
};

// ========== Phase 5: 语言检测管理 ==========

export interface LanguageInfo {
  code: string;
  display_name: string; // Rust后端使用蛇形命名
  english_name: string; // Rust后端使用蛇形命名
}

// ========== Phase 6: 系统语言检测 API ==========

export const systemApi = {
  /**
   * 获取系统语言
   * 返回 BCP 47 语言标签（如 "zh-CN", "en-US"）
   */
  async getSystemLanguage() {
    return invoke<string>(
      'get_system_language',
      {},
      {
        errorMessage: '获取系统语言失败',
        silent: true,
      }
    );
  },
};
