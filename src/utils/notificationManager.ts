import { isTauri } from '@tauri-apps/api/core';
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from '@tauri-apps/plugin-notification';
import i18n from '../i18n/config';
import { tauriStore, type AppStoreData } from '../store/tauriStore';
import { createModuleLogger } from './logger';

const log = createModuleLogger('NotificationManager');
type Preferences = AppStoreData['preferences']['notifications'];

export class NotificationManager {
  private initialization: Promise<void> | null = null;
  private preferences: Preferences = {
    enabled: true,
    onComplete: true,
    onError: true,
    onProgress: false,
  };

  async init(): Promise<void> {
    if (!this.initialization) {
      this.initialization = tauriStore
        .getPreferences()
        .then((preferences) => {
          this.preferences = { ...preferences.notifications };
        })
        .catch((error) => {
          this.initialization = null;
          throw error;
        });
    }
    await this.initialization;
  }

  async requestPermission(): Promise<boolean> {
    if (!isTauri()) return false;
    return (await requestPermission()) === 'granted';
  }

  async setEnabled(enabled: boolean): Promise<void> {
    await this.setNotificationPreferences({ enabled });
  }

  isEnabled(): boolean {
    return this.preferences.enabled;
  }

  getNotificationPreferences(): Preferences {
    return { ...this.preferences };
  }

  async setNotificationPreferences(updates: Partial<Preferences>): Promise<void> {
    await this.init();
    const next = { ...this.preferences, ...updates };
    await tauriStore.updatePreferences({ notifications: next });
    this.preferences = next;
  }

  private async send(kind: 'onComplete' | 'onError', title: string, body: string): Promise<void> {
    try {
      await this.init();
      if (!this.preferences.enabled || !this.preferences[kind] || !isTauri()) return;
      if (!(await isPermissionGranted())) return;
      sendNotification({ title, body });
    } catch (error) {
      log.logError(error, 'System notification failed');
    }
  }

  async translationComplete(total: number, success: number, failed: number): Promise<void> {
    await this.send(
      'onComplete',
      i18n.t(failed ? 'notifications.partialTitle' : 'notifications.completeTitle'),
      i18n.t('notifications.completeBody', { total, success, failed })
    );
  }

  async translationError(body: string): Promise<void> {
    await this.send('onError', i18n.t('notifications.errorTitle'), body);
  }
}

export const notificationManager = new NotificationManager();
