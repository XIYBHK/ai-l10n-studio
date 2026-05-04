/**
 * Tauri 命令调用封装
 *
 * 职责：
 * - 调用 tauriInvoke（含日志和敏感信息掩码）
 * - 统一错误弹窗提示
 */

import { invoke as tauriInvoke } from './tauriInvoke';
import { createModuleLogger } from '../utils/logger';

const log = createModuleLogger('APIClient');

interface InvokeOptions {
  /** 静默模式：出错时不显示 message.error */
  silent?: boolean;
  /** 自定义错误消息（替代原始错误文本） */
  errorMessage?: string;
  /** 是否自动显示错误消息（默认 true） */
  showErrorMessage?: boolean;
}

/**
 * 调用 Tauri 命令，自动处理错误提示
 */
export async function invoke<T>(
  command: string,
  params: Record<string, any> = {},
  options: InvokeOptions = {}
): Promise<T> {
  const { silent = false, errorMessage, showErrorMessage = true } = options;

  try {
    return await tauriInvoke<T>(command, params, { silent });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    const displayMsg = errorMessage || errMsg;

    log.logError(error, `API调用失败: ${command}`);

    if (showErrorMessage && !silent) {
      const { message } = await import('antd');
      message.error(displayMsg);
    }

    throw error;
  }
}
