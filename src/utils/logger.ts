/**
 * 统一的日志系统
 * 提供分级日志、模块标记、时间戳等功能
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

interface LogConfig {
  level: LogLevel;
  enableTimestamp: boolean;
  enableModule: boolean;
}

class Logger {
  private config: LogConfig = {
    level: LogLevel.DEBUG,
    enableTimestamp: true, // 显示准确的本地时间戳（与后端一致）
    enableModule: true,
  };

  private getTimestamp(): string {
    const now = new Date();
    const time = now.toLocaleTimeString('zh-CN', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit',
    });
    const ms = now.getMilliseconds().toString().padStart(3, '0');
    return `${time}.${ms}`;
  }

  private formatMessage(level: string, module: string, message: string): string {
    const parts: string[] = [];
    
    if (this.config.enableTimestamp) {
      parts.push(`[${this.getTimestamp()}]`);
    }
    
    parts.push(`[${level}]`);
    
    if (this.config.enableModule && module) {
      parts.push(`[${module}]`);
    }
    
    parts.push(message);
    
    return parts.join(' ');
  }

  setLevel(level: LogLevel) {
    this.config.level = level;
  }

  debug(module: string, message: string, ...args: any[]) {
    if (this.config.level <= LogLevel.DEBUG) {
      // 使用 setTimeout 0 延迟执行，避免浏览器添加时间戳
      setTimeout(() => console.log(this.formatMessage('DEBUG', module, message), ...args), 0);
    }
  }

  info(module: string, message: string, ...args: any[]) {
    if (this.config.level <= LogLevel.INFO) {
      // 使用 setTimeout 0 延迟执行，避免浏览器添加时间戳
      setTimeout(() => console.log(this.formatMessage('INFO', module, message), ...args), 0);
    }
  }

  warn(module: string, message: string, ...args: any[]) {
    if (this.config.level <= LogLevel.WARN) {
      // 使用 setTimeout 0 延迟执行，避免浏览器添加时间戳
      setTimeout(() => console.warn(this.formatMessage('WARN', module, message), ...args), 0);
    }
  }

  error(module: string, message: string, ...args: any[]) {
    if (this.config.level <= LogLevel.ERROR) {
      // 使用 setTimeout 0 延迟执行，避免浏览器添加时间戳
      setTimeout(() => console.error(this.formatMessage('ERROR', module, message), ...args), 0);
    }
  }

  // 专门用于捕获和记录错误
  logError(module: string, error: unknown, context?: string) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    
    this.error(
      module,
      context ? `${context}: ${errorMessage}` : errorMessage,
      { error, stack }
    );
  }
}

// 导出单例
export const logger = new Logger();

// 导出便捷方法
export const createModuleLogger = (moduleName: string) => ({
  debug: (message: string, ...args: any[]) => logger.debug(moduleName, message, ...args),
  info: (message: string, ...args: any[]) => logger.info(moduleName, message, ...args),
  warn: (message: string, ...args: any[]) => logger.warn(moduleName, message, ...args),
  error: (message: string, ...args: any[]) => logger.error(moduleName, message, ...args),
  logError: (error: unknown, context?: string) => logger.logError(moduleName, error, context),
});

