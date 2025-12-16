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
import { logCommands } from './commands';

// 日志上限（参考 clash）
const MAX_LOG_NUM = 1000;

/**
 * 日志级别（对齐后端）
 */
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

  // 前端日志（内存）
  frontendLogs: LogItem[];
  frontendEnabled: boolean;

  // 提示词日志
  promptLogs: string;

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

/**
 * 创建全局日志 Store（参考 clash-verge-rev）
 */
export const useGlobalLogStore = create<GlobalLogStore>((set) => ({
  // 初始状态
  backendLogs: [],
  backendEnabled: false,
  frontendLogs: [],
  frontendEnabled: false,
  promptLogs: '',

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

/**
 * 全局日志轮询器（参考 clash IPC 模式）
 */
let backendPollingInterval: NodeJS.Timeout | null = null;
let promptPollingInterval: NodeJS.Timeout | null = null;

/**
 * 获取后端日志（通过 IPC）
 */
export const fetchBackendLogs = async () => {
  try {
    const logs = await logCommands.get();
    useGlobalLogStore.getState().setBackendLogs(logs);
  } catch (error) {
    console.error('[LogService] 获取后端日志失败:', error);
  }
};

/**
 * 获取提示词日志（通过 IPC）
 */
export const fetchPromptLogs = async () => {
  try {
    const logs = await logCommands.getPromptLogs();
    useGlobalLogStore.getState().setPromptLogs(logs);
  } catch (error) {
    console.error('[LogService] 获取提示词日志失败:', error);
  }
};

/**
 * 启动后端日志监控（参考 clash）
 */
export const startBackendLogMonitoring = () => {
  const { setBackendEnabled } = useGlobalLogStore.getState();
  setBackendEnabled(true);

  // 立即获取一次
  fetchBackendLogs();

  // 启动定期轮询（2 秒）
  if (backendPollingInterval) {
    clearInterval(backendPollingInterval);
  }
  backendPollingInterval = setInterval(fetchBackendLogs, 2000);

  console.log('[LogService] 后端日志监控已启动（每2秒）');
};

/**
 * 停止后端日志监控
 */
export const stopBackendLogMonitoring = () => {
  const { setBackendEnabled } = useGlobalLogStore.getState();
  setBackendEnabled(false);

  if (backendPollingInterval) {
    clearInterval(backendPollingInterval);
    backendPollingInterval = null;
  }

  console.log('[LogService] 后端日志监控已停止');
};

/**
 * 启动提示词日志监控
 */
export const startPromptLogMonitoring = () => {
  // 立即获取一次
  fetchPromptLogs();

  // 启动定期轮询（2 秒）
  if (promptPollingInterval) {
    clearInterval(promptPollingInterval);
  }
  promptPollingInterval = setInterval(fetchPromptLogs, 2000);

  console.log('[LogService] 提示词日志监控已启动（每2秒）');
};

/**
 * 停止提示词日志监控
 */
export const stopPromptLogMonitoring = () => {
  if (promptPollingInterval) {
    clearInterval(promptPollingInterval);
    promptPollingInterval = null;
  }

  console.log('[LogService] 提示词日志监控已停止');
};

/**
 * 切换后端日志启用状态（参考 clash toggleLogEnabled）
 */
export const toggleBackendLogEnabled = () => {
  const { backendEnabled } = useGlobalLogStore.getState();

  if (backendEnabled) {
    stopBackendLogMonitoring();
  } else {
    startBackendLogMonitoring();
  }
};

/**
 * 清空后端日志（前端状态 + 后端文件，继续监控显示增量日志）
 * 参考 clash-verge-rev：清空后继续监控，后续显示的是增量日志
 */
export const clearBackendLogs = async () => {
  try {
    // 1. 清空前端显示（立即生效）
    useGlobalLogStore.getState().clearBackendLogs();

    // 2. 清空后端文件（后台操作）
    await logCommands.clear();

    // 3. 继续监控（不停止），后续显示的是清空后的增量日志
    console.log('[LogService] 后端日志已清空（继续监控，显示增量日志）');
  } catch (error) {
    console.error('[LogService] 清空后端日志失败:', error);
    throw error;
  }
};

/**
 * 清空提示词日志
 */
export const clearPromptLogs = async () => {
  try {
    // 1. 先清空前端显示（立即生效）
    useGlobalLogStore.getState().clearPromptLogs();

    // 2. 再清空后端文件（后台操作）
    await logCommands.clearPromptLogs();

    console.log('[LogService] 提示词日志已清空');
  } catch (error) {
    console.error('[LogService] 清空提示词日志失败:', error);
    throw error;
  }
};

/**
 * 清空前端日志
 */
export const clearFrontendLogs = () => {
  useGlobalLogStore.getState().clearFrontendLogs();
  console.log('[LogService] 前端日志已清空');
};

/**
 * 添加前端日志（供 logger 使用）
 */
export const appendFrontendLog = (log: LogItem) => {
  const { frontendEnabled } = useGlobalLogStore.getState();
  if (frontendEnabled) {
    useGlobalLogStore.getState().appendFrontendLog(log);
  }
};

/**
 * 切换前端日志启用状态
 */
export const toggleFrontendLogEnabled = () => {
  const { frontendEnabled, setFrontendEnabled } = useGlobalLogStore.getState();
  setFrontendEnabled(!frontendEnabled);
  console.log(`[LogService] 前端日志已${!frontendEnabled ? '启用' : '禁用'}`);
};

/**
 * 获取前端日志启用状态（用于 simpleFrontendLogger 条件拦截）
 */
export const isFrontendLogEnabled = () => {
  return useGlobalLogStore.getState().frontendEnabled;
};
