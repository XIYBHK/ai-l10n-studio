import { useEffect } from 'react';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { mutate } from 'swr';

export function useTauriEvent(
  eventName: string,
  handler: (payload: any) => void | Promise<void>,
  deps: any[] = []
) {
  useEffect(() => {
    let unlisten: UnlistenFn;

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

export function useSWRRevalidate(key: string, eventName: string, deps: any[] = []) {
  useTauriEvent(
    eventName,
    () => {
      mutate(key);
    },
    deps
  );
}

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
