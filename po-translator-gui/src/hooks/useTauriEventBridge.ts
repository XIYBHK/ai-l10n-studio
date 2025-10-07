/**
 * Tauri 事件桥接 Hook
 * 
 * 职责：将 Tauri 后端发送的事件转发到前端事件分发器
 * 这样其他组件只需订阅事件分发器，无需直接使用 Tauri listen
 */

import { useEffect, useRef } from 'react';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { eventDispatcher } from '../services/eventDispatcher';
import { TranslationStats } from '../types/tauri';
import { createModuleLogger } from '../utils/logger';

const log = createModuleLogger('TauriEventBridge');

/**
 * 桥接 Tauri 事件到事件分发器
 * 
 * 工作原理：
 * 1. 监听 Rust 后端发送的 Tauri 事件
 * 2. 将事件转发到前端事件分发器
 * 3. 其他组件订阅事件分发器即可接收事件
 * 
 * @example
 * ```tsx
 * function App() {
 *   useTauriEventBridge(); // 设置桥接
 *   
 *   // 其他组件使用事件分发器
 *   useEventListener('translation:progress', (data) => {
 *     console.log('翻译进度:', data);
 *   });
 * }
 * ```
 */
export function useTauriEventBridge() {
  const setupRef = useRef(false); // 防止 StrictMode 重复设置
  
  useEffect(() => {
    if (setupRef.current) {
      return; // 已经设置过，跳过
    }
    setupRef.current = true;
    
    const unlistenFunctions: UnlistenFn[] = [];

    const setupBridge = async () => {
      // 桥接翻译进度事件
      const unlistenProgress = await listen<{ index: number; translation: string }>(
        'translation-progress',
        (event) => {
          log.debug('🌉 桥接 Tauri 事件 -> EventDispatcher', { 
            event: 'translation-progress', 
            payload: event.payload 
          });
          
          // 转发到事件分发器
          eventDispatcher.emit('translation:progress', event.payload);
        }
      );
      unlistenFunctions.push(unlistenProgress);

      // 桥接翻译统计事件
      const unlistenStats = await listen<TranslationStats>(
        'translation-stats-update',
        (event) => {
          log.debug('🌉 桥接 Tauri 事件 -> EventDispatcher', { 
            event: 'translation-stats-update', 
            payload: event.payload 
          });
          
          // 转发到事件分发器
          eventDispatcher.emit('translation:stats', event.payload);
        }
      );
      unlistenFunctions.push(unlistenStats);

      // 桥接文件拖放事件
      const unlistenFileDrop = await listen<string[]>(
        'tauri://file-drop',
        (event) => {
          log.debug('🌉 桥接 Tauri 事件 -> EventDispatcher', { 
            event: 'tauri://file-drop', 
            payload: event.payload 
          });
          
          // 这里不转发到事件分发器，因为文件拖放需要特殊处理
          // 保留在 App.tsx 中直接处理
        }
      );
      unlistenFunctions.push(unlistenFileDrop);

      // Phase 7: 桥接 Contextual Refine 事件
      const unlistenRefineStart = await listen<{ count: number }>(
        'contextual-refine:start',
        (event) => {
          log.debug('🌉 桥接 Tauri 事件 -> EventDispatcher', {
            event: 'contextual-refine:start',
            payload: event.payload
          });
          eventDispatcher.emit('contextual-refine:start', event.payload);
        }
      );
      unlistenFunctions.push(unlistenRefineStart);

      const unlistenRefineComplete = await listen<{ results: string[]; count: number }>(
        'contextual-refine:complete',
        (event) => {
          log.debug('🌉 桥接 Tauri 事件 -> EventDispatcher', {
            event: 'contextual-refine:complete',
            payload: event.payload
          });
          eventDispatcher.emit('contextual-refine:complete', event.payload);
        }
      );
      unlistenFunctions.push(unlistenRefineComplete);

      const unlistenRefineError = await listen<{ error: string }>(
        'contextual-refine:error',
        (event) => {
          log.debug('🌉 桥接 Tauri 事件 -> EventDispatcher', {
            event: 'contextual-refine:error',
            payload: event.payload
          });
          eventDispatcher.emit('contextual-refine:error', event.payload);
        }
      );
      unlistenFunctions.push(unlistenRefineError);

      log.info('✅ Tauri 事件桥接已建立', { 
        bridgedEvents: [
          'translation-progress', 
          'translation-stats-update',
          'contextual-refine:start',
          'contextual-refine:complete',
          'contextual-refine:error'
        ] 
      });
    };

    setupBridge();

    // 清理：取消所有监听
    return () => {
      unlistenFunctions.forEach(fn => fn());
      log.info('🧹 Tauri 事件桥接已清理');
    };
  }, []);
}

