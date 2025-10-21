/**
 * 统一的 Tauri API 调用封装
 * 提供类型安全、统一错误处理、日志记录、请求管理
 */

import { message } from 'antd';
import { createModuleLogger } from '../utils/logger';
import { apiClient } from './apiClient';
import { maskSensitiveData } from './tauriInvoke';

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
  /**
   * 是否自动转换参数（默认false，遵循架构约定）
   * @see tauriInvoke.ts - 架构设计说明
   */
  autoConvertParams?: boolean;
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
    silent = true, // ✅ 默认静默，减少控制台日志污染（参考 clash-verge-rev）
    timeout,
    retry,
    retryDelay,
    dedup,
    autoConvertParams, // 🎯 不设默认值，让 apiClient → tauriInvoke 处理（默认 false）
  } = options;

  try {
    // ❌ 移除 API 层日志，避免重复（TauriInvoke 层会记录）
    // if (!silent) {
    //   log.debug(`📤 API调用: ${command}`, maskSensitiveData(args));
    // }

    // 使用增强的 API 客户端（参数转换由 tauriInvoke 统一处理）
    const result = await apiClient.invoke<T>(command, args as Record<string, any>, {
      timeout,
      retry,
      retryDelay,
      silent,
      errorMessage,
      dedup,
      autoConvertParams, // 🎯 透传给 apiClient → tauriInvoke
    });

    // ❌ 移除 API 层日志，避免重复（TauriInvoke 层会记录）
    // if (!silent) {
    //   // 对于大型数组响应，只打印摘要信息
    //   if (Array.isArray(result) && result.length > 10) {
    //     log.debug(`📥 API响应: ${command}`, {
    //       type: 'Array',
    //       length: result.length,
    //       first: result[0],
    //       last: result[result.length - 1],
    //     });
    //   } else {
    //     log.debug(`📥 API响应: ${command}`, result);
    //   }
    // }

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
// ✅ 所有API已完全迁移到统一命令层 (commands.ts)
// ============================================================
// 统一使用 xxxCommands 模块，不再使用直接API调用
// ============================================================
