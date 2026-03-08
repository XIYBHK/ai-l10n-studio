/**
 * 澧炲己锟?API 瀹㈡埛锟?
 *
 * 鍔熻兘:
 * - 璇锋眰鍙栨秷锛圓bortController锟?
 * - 瓒呮椂鎺у埗
 * - 鑷姩閲嶈瘯
 * - 璇锋眰鍘婚噸
 * - 缁熶竴閿欒鎻愮ず
 */

import { invoke } from './tauriInvoke';
import { createModuleLogger } from '../utils/logger';

const log = createModuleLogger('APIClient');

interface InvokeOptions {
  timeout?: number; // 瓒呮椂鏃堕棿锛堟绉掞級
  retry?: number; // 閲嶈瘯娆℃暟
  retryDelay?: number; // 閲嶈瘯寤惰繜锛堟绉掞級
  silent?: boolean; // 闈欓粯妯″紡锛堜笉鏄剧ず閿欒鎻愮ず锟?
  errorMessage?: string; // 鑷畾涔夐敊璇秷锟?
  dedup?: boolean; // 鏄惁鍘婚噸锛堢浉鍚屽弬鏁扮殑骞跺彂璇锋眰锟?
  showErrorMessage?: boolean; // 鏄惁鑷姩鏄剧ず閿欒娑堟伅锛堥粯锟?true锟?
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
   * 璋冪敤 Tauri 鍛戒护锛堝寮虹増锟?
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
      showErrorMessage = true,
    } = options;

    if (dedup) {
      const key = this.getRequestKey(command, params);
      const pending = this.pendingRequests.get(key);

      if (pending) {
        log.debug(`璇锋眰鍘婚噸: ${command}`, { params });
        return pending.promise;
      }
    }

    const controller = new AbortController();
    const requestKey = this.getRequestKey(command, params);

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
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      const displayMsg = errorMessage || errMsg;

      log.logError(error, `API璋冪敤澶辫触: ${command}`);

      if (showErrorMessage) {
        const { message } = await import('antd');
        message.error(displayMsg);
      }

      throw error;
    } finally {
      if (dedup) {
        this.pendingRequests.delete(requestKey);
      }
    }
  }

  /**
   * 甯﹂噸璇曠殑鎵ц
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
        const result = await this.executeWithTimeout<T>(
          command,
          params,
          timeout,
          controller,
          silent
        );

        if (attempt > 0) {
          log.info(`璇锋眰鎴愬姛锛堥噸锟?${attempt} 娆★級: ${command}`);
        }

        return result;
      } catch (error) {
        lastError = error as Error;

        // 濡傛灉鏄墜鍔ㄥ彇娑堬紝涓嶉噸锟?
        if (controller.signal.aborted) {
          throw new Error(`璇锋眰宸插彇锟? ${command}`);
        }

        // 濡傛灉杩樻湁閲嶈瘯娆℃暟
        if (attempt < maxRetries) {
          log.warn(
            `璇锋眰澶辫触锛屽皢锟?${retryDelay}ms 鍚庨噸锟?(${attempt + 1}/${maxRetries}): ${command}`,
            { error }
          );
          await this.delay(retryDelay);
          continue;
        }

        // 閲嶈瘯鑰楀敖
        log.error(`璇锋眰澶辫触锛堝凡閲嶈瘯 ${maxRetries} 娆★級: ${command}`, { error });
        break;
      }
    }

    // 鎶涘嚭閿欒
    const finalError = new Error(
      errorMessage || lastError?.message || `API璋冪敤澶辫触: ${command}`
    );

    throw finalError;
  }

  private async executeWithTimeout<T>(
    command: string,
    params: Record<string, any>,
    timeout: number,
    controller: AbortController,
    silent: boolean
  ): Promise<T> {
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, timeout);

    try {
      // 鎵ц瀹為檯鐨勮皟锟?
      const result = await invoke<T>(command, params, { silent });
      clearTimeout(timeoutId);
      return result;
    } catch (error) {
      clearTimeout(timeoutId);
      if (controller.signal.aborted) {
        throw new Error(`璇锋眰瓒呮椂: ${command} (${timeout}ms)`);
      }
      throw error;
    }
  }

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
      log.info(`宸插彇锟?${cancelled} 锟?${command} 璇锋眰`);
    }
  }

  cancelAll() {
    const count = this.pendingRequests.size;

    this.pendingRequests.forEach((request) => {
      request.controller.abort();
    });

    this.pendingRequests.clear();

    if (count > 0) {
      log.info(`宸插彇娑堟墍鏈夎锟?(${count} 锟?`);
    }
  }

  getStats() {
    return {
      pending: this.pendingRequests.size,
      totalCounts: Object.fromEntries(this.requestCounts),
    };
  }

  cleanup() {
    const now = Date.now();
    const maxAge = 5 * 60 * 1000; // 5鍒嗛挓

    this.pendingRequests.forEach((request, key) => {
      if (now - request.timestamp > maxAge) {
        log.warn(`娓呯悊杩囨湡璇锋眰: ${key}`);
        request.controller.abort();
        this.pendingRequests.delete(key);
      }
    });
  }

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

// 鍗曚緥
export const apiClient = new APIClient();

const cleanupInterval = setInterval(() => {
  apiClient.cleanup();
}, 60000);

cleanupInterval.unref?.();
