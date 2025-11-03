import { useEffect } from 'react';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { mutate } from 'swr';

/**
 * 直接使用 Tauri 2.0 listen API
 * 替代复杂的 EventDispatcher
 * 简洁、高效、无过度设计
 */

/**
 * 订阅 Tauri 事件
 */
export function useTauriEvent(
  eventName: string,
  handler: (payload: any) => void | Promise<void>,
  deps: any[] = []
) {
  useEffect(() => {
    let unlisten: UnlistenFn;

    // 直接调用 Tauri listen
    const setup = async () => {
      try {
        unlisten = await listen(eventName, (event) => {
          handler(event.payload || event);
        });
      } catch (error) {
        console.error(`[Tauri Event] 订阅失败: ${eventName}`, error);
      }
    };

    setup();

    return () => {
      if (unlisten) {
        unlisten();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventName, ...deps]);
}

/**
 * 订阅 SWR 数据更新事件
 */
export function useSWRRevalidate(
  key: string,
  eventName: string,
  deps: any[] = []
) {
  useTauriEvent(eventName, () => {
    // 重新验证 SWR 数据
    mutate(key);
  }, deps);
}

/**
 * 订阅翻译相关事件
 */
export function useTranslationEvents(
  onProgress?: (data: any) => void,
  onComplete?: (data: any) => void,
  onError?: (data: any) => void
) {
  useTauriEvent('translation:progress', (data) => {
    onProgress?.(data);
  });

  useTauriEvent('translation:after', (data) => {
    onComplete?.(data);
  });

  useTauriEvent('translation:error', (data) => {
    onError?.(data);
  });
}

/**
 * 订阅文件操作事件
 */
export function useFileEvents(
  onLoaded?: (data: any) => void,
  onSaved?: (data: any) => void,
  onError?: (data: any) => void
) {
  useTauriEvent('file:loaded', (data) => {
    onLoaded?.(data);
  });

  useTauriEvent('file:saved', (data) => {
    onSaved?.(data);
  });

  useTauriEvent('file:error', (data) => {
    onError?.(data);
  });
}
