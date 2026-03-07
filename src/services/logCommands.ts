import { invoke } from './commandClient';
import { COMMANDS } from './commandKeys';

export const logCommands = {
  async get(): Promise<string[]> {
    return invoke<string[]>(COMMANDS.LOG_GET, undefined, { errorMessage: '获取后端日志失败' });
  },

  async clear(): Promise<void> {
    return invoke<void>(COMMANDS.LOG_CLEAR, undefined, { errorMessage: '清空后端日志失败' });
  },

  async getFrontend(): Promise<string[]> {
    return invoke<string[]>(COMMANDS.LOG_FRONTEND_GET, undefined, {
      errorMessage: '获取前端日志失败',
    });
  },

  async getPromptLogs(): Promise<string> {
    return invoke<string>(COMMANDS.PROMPT_LOG_GET, undefined, { errorMessage: '获取提示词日志失败' });
  },

  async clearPromptLogs(): Promise<void> {
    return invoke<void>(COMMANDS.PROMPT_LOG_CLEAR, undefined, {
      errorMessage: '清空提示词日志失败',
    });
  },
};
