/**
 * Tauri 事件监听 Hook
 * 
 * 优化点：
 * 1. 防止竞态条件 - 使用 isActive 标志
 * 2. 自动清理 - 组件卸载时移除监听
 * 3. 类型安全 - 完整的 TypeScript 支持
 * 4. 内存泄漏防护
 */

import { useEffect, useRef, useState } from 'react';
import { listen, EventCallback, UnlistenFn } from '@tauri-apps/api/event';

interface UseTauriEventOptions<T> {
  /** 事件名称 */
  event: string;
  /** 事件处理函数 */
  handler: (payload: T) => void;
  /** 是否启用监听（可用于条件触发） */
  enabled?: boolean;
}

/**
 * 基础 Tauri 事件监听 Hook
 * 
 * @example
 * useTauriEvent<TranslationStats>({
 *   event: 'translation:after',
 *   handler: (stats) => {
 *     console.log('翻译完成', stats);
 *   },
 * });
 */
export function useTauriEvent<T>({ event, handler, enabled = true }: UseTauriEventOptions<T>) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!enabled) return;

    let unlistenFn: UnlistenFn | null = null;
    let isActive = true;

    const setupListener = async () => {
      const unlisten = await listen<T>(event, (e) => {
        if (isActive) {
          handlerRef.current(e.payload);
        }
      });

      if (isActive) {
        unlistenFn = unlisten;
      } else {
        unlisten();
      }
    };

    setupListener();

    return () => {
      isActive = false;
      unlistenFn?.();
    };
  }, [event, enabled]);
}

/**
 * 一次性 Tauri 事件监听 Hook
 * 事件触发一次后自动移除监听
 * 
 * @example
 * useTauriEventOnce<ProgressEvent>({
 *   event: 'translation:progress',
 *   handler: (progress) => {
 *     console.log('进度更新', progress);
 *   },
 * });
 */
export function useTauriEventOnce<T>({ event, handler, enabled = true }: UseTauriEventOptions<T>) {
  const handlerRef = useRef(handler);
  const hasTriggeredRef = useRef(false);
  handlerRef.current = handler;

  useEffect(() => {
    if (!enabled || hasTriggeredRef.current) return;

    let unlistenFn: UnlistenFn | null = null;

    const setupListener = async () => {
      unlistenFn = await listen<T>(event, (e) => {
        if (!hasTriggeredRef.current) {
          hasTriggeredRef.current = true;
          handlerRef.current(e.payload);
          unlistenFn?.();
        }
      });
    };

    setupListener();

    return () => {
      unlistenFn?.();
    };
  }, [event, enabled]);
}

/**
 * 带状态管理的 Tauri 事件 Hook
 * 自动将事件数据同步到 React 状态
 * 
 * @example
 * const stats = useTauriEventState<TranslationStats>({
 *   event: 'translation:after',
 *   initialValue: null,
 * });
 */
export function useTauriEventState<T>({
  event,
  initialValue,
  enabled = true,
}: {
  event: string;
  initialValue: T;
  enabled?: boolean;
}) {
  const [state, setState] = useState<T>(initialValue);

  useTauriEvent<T>({
    event,
    handler: (payload) => setState(payload),
    enabled,
  });

  return state;
}
