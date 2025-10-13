import { useEffect } from 'react';
import { eventDispatcher, EventMap, EventHandler } from '../services/eventDispatcher';

/**
 * React Hook：订阅事件分发器的事件
 * 自动管理订阅生命周期，组件卸载时自动清理
 *
 * @param event - 事件名称
 * @param handler - 事件处理器
 * @param deps - 依赖数组（可选，默认为空数组）
 *
 * @example
 * ```tsx
 * import { useEventListener } from '@/hooks/useEventListener';
 *
 * function MyComponent() {
 *   useEventListener('translation:progress', ({ index, translation }) => {
 *     console.log(`进度: ${index} -> ${translation}`);
 *   });
 *
 *   // 或带依赖
 *   useEventListener('translation:progress', ({ index }) => {
 *     updateProgress(index);
 *   }, [updateProgress]); // updateProgress 变化时重新订阅
 *
 *   return <div>...</div>;
 * }
 * ```
 */
export function useEventListener<K extends keyof EventMap>(
  event: K,
  handler: EventHandler<K>,
  deps: any[] = []
) {
  useEffect(() => {
    const unsubscribe = eventDispatcher.on(event, handler);
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event, ...deps]);
}

/**
 * React Hook：订阅一次性事件
 * 事件触发后自动取消订阅
 *
 * @param event - 事件名称
 * @param handler - 事件处理器
 * @param deps - 依赖数组
 *
 * @example
 * ```tsx
 * useEventListenerOnce('file:loaded', ({ path, entries }) => {
 *   console.log(`文件已加载: ${path}`);
 *   // 此回调只会执行一次
 * });
 * ```
 */
export function useEventListenerOnce<K extends keyof EventMap>(
  event: K,
  handler: EventHandler<K>,
  deps: any[] = []
) {
  useEffect(() => {
    const unsubscribe = eventDispatcher.once(event, handler);
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event, ...deps]);
}
