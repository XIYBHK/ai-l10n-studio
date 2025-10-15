/**
 * 增强的 API 客户端
 *
 * 功能:
 * - 请求取消（AbortController）
 * - 超时控制
 * - 自动重试
 * - 请求去重
 */

import { invoke } from './tauriInvoke';
import { createModuleLogger } from '../utils/logger';

const log = createModuleLogger('APIClient');

interface InvokeOptions {
  timeout?: number; // 超时时间（毫秒）
  retry?: number; // 重试次数
  retryDelay?: number; // 重试延迟（毫秒）
  silent?: boolean; // 静默模式（不显示错误提示）
  errorMessage?: string; // 自定义错误消息
  dedup?: boolean; // 是否去重（相同参数的并发请求）
}

interface PendingRequest {
  promise: Promise<any>;
  controller: AbortController;
  timestamp: number;
}

class APIClient {
  private pendingRequests = new Map<string, PendingRequest>();
  private requestCounts = new Map<string, number>();

  /**
   * 调用 Tauri 命令（增强版）
   */
  async invoke<T>(
    command: string,
    params: Record<string, any> = {},
    options: InvokeOptions = {}
  ): Promise<T> {
    const {
      timeout = 30000,
      retry = 0,
      retryDelay = 1000,
      silent = false,
      errorMessage,
      dedup = false,
    } = options;

    // 请求去重
    if (dedup) {
      const key = this.getRequestKey(command, params);
      const pending = this.pendingRequests.get(key);

      if (pending) {
        log.debug(`请求去重: ${command}`, { params });
        return pending.promise;
      }
    }

    const controller = new AbortController();
    const requestKey = this.getRequestKey(command, params);

    // 记录请求
    this.incrementRequestCount(command);

    const promise = this.executeWithRetry<T>(
      command,
      params,
      controller,
      timeout,
      retry,
      retryDelay,
      silent,
      errorMessage
    );

    // 存储待处理的请求
    if (dedup) {
      this.pendingRequests.set(requestKey, {
        promise,
        controller,
        timestamp: Date.now(),
      });
    }

    try {
      const result = await promise;
      return result;
    } finally {
      // 清理
      if (dedup) {
        this.pendingRequests.delete(requestKey);
      }
    }
  }

  /**
   * 带重试的执行
   */
  private async executeWithRetry<T>(
    command: string,
    params: Record<string, any>,
    controller: AbortController,
    timeout: number,
    maxRetries: number,
    retryDelay: number,
    silent: boolean,
    errorMessage?: string
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await this.executeWithTimeout<T>(command, params, controller, timeout);

        if (attempt > 0) {
          log.info(`请求成功（重试 ${attempt} 次）: ${command}`);
        }

        return result;
      } catch (error) {
        lastError = error as Error;

        // 如果是手动取消，不重试
        if (controller.signal.aborted) {
          throw new Error(`请求已取消: ${command}`);
        }

        // 如果还有重试次数
        if (attempt < maxRetries) {
          log.warn(
            `请求失败，将在 ${retryDelay}ms 后重试 (${attempt + 1}/${maxRetries}): ${command}`,
            { error }
          );
          await this.delay(retryDelay);
          continue;
        }

        // 重试耗尽
        log.error(`请求失败（已重试 ${maxRetries} 次）: ${command}`, { error });
        break;
      }
    }

    // 抛出错误
    const finalError = new Error(errorMessage || lastError?.message || `API调用失败: ${command}`);

    if (!silent) {
      throw finalError;
    }

    throw finalError;
  }

  /**
   * 带超时的执行
   */
  private async executeWithTimeout<T>(
    command: string,
    params: Record<string, any>,
    controller: AbortController,
    timeout: number
  ): Promise<T> {
    return new Promise(async (resolve, reject) => {
      // 设置超时
      const timeoutId = setTimeout(() => {
        controller.abort();
        reject(new Error(`请求超时: ${command} (${timeout}ms)`));
      }, timeout);

      try {
        // 执行实际的调用（启用自动参数转换）
        const result = await invoke<T>(command, params, {
          autoConvertParams: true, // 🔄 启用参数转换
          silent: false, // 保留调试日志
        });
        clearTimeout(timeoutId);
        resolve(result);
      } catch (error) {
        clearTimeout(timeoutId);
        reject(error);
      }
    });
  }

  /**
   * 取消指定命令的所有请求
   */
  cancelCommand(command: string) {
    let cancelled = 0;

    this.pendingRequests.forEach((request, key) => {
      if (key.startsWith(command + ':')) {
        request.controller.abort();
        this.pendingRequests.delete(key);
        cancelled++;
      }
    });

    if (cancelled > 0) {
      log.info(`已取消 ${cancelled} 个 ${command} 请求`);
    }
  }

  /**
   * 取消所有待处理的请求
   */
  cancelAll() {
    const count = this.pendingRequests.size;

    this.pendingRequests.forEach((request) => {
      request.controller.abort();
    });

    this.pendingRequests.clear();

    if (count > 0) {
      log.info(`已取消所有请求 (${count} 个)`);
    }
  }

  /**
   * 获取请求统计
   */
  getStats() {
    return {
      pending: this.pendingRequests.size,
      totalCounts: Object.fromEntries(this.requestCounts),
    };
  }

  /**
   * 清理过期的待处理请求（超过5分钟）
   */
  cleanup() {
    const now = Date.now();
    const maxAge = 5 * 60 * 1000; // 5分钟

    this.pendingRequests.forEach((request, key) => {
      if (now - request.timestamp > maxAge) {
        log.warn(`清理过期请求: ${key}`);
        request.controller.abort();
        this.pendingRequests.delete(key);
      }
    });
  }

  // ========== 私有辅助方法 ==========

  private getRequestKey(command: string, params: Record<string, any>): string {
    return `${command}:${JSON.stringify(params)}`;
  }

  private incrementRequestCount(command: string) {
    this.requestCounts.set(command, (this.requestCounts.get(command) || 0) + 1);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// 单例
export const apiClient = new APIClient();

// 定期清理
setInterval(() => {
  apiClient.cleanup();
}, 60000); // 每分钟清理一次
