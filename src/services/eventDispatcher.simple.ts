/**
 * 简化版事件分发器
 *
 * 基于 Tauri 2.0+ 的直接事件监听，替代复杂的 EventDispatcher
 * 灵感来自 cc-switch：简单、直接、高效
 *
 * 保留旧版 eventDispatcher 的 API，渐进式替换
 * 如果有问题，可以快速回退到旧版本
 */

import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { createModuleLogger } from '../utils/logger';

const log = createModuleLogger('EventDispatcher.simple');

type EventListener = (data?: any) => void | Promise<void>;
const eventListeners = new Map<string, EventListener[]>();

const tauriUnlisteners: Map<string, UnlistenFn> = new Map();

export async function emit(eventName: string, data?: any): Promise<void> {
  const listeners = eventListeners.get(eventName) || [];
  log.debug('触发事件', { eventName, listeners: listeners.length });

  // 同步执行所有监听器
  for (const listener of listeners) {
    try {
      await listener(data);
    } catch (error) {
      log.error('事件处理失败', { eventName, error });
    }
  }
}

export function on(eventName: string, handler: EventListener): () => void {
  const listeners = eventListeners.get(eventName) || [];
  listeners.push(handler);
  eventListeners.set(eventName, listeners);

  log.debug('添加事件监听器', { eventName, total: listeners.length });

  // 返回取消订阅函数
  return () => {
    const currentListeners = eventListeners.get(eventName) || [];
    const index = currentListeners.indexOf(handler);
    if (index >= 0) {
      currentListeners.splice(index, 1);
      eventListeners.set(eventName, currentListeners);
      log.debug('移除事件监听器', { eventName, remaining: currentListeners.length });
    }
  };
}

export async function connectTauriEvent(
  tauriEvent: string,
  handler: EventListener
): Promise<() => void> {
  try {
    const unlisten = await listen(tauriEvent, (event) => {
      log.debug('Tauri 事件触发', { tauriEvent, hasPayload: !!event });
      handler(event.payload || event);
    });

    tauriUnlisteners.set(tauriEvent, unlisten);
    log.debug('连接 Tauri 事件', { tauriEvent });

    // 返回取消连接函数
    return () => {
      const storedUnlisten = tauriUnlisteners.get(tauriEvent);
      if (storedUnlisten) {
        storedUnlisten();
        tauriUnlisteners.delete(tauriEvent);
        log.debug('取消 Tauri 事件连接', { tauriEvent });
      }
    };
  } catch (error) {
    log.error('连接 Tauri 事件失败', { tauriEvent, error });
    return () => {};
  }
}

export function cleanup(): void {
  for (const [eventName, unlisten] of tauriUnlisteners) {
    try {
      unlisten();
      log.debug('清理 Tauri 监听器', { eventName });
    } catch (error) {
      log.warn('清理 Tauri 监听器失败', { eventName, error });
    }
  }
  tauriUnlisteners.clear();

  eventListeners.clear();
  log.info('事件系统已清理');
}

export function getStats(): { events: number; listeners: number; tauriEvents: number } {
  const eventCount = eventListeners.size;
  const listenerCount = Array.from(eventListeners.values()).reduce(
    (sum, list) => sum + list.length,
    0
  );
  const tauriEventCount = tauriUnlisteners.size;

  return {
    events: eventCount,
    listeners: listenerCount,
    tauriEvents: tauriEventCount,
  };
}
