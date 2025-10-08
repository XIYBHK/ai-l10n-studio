/**
 * 前端日志拦截器
 * 拦截所有 console.* 调用并保存到文件
 */

import { writeTextFile, BaseDirectory, mkdir, readDir, remove } from '@tauri-apps/plugin-fs';

class FrontendLogger {
  private logs: string[] = [];
  private maxLogs = 500; // 最多保存500条日志
  private originalConsole = {
    log: console.log,
    info: console.info,
    warn: console.warn,
    error: console.error,
    debug: console.debug,
  };

  // 过滤规则：忽略这些关键词的日志
  private ignorePatterns = [
    /^\[DEBUG\]/,                      // 忽略所有 DEBUG 日志
    /API调用:/,                        // 忽略 API 调用日志
    /API响应:/,                        // 忽略 API 响应日志
    /术语库加载成功/,                  // 忽略术语库加载
    /条目已切换/,                      // 忽略条目切换
    /AI译文已更新/,                    // 忽略AI译文更新
    /状态已更新/,                      // 忽略状态更新
    /at http:\/\/localhost/,           // 忽略堆栈跟踪行
    /at\s+\w+\s+\(http:/,              // 忽略函数堆栈跟踪
    /at\s+div$/,                       // 忽略 React div 堆栈
    /Warning:.*\[antd:/,               // 忽略 Ant Design 废弃警告
    /Warning:.*findDOMNode/,           // 忽略 findDOMNode 警告
    /Warning:.*is deprecated in StrictMode/, // 忽略 StrictMode 警告
    /Warning:.*React\.createElement/,  // 忽略 React.createElement 警告
    /Check the render method/,         // 忽略 render method 提示
    /Learn more about using refs/,     // 忽略 refs 文档链接
    /reactjs\.org\/link/,              // 忽略 React 文档链接
    /Warning:.*Static function can not consume context/, // 忽略 Ant Design context 警告
    /Warning:.*bodyStyle is deprecated/, // 忽略 bodyStyle 废弃警告
    /Warning:.*is deprecated/,         // 忽略所有其他废弃警告
  ];

  constructor() {
    this.interceptConsole();
  }

  private isModuleLog(message: string): boolean {
    // 检测是否是我们的模块日志格式：[时间] [级别] [模块名] 消息
    return /^\[\d{2}:\d{2}:\d{2}\.\d{3}\]\s+\[(DEBUG|INFO|WARN|ERROR)\]\s+\[[\w\-]+\]/.test(message);
  }

  private interceptConsole() {
    const self = this;

    // 拦截 console.log
    console.log = function(...args: any[]) {
      const message = args.join(' ');
      // 保留模块日志，但跳过 DEBUG 级别的模块日志（太多）
      if (self.isModuleLog(message)) {
        if (!message.includes('[DEBUG]')) {
          self.addLog('LOG', args);
        }
      } 
      // 或者包含关键词的日志
      else if (message.includes('ERROR') || message.includes('成功') || message.includes('失败')) {
        self.addLog('LOG', args);
      }
      self.originalConsole.log.apply(console, args);
    };

    // 拦截 console.info
    console.info = function(...args: any[]) {
      const message = args.join(' ');
      // 保留模块日志（INFO级别通常是重要信息）
      if (self.isModuleLog(message)) {
        self.addLog('INFO', args);
      }
      // 或者包含关键词的日志
      else if (message.includes('成功') || message.includes('失败') || message.includes('完成')) {
        self.addLog('INFO', args);
      }
      self.originalConsole.info.apply(console, args);
    };

    // 拦截 console.warn
    console.warn = function(...args: any[]) {
      self.addLog('WARN', args);
      self.originalConsole.warn.apply(console, args);
    };

    // 拦截 console.error
    console.error = function(...args: any[]) {
      self.addLog('ERROR', args);
      self.originalConsole.error.apply(console, args);
    };

    // 拦截 console.debug（但不记录，DEBUG日志太多）
    console.debug = function(...args: any[]) {
      // 不记录 DEBUG 日志到前端日志系统
      self.originalConsole.debug.apply(console, args);
    };

    // 拦截未捕获的错误
    window.addEventListener('error', (event) => {
      self.addLog('UNCAUGHT ERROR', [
        `${event.message} at ${event.filename}:${event.lineno}:${event.colno}`
      ]);
    });

    // 拦截未处理的Promise拒绝
    window.addEventListener('unhandledrejection', (event) => {
      const reason = event.reason instanceof Error 
        ? event.reason.message 
        : String(event.reason);
      self.addLog('UNHANDLED REJECTION', [reason]);
    });
  }

  private shouldIgnoreLog(message: string): boolean {
    // 只保留关键日志：ERROR、WARN、重要的 INFO
    return this.ignorePatterns.some(pattern => pattern.test(message));
  }

  private cleanStackTrace(text: string): string {
    // 如果是堆栈跟踪，只保留第一行（错误消息）
    const lines = text.split('\n');
    if (lines.length > 1 && lines[1].trim().startsWith('at ')) {
      // 这是一个堆栈跟踪，只返回第一行
      return lines[0];
    }
    return text;
  }

  private compactObject(obj: any): string {
    if (obj === null || obj === undefined) return String(obj);
    
    // 数组：只显示长度
    if (Array.isArray(obj)) {
      return `[Array(${obj.length})]`;
    }
    
    // 普通对象：简化显示
    const keys = Object.keys(obj);
    if (keys.length === 0) return '{}';
    if (keys.length === 1) return `{${keys[0]}: ${obj[keys[0]]}}`;
    if (keys.length === 2) return `{${keys[0]}: ${obj[keys[0]]}, ${keys[1]}: ${obj[keys[1]]}}`;
    
    // 超过2个属性：只显示前2个
    return `{${keys[0]}: ${obj[keys[0]]}, ${keys[1]}: ${obj[keys[1]]}, ...${keys.length - 2} more}`;
  }

  private addLog(level: string, args: any[]) {
    const message = args.map(arg => {
      if (typeof arg === 'string') {
        // 清理堆栈跟踪
        return this.cleanStackTrace(arg);
      } else if (typeof arg === 'object') {
        try {
          // 如果是 Error 对象，只保留消息
          if (arg instanceof Error) {
            return arg.message;
          }
          // 使用紧凑格式显示对象
          return this.compactObject(arg);
        } catch {
          return String(arg);
        }
      }
      return String(arg);
    }).join(' ');

    // 过滤掉不重要的日志
    if (this.shouldIgnoreLog(message)) {
      return;
    }

    const timestamp = new Date().toISOString().slice(11, 19); // 只保留时间部分 HH:MM:SS
    const logEntry = `[${timestamp}] [${level}] ${message}`;
    
    this.logs.push(logEntry);
    
    // 限制日志数量
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }
  }

  private async cleanOldLogFiles(maxFiles: number = 5) {
    try {
      // 读取 data 目录下的所有文件
      const entries = await readDir('data', { baseDir: BaseDirectory.AppData });
      
      // 过滤出前端日志文件
      const logFiles = entries
        .filter(entry => entry.name?.startsWith('frontend-logs-') && entry.name?.endsWith('.txt'))
        .sort((a, b) => {
          // 按文件名（时间戳）倒序排序，最新的在前
          return (b.name || '').localeCompare(a.name || '');
        });

      // 如果文件数超过限制，删除旧文件
      if (logFiles.length > maxFiles) {
        const filesToDelete = logFiles.slice(maxFiles);
        for (const file of filesToDelete) {
          if (file.name) {
            await remove(`data/${file.name}`, { baseDir: BaseDirectory.AppData });
            this.originalConsole.log(`🗑️ 清理旧日志: ${file.name}`);
          }
        }
      }
    } catch (error) {
      // 目录不存在或其他错误，忽略
      if ((error as any)?.message?.includes('not found') || (error as any)?.message?.includes('No such file')) {
        // 目录不存在是正常情况
        return;
      }
      this.originalConsole.warn('清理旧日志文件失败:', error);
    }
  }

  async saveLogs() {
    try {
      // 确保 data 目录存在
      try {
        await mkdir('data', { baseDir: BaseDirectory.AppData, recursive: true });
      } catch (error) {
        // 目录已存在的错误可以忽略
        if (!(error as any)?.message?.includes('already exists')) {
          this.originalConsole.warn('创建 data 目录失败:', error);
        }
      }

      // 清理旧文件（保留最近5个）
      await this.cleanOldLogFiles(5);

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const filename = `frontend-logs-${timestamp}.txt`;
      const content = this.logs.join('\n');
      const sizeKB = (new Blob([content]).size / 1024).toFixed(2);

      await writeTextFile(`data/${filename}`, content, { baseDir: BaseDirectory.AppData });
      
      this.originalConsole.log(`✅ 前端日志已保存: ${filename} (${sizeKB} KB, ${this.logs.length} 条)`);
      return filename;
    } catch (error) {
      this.originalConsole.error('保存前端日志失败:', error);
      throw error;
    }
  }

  getLogs(): string {
    return this.logs.join('\n');
  }

  clearLogs() {
    this.logs = [];
  }

  getOriginalConsole() {
    return this.originalConsole;
  }
}

// 创建单例
export const frontendLogger = new FrontendLogger();

// 导出到window供调试使用
if (typeof window !== 'undefined') {
  (window as any).__frontendLogger = frontendLogger;
}

