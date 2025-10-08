/**
 * 事件分发器系统
 * 灵感来自 UE 的事件分发器，支持类型安全的事件订阅和分发
 */

import { POEntry, TranslationStats } from '../types/tauri';
import { TermEntry, StyleSummary } from '../types/termLibrary';
import { createModuleLogger } from '../utils/logger';

const log = createModuleLogger('EventDispatcher');

/**
 * 定义所有系统事件及其参数类型
 */
export type EventMap = {
  // ========== 翻译生命周期事件 ==========
  'translation:before': { 
    texts: string[];
    source: 'all' | 'selected';
  };
  
  'translation:progress': { 
    index: number;
    translation: string;
  };
  
  'translation:stats': TranslationStats;
  
  'translation:after': { 
    success: boolean;
    stats?: TranslationStats;
    error?: Error;
  };
  
  'translation:error': { 
    error: Error;
    phase: 'before' | 'execution' | 'after';
  };
  
  // ========== 术语库事件 ==========
  'term:added': { 
    term: TermEntry;
  };
  
  'term:removed': { 
    source: string;
  };
  
  'term:updated': {
    source: string;
    term?: TermEntry;
  };
  
  'term:style-updated': { 
    summary: StyleSummary;
  };
  
  // ========== 文件操作事件 ==========
  'file:loaded': { 
    path: string;
    entries: POEntry[];
  };
  
  'file:saved': { 
    path: string;
    success: boolean;
  };
  
  'file:error': {
    path?: string;
    error: Error;
    operation: 'load' | 'save';
  };
  
  // ========== 记忆库事件 ==========
  'memory:updated': { 
    count: number;
  };
  
  'memory:cleared': {};
  
  'memory:loaded': {
    count: number;
  };
  
  // ========== UI 事件 ==========
  'ui:entry-selected': {
    index: number;
    entry: POEntry;
  };
  
  'ui:entry-updated': {
    index: number;
    entry: POEntry;
  };
  
  // ========== 配置事件 ==========
  'config:updated': {
    config: any;
  };
  
  'config:synced': {
    version: number;
    timestamp: string;
    activeConfigIndex: number | null;
    configCount: number;
  };
  
  'config:out-of-sync': {
    issues: string[];
    backendVersion?: any;
  };

  // ========== Phase 7: Contextual Refine 事件 ==========
  'refine:start': {
    count: number;
  };

  'refine:progress': {
    current: number;
    total: number;
  };

  'refine:complete': {
    results: string[];
    count: number;
  };

  'refine:error': {
    error: string;
  };
};

/**
 * 事件处理器类型
 */
export type EventHandler<K extends keyof EventMap> = (payload: EventMap[K]) => void | Promise<void>;

/**
 * 事件分发器类
 * 
 * 特性：
 * 1. 类型安全 - 编译时检查事件名和参数
 * 2. 自动清理 - 返回取消订阅函数
 * 3. 支持异步 - 事件处理器可以是 async 函数
 * 4. 调试友好 - 内置日志记录
 */
class EventDispatcher {
  private listeners: Map<keyof EventMap, Set<EventHandler<any>>> = new Map();
  private eventHistory: Array<{ event: string; timestamp: number; payload: any }> = [];
  private maxHistorySize = 100;
  
  /**
   * 订阅事件
   * 
   * @param event - 事件名称
   * @param handler - 事件处理器
   * @returns 取消订阅函数
   * 
   * @example
   * ```ts
   * const unsubscribe = eventDispatcher.on('translation:progress', ({ index, translation }) => {
   *   console.log(`进度: ${index} -> ${translation}`);
   * });
   * 
   * // 使用完后清理
   * unsubscribe();
   * ```
   */
  on<K extends keyof EventMap>(
    event: K,
    handler: EventHandler<K>
  ): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    
    this.listeners.get(event)!.add(handler);
    log.debug(`📌 订阅事件: ${event}`, { totalListeners: this.listeners.get(event)!.size });
    
