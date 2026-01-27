/**
 * Notification Manager - 全局通知管理器
 *
 * 提供单例的通知服务，可以在任何地方调用
 *
 * @example
 * ```typescript
 * import { notificationManager } from '@/utils/notificationManager';
 *
 * notificationManager.success('操作成功', '文件已保存');
 * notificationManager.error('操作失败', '网络连接错误');
 * ```
 */

import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from '@tauri-apps/plugin-notification';
import { createModuleLogger } from './logger';

const log = createModuleLogger('NotificationManager');

export interface NotificationOptions {
  title: string;
  body: string;
  icon?: string;
  sound?: string;
}

class NotificationManager {
  private enabled: boolean = true;
  private hasPermission: boolean = false;
  private initialized: boolean = false;

  async init(): Promise<void> {
    if (this.initialized) return;

    try {
      this.hasPermission = await isPermissionGranted();

      if (!this.hasPermission) {
        log.warn('通知权限未授予，将在首次使用时请求');
      } else {
        log.info('通知权限已授予');
      }

      this.initialized = true;
    } catch (error) {
      log.error('初始化通知管理器失败:', error);
    }
  }

  async requestPermission(): Promise<boolean> {
    try {
      const permission = await requestPermission();
      this.hasPermission = permission === 'granted';

      if (this.hasPermission) {
        log.info('通知权限已授予');
      } else {
        log.warn('通知权限被拒绝');
      }

      return this.hasPermission;
    } catch (error) {
      log.error('请求通知权限失败:', error);
      return false;
    }
  }

  async send(options: NotificationOptions): Promise<void> {
    if (!this.enabled) {
      log.debug('通知已禁用，跳过发送');
      return;
    }

    if (!this.initialized) {
      await this.init();
    }

    try {
      // 检查权限
      if (!this.hasPermission) {
        const granted = await this.requestPermission();
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

      log.info('通知已发送:', options.title);
    } catch (error) {
      log.error('发送通知失败:', error);
    }
  }

  async success(title: string, body: string): Promise<void> {
    await this.send({
      title,
      body,
    });
  }

  async error(title: string, body: string): Promise<void> {
    await this.send({
      title,
      body,
    });
  }

  async info(title: string, body: string): Promise<void> {
    await this.send({
      title,
      body,
    });
  }

  async warning(title: string, body: string): Promise<void> {
    await this.send({
      title,
      body,
    });
  }

  async batchTranslationComplete(total: number, success: number, failed: number): Promise<void> {
    const successRate = Math.round((success / total) * 100);

    if (failed === 0) {
      await this.success('批量翻译完成', `成功翻译 ${success}/${total} 条内容 (${successRate}%)`);
    } else {
      await this.warning(
        '批量翻译完成（部分失败）',
        `成功: ${success}, 失败: ${failed} (总计: ${total})`
      );
    }
  }

  async fileSaved(filename: string, count: number): Promise<void> {
    await this.success('文件已保存', `${filename} - ${count} 条翻译`);
  }

  async exportComplete(filename: string): Promise<void> {
    await this.success('导出成功', `文件已导出: ${filename}`);
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    log.info(`通知${enabled ? '已启用' : '已禁用'}`);
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  toggle(): void {
    this.setEnabled(!this.enabled);
  }
}

export const notificationManager = new NotificationManager();

notificationManager.init().catch((error) => {
  log.error('自动初始化通知管理器失败:', error);
});
