/**
 * 全局日志服务（参考 clash-verge-rev）
 *
 * 架构设计：
 * - Zustand 管理全局日志状态
 * - 固定 1000 条日志上限
 * - Pause/Resume 控制日志收集
 * - Clear 只清空前端状态
 */

import { create } from 'zustand';
import { logCommands } from './logCommands';

const MAX_LOG_NUM = 1000;

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

/**
 * 日志项结构
 */
export interface LogItem {
  time: string; // 格式: "MM-DD HH:mm:ss"
  type: LogLevel;
  module?: string; // 可选的模块名
  message: string;
}

/**
 * 全局日志 Store
 */
interface GlobalLogStore {
  // 后端日志
  backendLogs: string[]; // 原始日志行
  backendEnabled: boolean; // 后端日志是否启用
  backendError: boolean;

  // 前端日志（内存）
  frontendLogs: LogItem[];
  frontendEnabled: boolean;

  // 提示词日志
  promptLogs: string;
  promptEnabled: boolean;
  promptError: boolean;

  // Actions
  setBackendLogs: (logs: string[]) => void;
  setBackendEnabled: (enabled: boolean) => void;
  clearBackendLogs: () => void;

  appendFrontendLog: (log: LogItem) => void;
  setFrontendEnabled: (enabled: boolean) => void;
  clearFrontendLogs: () => void;

  setPromptLogs: (logs: string) => void;
  clearPromptLogs: () => void;
}

export const useGlobalLogStore = create<GlobalLogStore>((set) => ({
  // 初始状态
  backendLogs: [],
  backendEnabled: false,
  backendError: false,
  frontendLogs: [],
  frontendEnabled: false,
  promptLogs: '',
  promptEnabled: false,
  promptError: false,

  // 后端日志
  setBackendLogs: (logs) => set({ backendLogs: logs }),
  setBackendEnabled: (enabled) => set({ backendEnabled: enabled }),
  clearBackendLogs: () => set({ backendLogs: [] }),

  // 前端日志
  appendFrontendLog: (log) =>
    set((state) => {
      const newLogs =
        state.frontendLogs.length >= MAX_LOG_NUM
          ? [...state.frontendLogs.slice(1), log]
          : [...state.frontendLogs, log];
      return { frontendLogs: newLogs };
    }),
  setFrontendEnabled: (enabled) => set({ frontendEnabled: enabled }),
  clearFrontendLogs: () => set({ frontendLogs: [] }),

  // 提示词日志
  setPromptLogs: (logs) => set({ promptLogs: logs }),
  clearPromptLogs: () => set({ promptLogs: '' }),
}));

let backendPollingInterval: NodeJS.Timeout | null = null;
let promptPollingInterval: NodeJS.Timeout | null = null;
let backendGeneration = 0;
let promptGeneration = 0;

export const fetchBackendLogs = async (generation = backendGeneration): Promise<boolean> => {
  try {
    const logs = await logCommands.get();
    if (generation !== backendGeneration) return false;
    useGlobalLogStore.getState().setBackendLogs(logs);
    useGlobalLogStore.setState({ backendError: false, backendEnabled: true });
    return true;
  } catch (error) {
    console.error('[LogService] 获取后端日志失败:', error);
    if (generation === backendGeneration) {
      useGlobalLogStore.setState({ backendError: true, backendEnabled: false });
    }
    return false;
  }
};

export const fetchPromptLogs = async (generation = promptGeneration): Promise<boolean> => {
  try {
    const logs = await logCommands.getPromptLogs();
    if (generation !== promptGeneration) return false;
    useGlobalLogStore.getState().setPromptLogs(logs);
    useGlobalLogStore.setState({ promptError: false, promptEnabled: true });
    return true;
  } catch (error) {
    console.error('[LogService] 获取提示词日志失败:', error);
    if (generation === promptGeneration) {
      useGlobalLogStore.setState({ promptError: true, promptEnabled: false });
    }
    return false;
  }
};

