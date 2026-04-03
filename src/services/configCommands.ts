import type { AppConfig } from '../types/tauri';
import { invoke } from './apiClient';

export const configCommands = {
  async get(): Promise<AppConfig> {
    return invoke<AppConfig>('get_app_config', undefined, {
      errorMessage: '加载配置失败',
    });
  },

  async update(config: Record<string, unknown>): Promise<void> {
    return invoke<void>('update_app_config', { config }, { errorMessage: '更新配置失败' });
  },

  async validate(config: Record<string, unknown>): Promise<boolean> {
    return invoke<boolean>('validate_config', { config }, { errorMessage: '配置验证失败' });
  },
};
