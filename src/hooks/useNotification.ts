/**
 * Notification Hook - 系统通知封装
 *
 * 使用 tauri-plugin-notification 提供桌面通知
 *
 * @example
 * ```tsx
 * const { notify } = useNotification();
 *
 * notify.success('翻译完成', '成功翻译 100 条内容');
 * notify.error('翻译失败', '网络连接错误');
 * notify.info('提示', '正在处理...');
 * ```
 */

import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from '@tauri-apps/plugin-notification';
import { useState, useCallback, useEffect } from 'react';
import { createModuleLogger } from '../utils/logger';

const log = createModuleLogger('useNotification');

export interface NotificationOptions {
  title: string;
  body: string;
  icon?: string;
  sound?: string;
}

export interface NotificationAPI {
  /**
   * 发送成功通知
   */
  success: (title: string, body: string) => Promise<void>;

  /**
   * 发送错误通知
   */
  error: (title: string, body: string) => Promise<void>;

  /**
   * 发送信息通知
   */
  info: (title: string, body: string) => Promise<void>;

  /**
   * 发送警告通知
   */
  warning: (title: string, body: string) => Promise<void>;

  /**
   * 发送自定义通知
   */
  send: (options: NotificationOptions) => Promise<void>;

  /**
   * 检查通知权限
   */
  checkPermission: () => Promise<boolean>;

  /**
   * 请求通知权限
   */
  requestPermission: () => Promise<boolean>;

  /**
   * 通知是否已启用
   */
  isEnabled: boolean;

  /**
   * 切换通知开关
   */
  toggle: () => void;
}

/**
 * 通知 Hook
 */
export const useNotification = (): NotificationAPI => {
  const [isEnabled, setIsEnabled] = useState(true); // 默认启用
  const [hasPermission, setHasPermission] = useState(false);

  // 初始化检查权限
  useEffect(() => {
    checkPermissionStatus();
  }, []);

  const checkPermissionStatus = useCallback(async () => {
    try {
      const granted = await isPermissionGranted();
      setHasPermission(granted);

      if (!granted) {
        log.warn('通知权限未授予');
      }
    } catch (error) {
      log.error('检查通知权限失败:', error);
      setHasPermission(false);
    }
  }, []);

  const requestNotificationPermission = useCallback(async (): Promise<boolean> => {
    try {
      const permission = await requestPermission();
      const granted = permission === 'granted';
      setHasPermission(granted);

      if (granted) {
        log.info('✅ 通知权限已授予');
      } else {
        log.warn('⚠️ 通知权限被拒绝');
      }

      return granted;
    } catch (error) {
      log.error('请求通知权限失败:', error);
      return false;
    }
  }, []);

  const send = useCallback(
    async (options: NotificationOptions) => {
      if (!isEnabled) {
        log.info('通知已禁用，跳过发送');
        return;
      }

      try {
        // 检查权限
        if (!hasPermission) {
          const granted = await requestNotificationPermission();
          if (!granted) {
            log.warn('无通知权限，跳过发送');
            return;
          }
        }

        // 发送通知
        await sendNotification({
          title: options.title,
          body: options.body,
          icon: options.icon,
          sound: options.sound,
        });

        log.info('📬 通知已发送:', options.title);
      } catch (error) {
        log.error('发送通知失败:', error);
      }
    },
    [isEnabled, hasPermission, requestNotificationPermission]
  );

  const success = useCallback(
    async (title: string, body: string) => {
      await send({
        title: `✅ ${title}`,
        body,
      });
    },
    [send]
  );

  const error = useCallback(
    async (title: string, body: string) => {
      await send({
        title: `❌ ${title}`,
        body,
      });
    },
    [send]
  );

  const info = useCallback(
    async (title: string, body: string) => {
      await send({
        title: `ℹ️ ${title}`,
        body,
      });
    },
    [send]
  );

  const warning = useCallback(
    async (title: string, body: string) => {
      await send({
        title: `⚠️ ${title}`,
        body,
      });
    },
    [send]
  );

  const toggle = useCallback(() => {
    setIsEnabled((prev) => {
      const newState = !prev;
      log.info(`通知${newState ? '启用' : '禁用'}`);
      return newState;
    });
  }, []);

  return {
    success,
    error,
    info,
    warning,
    send,
    checkPermission: async () => {
      await checkPermissionStatus();
      return hasPermission;
    },
    requestPermission: requestNotificationPermission,
    isEnabled,
    toggle,
  };
};