    // 返回取消订阅函数
    return () => this.off(event, handler);
  }
  
  /**
   * 订阅一次性事件（触发后自动取消订阅）
   * 
   * @param event - 事件名称
   * @param handler - 事件处理器
   * @returns 取消订阅函数
   */
  once<K extends keyof EventMap>(
    event: K,
    handler: EventHandler<K>
  ): () => void {
    const wrappedHandler: EventHandler<K> = async (payload) => {
      await handler(payload);
      this.off(event, wrappedHandler);
    };
    
    return this.on(event, wrappedHandler);
  }
  
  /**
   * 触发事件
   * 
   * @param event - 事件名称
   * @param payload - 事件参数
   * 
   * @example
   * ```ts
   * eventDispatcher.emit('translation:progress', {
   *   index: 5,
   *   translation: '已翻译的文本'
   * });
   * ```
   */
  async emit<K extends keyof EventMap>(
    event: K,
    payload: EventMap[K]
  ): Promise<void> {
    // 记录事件历史
    this.recordEvent(event, payload);
    
    const handlers = this.listeners.get(event);
    
    if (!handlers || handlers.size === 0) {
      log.debug(`📭 事件无监听者: ${event}`, payload);
      return;
    }
    
    log.debug(`📢 触发事件: ${event}`, { 
      listenerCount: handlers.size,
      payload 
    });
    
    // 异步执行所有处理器
    const promises: Promise<void>[] = [];
    
    for (const handler of handlers) {
      try {
        const result = handler(payload);
        if (result instanceof Promise) {
          promises.push(result);
        }
      } catch (error) {
        log.logError(error, `事件处理器执行失败: ${event}`);
      }
    }
    
    // 等待所有异步处理器完成
    if (promises.length > 0) {
      await Promise.allSettled(promises);
    }
  }
  
  /**
   * 取消订阅
   * 
   * @param event - 事件名称
   * @param handler - 要移除的处理器
   */
  off<K extends keyof EventMap>(
    event: K,
    handler: EventHandler<K>
  ): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.delete(handler);
      log.debug(`📍 取消订阅: ${event}`, { remainingListeners: handlers.size });
      
      // 如果没有监听者了，清理 Map
      if (handlers.size === 0) {
        this.listeners.delete(event);
      }
    }
  }
  
  /**
   * 清空所有监听器
   */
  clear(): void {
    const eventCount = this.listeners.size;
    this.listeners.clear();
    log.info(`🧹 清空所有事件监听器`, { clearedEvents: eventCount });
  }
  
  /**
   * 清空指定事件的所有监听器
   * 
   * @param event - 事件名称
   */
  clearEvent<K extends keyof EventMap>(event: K): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      const count = handlers.size;
      this.listeners.delete(event);
      log.info(`🧹 清空事件监听器: ${event}`, { clearedListeners: count });
    }
  }
  
  /**
   * 获取事件的监听器数量
   * 
   * @param event - 事件名称
   * @returns 监听器数量
   */
  getListenerCount<K extends keyof EventMap>(event: K): number {
    return this.listeners.get(event)?.size || 0;
  }
  
  /**
   * 获取所有注册的事件
   * 
   * @returns 事件名称数组
   */
  getRegisteredEvents(): Array<keyof EventMap> {
    return Array.from(this.listeners.keys());
  }
  
  /**
   * 记录事件历史（用于调试）
   */
  private recordEvent<K extends keyof EventMap>(
    event: K,
    payload: EventMap[K]
  ): void {
    this.eventHistory.push({
      event: event as string,
      timestamp: Date.now(),
      payload,
    });
    
    // 限制历史记录大小
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift();
    }
  }
  
  /**
   * 获取事件历史（用于调试）
   * 
   * @param event - 可选，筛选特定事件
   * @param limit - 返回数量限制
   * @returns 事件历史记录
   */
  getEventHistory(event?: keyof EventMap, limit = 20) {
    let history = this.eventHistory;
    
    if (event) {
      history = history.filter(h => h.event === event);
    }
    
    return history.slice(-limit);
  }
  
  /**
   * 调试信息
   */
  getDebugInfo() {
    const info: any = {
      totalEvents: this.listeners.size,
      events: {},
      historySize: this.eventHistory.length,
    };
    
    for (const [event, handlers] of this.listeners.entries()) {
      info.events[event] = {
        listenerCount: handlers.size,
      };
    }
    
    return info;
  }
}

/**
 * 全局事件分发器实例
 */
export const eventDispatcher = new EventDispatcher();

