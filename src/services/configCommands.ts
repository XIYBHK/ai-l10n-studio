import i18n from '../i18n/config';
import type { AppConfig } from '../types/tauri';
import { invoke } from './apiClient';

export const configCommands = {
  async getSettingsPath(): Promise<string> {
    return invoke<string>('get_app_settings_path', undefined, {
      errorMessage: i18n.t('errors.ipc.loadConfig'),
    });
  },
  async get(): Promise<AppConfig> {
    return invoke<AppConfig>('get_app_config', undefined, {
      errorMessage: i18n.t('errors.ipc.loadConfig'),
    });
  },

  async update(config: Record<string, unknown>): Promise<void> {
    return invoke<void>(
      'update_app_config',
      { config },
      { errorMessage: i18n.t('errors.ipc.updateConfig') }
    );
  },

  async validate(config: Record<string, unknown>): Promise<boolean> {
    return invoke<boolean>(
      'validate_config',
      { config },
      { errorMessage: i18n.t('errors.ipc.validateConfig') }
    );
  },
};