export const startBackendLogMonitoring = async (): Promise<boolean> => {
  const generation = ++backendGeneration;
  if (backendPollingInterval) {
    clearInterval(backendPollingInterval);
  }
  useGlobalLogStore.setState({ backendEnabled: true, backendError: false });
  const success = await fetchBackendLogs(generation);
  if (!success || generation !== backendGeneration) {
    if (generation === backendGeneration) backendPollingInterval = null;
    return false;
  }
  backendPollingInterval = setInterval(() => {
    const pollingGeneration = backendGeneration;
    void fetchBackendLogs(pollingGeneration).then((ok) => {
      if (!ok && pollingGeneration === backendGeneration) stopBackendLogMonitoring();
    });
  }, 2000);

  console.log('[LogService] 后端日志监控已启动（每2秒）');
  return true;
};

export const stopBackendLogMonitoring = () => {
  ++backendGeneration;
  useGlobalLogStore.setState({ backendEnabled: false });

  if (backendPollingInterval) {
    clearInterval(backendPollingInterval);
    backendPollingInterval = null;
  }

  console.log('[LogService] 后端日志监控已停止');
};

export const startPromptLogMonitoring = async (): Promise<boolean> => {
  const generation = ++promptGeneration;
  if (promptPollingInterval) {
    clearInterval(promptPollingInterval);
  }
  useGlobalLogStore.setState({ promptEnabled: true, promptError: false });
  const success = await fetchPromptLogs(generation);
  if (!success || generation !== promptGeneration) {
    if (generation === promptGeneration) promptPollingInterval = null;
    return false;
  }
  promptPollingInterval = setInterval(() => {
    const pollingGeneration = promptGeneration;
    void fetchPromptLogs(pollingGeneration).then((ok) => {
      if (!ok && pollingGeneration === promptGeneration) stopPromptLogMonitoring();
    });
  }, 2000);

  console.log('[LogService] 提示词日志监控已启动（每2秒）');
  return true;
};

export const stopPromptLogMonitoring = () => {
  ++promptGeneration;
  useGlobalLogStore.setState({ promptEnabled: false });
  if (promptPollingInterval) {
    clearInterval(promptPollingInterval);
    promptPollingInterval = null;
  }

  console.log('[LogService] 提示词日志监控已停止');
};

export const toggleBackendLogEnabled = () => {
  const { backendEnabled } = useGlobalLogStore.getState();

  if (backendEnabled) {
    stopBackendLogMonitoring();
  } else {
    void startBackendLogMonitoring();
  }
};

export const clearBackendLogs = async () => {
  try {
    await logCommands.clear();
    ++backendGeneration;
    useGlobalLogStore.getState().clearBackendLogs();

    console.log('[LogService] 后端日志已清空（继续监控，显示增量日志）');
  } catch (error) {
    console.error('[LogService] 清空后端日志失败:', error);
    throw error;
  }
};

export const clearPromptLogs = async () => {
  try {
    await logCommands.clearPromptLogs();
    ++promptGeneration;
    useGlobalLogStore.getState().clearPromptLogs();

    console.log('[LogService] 提示词日志已清空');
  } catch (error) {
    console.error('[LogService] 清空提示词日志失败:', error);
    throw error;
  }
};

export const clearFrontendLogs = () => {
  useGlobalLogStore.getState().clearFrontendLogs();
  console.log('[LogService] 前端日志已清空');
};

export const appendFrontendLog = (log: LogItem) => {
  const { frontendEnabled } = useGlobalLogStore.getState();
  if (frontendEnabled) {
    useGlobalLogStore.getState().appendFrontendLog(log);
  }
};

export const toggleFrontendLogEnabled = () => {
  const { frontendEnabled, setFrontendEnabled } = useGlobalLogStore.getState();
  setFrontendEnabled(!frontendEnabled);
  console.log(`[LogService] 前端日志已${!frontendEnabled ? '启用' : '禁用'}`);
};

export const isFrontendLogEnabled = () => {
  return useGlobalLogStore.getState().frontendEnabled;
};
