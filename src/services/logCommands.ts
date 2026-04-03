import { invoke } from './apiClient';

export const logCommands = {
  async get(): Promise<string[]> {
    return invoke<string[]>('get_app_logs', undefined, { errorMessage: '获取后端日志失败' });
  },

  async clear(): Promise<void> {
    return invoke<void>('clear_app_logs', undefined, { errorMessage: '清空后端日志失败' });
  },

  async getFrontend(): Promise<string[]> {
    return invoke<string[]>('get_frontend_logs', undefined, {
      errorMessage: '获取前端日志失败',
    });
  },

  async getPromptLogs(): Promise<string> {
    return invoke<string>('get_prompt_logs', undefined, {
      errorMessage: '获取提示词日志失败',
    });
  },

  async clearPromptLogs(): Promise<void> {
    return invoke<void>('clear_prompt_logs', undefined, {
      errorMessage: '清空提示词日志失败',
    });
  },
};
