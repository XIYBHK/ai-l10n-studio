/**
 * 增强版 Tauri 事件桥接器
 *
 * 参考 clash-verge-rev 设计，提供：
 * 1. 防抖和节流策略（避免重复事件）
 * 2. 高级 cleanup 管理（避免内存泄漏）
 * 3. 定时器管理（自动清理）
 * 4. 事件回退（Tauri 事件失败时使用 window 事件）
 */

import { useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { mutate } from 'swr';
import { eventDispatcher } from '../services/eventDispatcher';
import { createModuleLogger } from '../utils/logger';

const log = createModuleLogger('TauriEventBridge');

interface EventConfig {
  /** 事件名称 */
  name: string;
  /** 事件处理函数 */
  handler: (event?: any) => void | Promise<void>;
  /** 节流间隔（毫秒），同一事件在此时间内只触发一次 */
  throttleMs?: number;
  /** 延迟执行时间（毫秒），等待指定时间后再执行 */
  delayMs?: number;
}

/**
 * 增强版 Tauri 事件桥接器
 *
 * @example
 * ```typescript
 * useTauriEventBridgeEnhanced([
 *   {
 *     name: 'config:updated',
 *     handler: () => mutate('app_config'),
 *     throttleMs: 500, // 500ms 内只触发一次
 *     delayMs: 100, // 延迟 100ms 执行
 *   },
 *   {
 *     name: 'file:saved',
 *     handler: (event) => mutate(['file_metadata', event.payload.path]),
 *   },
 * ]);
 * ```
 */
export function useTauriEventBridgeEnhanced(events: EventConfig[]) {
  useEffect(() => {
    // 组件是否已卸载
    let isUnmounted = false;

    // 清理函数列表
    const cleanupFns: Array<() => void> = [];

    // 定时器集合
    const scheduledTimeouts = new Set<ReturnType<typeof setTimeout>>();

    // 节流状态：记录每个事件的最后触发时间
    const lastTriggerTime: Record<string, number> = {};

    // 注册清理函数（立即执行或延迟执行）
    const registerCleanup = (fn: () => void) => {
      if (isUnmounted) {
        fn(); // 已卸载则立即执行
      } else {
        cleanupFns.push(fn); // 否则添加到清理列表
      }
    };

    // 带管理的延迟执行
    const scheduleTimeout = (callback: () => void | Promise<void>, delay: number) => {
      const timeoutId = setTimeout(() => {
        scheduledTimeouts.delete(timeoutId);
        void callback();
      }, delay);

      scheduledTimeouts.add(timeoutId);
      return timeoutId;
    };

    // 清除所有定时器
    const clearAllTimeouts = () => {
      scheduledTimeouts.forEach(clearTimeout);
      scheduledTimeouts.clear();
    };

    // 检查是否应该节流
    const shouldThrottle = (eventName: string, throttleMs?: number): boolean => {
      if (!throttleMs) return false;

      const now = Date.now();
      const lastTime = lastTriggerTime[eventName] || 0;

      if (now - lastTime < throttleMs) {
        return true; // 在节流期内，跳过
      }

      lastTriggerTime[eventName] = now;
      return false;
    };

    // 创建带防抖/节流的事件处理器
    const createThrottledHandler = (config: EventConfig) => {
      return (event?: any) => {
        // 检查节流
        if (shouldThrottle(config.name, config.throttleMs)) {
          log.debug(`事件 ${config.name} 被节流，跳过执行`);
          return;
        }

        // 执行处理函数（可选延迟）
        if (config.delayMs && config.delayMs > 0) {
          scheduleTimeout(() => {
            log.debug(`执行延迟事件: ${config.name}`);
            config.handler(event);
          }, config.delayMs);
        } else {
          config.handler(event);
        }
      };
    };

    // 初始化所有事件监听器
    const initializeListeners = async () => {
      log.info('🚀 初始化 Tauri 事件监听器...');

      for (const eventConfig of events) {
        const throttledHandler = createThrottledHandler(eventConfig);

        try {
          // 尝试使用 Tauri 原生事件系统
          const unlisten = await listen(eventConfig.name, throttledHandler);
          registerCleanup(unlisten);
          log.debug(`✅ 监听事件: ${eventConfig.name}`);
        } catch (error) {
          // Tauri 事件失败，使用 window 事件作为回退
          log.warn(`⚠️ Tauri 监听 ${eventConfig.name} 失败，使用 window 事件回退`, error);

          window.addEventListener(eventConfig.name, throttledHandler as EventListener);
          registerCleanup(() => {
            window.removeEventListener(eventConfig.name, throttledHandler as EventListener);
          });
        }
      }

      log.info(`✅ 初始化完成，共监听 ${events.length} 个事件`);
    };

    // 启动初始化（异步执行）
    void initializeListeners();

    // 清理函数
    return () => {
      isUnmounted = true;

      log.debug('🧹 清理 Tauri 事件监听器...');

      // 清理所有定时器
      clearAllTimeouts();

      // 执行所有清理函数
      cleanupFns.forEach((fn) => {
        try {
          fn();
        } catch (error) {
          log.warn('清理函数执行失败', error);
        }
      });

      cleanupFns.length = 0;

      log.debug('✅ 清理完成');
    };
  }, [events]);
}

/**
 * 预定义的常用事件配置
 */
export const CommonEventConfigs = {
  /** 配置更新事件 */
  configUpdated: (throttleMs = 500): EventConfig => ({
    name: 'config:updated',
    handler: () => {
      log.debug('收到 config:updated 事件，刷新配置');
      mutate('app_config');
      mutate('ai_configs');
      mutate('active_ai_config');
    },
    throttleMs,
    delayMs: 100,
  }),

  /** 术语库更新事件 */
  termUpdated: (throttleMs = 500): EventConfig => ({
    name: 'term:updated',
    handler: () => {
      log.debug('收到 term:updated 事件，刷新术语库');
      mutate(['get_term_library']);
    },
    throttleMs,
  }),

  /** 文件保存事件 */
  fileSaved: (throttleMs = 500): EventConfig => ({
    name: 'file:saved',
    handler: (event) => {
      const path = event?.payload?.path;
      if (path) {
        log.debug('收到 file:saved 事件，刷新文件元数据', { path });
        mutate(['get_file_metadata', { filePath: path }]);
        mutate(['detect_file_format', { filePath: path }]);
      }
    },
    throttleMs,
  }),

  /** 翻译完成事件 */
  translationAfter: (throttleMs = 1000): EventConfig => ({
    name: 'translation:after',
    handler: (event) => {
      log.debug('收到 translation:after 事件，刷新翻译记忆库和日志');
      // 1. 刷新 SWR 缓存
      mutate(['get_translation_memory']);
      mutate(['get_app_logs']);
      mutate(['get_prompt_logs']);
      // 2. 转发到 eventDispatcher（其他组件依赖）
      eventDispatcher.emit('translation:after', event?.payload);
    },
    throttleMs,
    delayMs: 200,
  }),

  /** 翻译统计更新事件（批量翻译增量更新）*/
  translationStatsUpdate: (throttleMs = 500): EventConfig => ({
    name: 'translation-stats-update',
    handler: (event) => {
      log.debug('收到 translation-stats-update 事件');
      // 转发到 eventDispatcher（statsManagerV2 依赖）
      eventDispatcher.emit('translation-stats-update', event?.payload);
    },
    throttleMs,
  }),

  /** Contextual Refine 开始 */
  refineStart: (throttleMs = 500): EventConfig => ({
    name: 'refine:start',
    handler: (event) => {
      log.debug('收到 refine:start 事件', event?.payload);
      // 转发到 eventDispatcher
      eventDispatcher.emit('refine:start', event?.payload);
    },
    throttleMs,
  }),

  /** Contextual Refine 完成 */
  refineComplete: (throttleMs = 500): EventConfig => ({
    name: 'refine:complete',
    handler: (event) => {
      log.debug('收到 refine:complete 事件', event?.payload);
      // 转发到 eventDispatcher
      eventDispatcher.emit('refine:complete', event?.payload);
    },
    throttleMs,
  }),

  /** Contextual Refine 错误 */
  refineError: (throttleMs = 500): EventConfig => ({
    name: 'refine:error',
    handler: (event) => {
      log.debug('收到 refine:error 事件', event?.payload);
      // 转发到 eventDispatcher
      eventDispatcher.emit('refine:error', event?.payload);
    },
    throttleMs,
  }),
};

/**
 * 默认事件桥接器（使用预定义配置）
 *
 * 这是最常用的事件监听器，适合大多数场景
 * 替代旧版本的 useTauriEventBridge
 */
export function useDefaultTauriEventBridge() {
  useTauriEventBridgeEnhanced([
    // SWR 数据同步事件
    CommonEventConfigs.configUpdated(),
    CommonEventConfigs.termUpdated(),
    CommonEventConfigs.fileSaved(),
    CommonEventConfigs.translationAfter(),
    CommonEventConfigs.translationStatsUpdate(),

    // Contextual Refine 事件
    CommonEventConfigs.refineStart(),
    CommonEventConfigs.refineComplete(),
    CommonEventConfigs.refineError(),
  ]);
}
