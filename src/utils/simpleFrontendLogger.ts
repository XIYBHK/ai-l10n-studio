/**
 * 简化的前端日志系统（参考 clash-verge-rev）
 *
 * 设计原则：
 * - 只保留内存日志，不保存到文件
 * - 使用全局 Zustand store
 * - 简单的 console 拦截
 * - 最多保留 1000 条
 * - 启用时才拦截，避免污染后端日志
 */

import {
  appendFrontendLog,
  isFrontendLogEnabled,
  type LogItem,
  type LogLevel,
} from '../services/logService';

class SimpleFrontendLogger {
  private originalConsole = {
    log: console.log,
    info: console.info,
    warn: console.warn,
    error: console.error,
  };

  constructor() {
    this.interceptConsole();
  }

  private getTimestamp(): string {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const date = String(now.getDate()).padStart(2, '0');
    const time = now.toLocaleTimeString('zh-CN', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    return `${month}-${date} ${time}`;
  }

  private extractModuleName(message: string): string | undefined {
    const match = message.match(/\[([A-Za-z0-9\-_]+)\]/);
    return match ? match[1] : undefined;
  }

  private shouldIgnore(message: string): boolean {
    const ignorePatterns = [
      /^\[DEBUG\]/, // 忽略 DEBUG 日志（太多）
      /Warning:.*\[antd:/,
      /Warning:.*Static function/,
      /Download the React DevTools/,
      /at http:\/\/localhost/,
    ];

    return ignorePatterns.some((pattern) => pattern.test(message));
  }

  private addLog(type: LogLevel, args: any[]) {
    const message = args
      .map((arg) => (typeof arg === 'object' ? JSON.stringify(arg) : String(arg)))
      .join(' ');

    if (this.shouldIgnore(message)) {
      return;
    }

    const log: LogItem = {
      time: this.getTimestamp(),
      type,
      module: this.extractModuleName(message),
      message,
    };

    appendFrontendLog(log);
  }

  private interceptConsole() {
    const self = this;

    console.log = function (...args: any[]) {
      if (isFrontendLogEnabled()) {
        const message = args.join(' ');
        if (
          message.includes('[INFO]') ||
          message.includes('[WARN]') ||
          message.includes('[ERROR]')
        ) {
          if (message.includes('[INFO]')) {
            self.addLog('INFO', args);
          } else if (message.includes('[WARN]')) {
            self.addLog('WARN', args);
          } else if (message.includes('[ERROR]')) {
            self.addLog('ERROR', args);
          }
        }
      }
      self.originalConsole.log.apply(console, args);
    };

    console.info = function (...args: any[]) {
      if (isFrontendLogEnabled()) {
        self.addLog('INFO', args);
      }
      self.originalConsole.info.apply(console, args);
    };

    console.warn = function (...args: any[]) {
      if (isFrontendLogEnabled()) {
        self.addLog('WARN', args);
      }
      self.originalConsole.warn.apply(console, args);
    };

    console.error = function (...args: any[]) {
      if (isFrontendLogEnabled()) {
        self.addLog('ERROR', args);
      }
      self.originalConsole.error.apply(console, args);
    };
  }
}

export const simpleFrontendLogger = new SimpleFrontendLogger();
