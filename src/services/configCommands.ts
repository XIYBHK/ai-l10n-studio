import type { AppConfig } from '../types/tauri';
import { invoke } from './commandClient';
import { COMMANDS } from './commandKeys';

export const configCommands = {
  async get(): Promise<AppConfig> {
    return invoke<AppConfig>(COMMANDS.CONFIG_GET, undefined, {
      errorMessage: '加载配置失败',
    });
  },

  async update(config: Record<string, unknown>): Promise<void> {
    return invoke<void>(COMMANDS.CONFIG_UPDATE, { config }, { errorMessage: '更新配置失败' });
  },

  async validate(config: Record<string, unknown>): Promise<boolean> {
    return invoke<boolean>(COMMANDS.CONFIG_VALIDATE, { config }, { errorMessage: '配置验证失败' });
  },
};
