import i18n from '../i18n/config';
import { invoke } from './apiClient';

export const logCommands = {
  async get(): Promise<string[]> {
    return invoke<string[]>('get_app_logs', undefined, {
      errorMessage: i18n.t('errors.ipc.loadLogs'),
    });
  },

  async clear(): Promise<void> {
    return invoke<void>('clear_app_logs', undefined, {
      errorMessage: i18n.t('errors.ipc.clearLogs'),
    });
  },

  async getFrontend(): Promise<string[]> {
    return invoke<string[]>('get_frontend_logs', undefined, {
      errorMessage: i18n.t('errors.ipc.frontendLogs'),
    });
  },

  async getPromptLogs(): Promise<string> {
    return invoke<string>('get_prompt_logs', undefined, {
      errorMessage: i18n.t('errors.ipc.promptLogs'),
    });
  },

  async clearPromptLogs(): Promise<void> {
    return invoke<void>('clear_prompt_logs', undefined, {
      errorMessage: i18n.t('errors.ipc.clearPromptLogs'),
    });
  },
};
