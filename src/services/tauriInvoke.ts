/**
 * Tauri invoke 包装器
 *
 * 简化版封装，提供日志记录和敏感信息掩码
 */

import { invoke as tauriInvoke } from '@tauri-apps/api/core';
import { createModuleLogger } from '../utils/logger';

const log = createModuleLogger('TauriInvoke');

/**
 * 🔒 敏感信息掩码工具
 *
 * 防止API密钥、密码等敏感信息出现在日志中
 */
export function maskSensitiveData(data: any): any {
  if (!data || typeof data !== 'object') {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => maskSensitiveData(item));
  }

  const sensitiveKeys = [
    'api_key',
    'apikey',
    'password',
    'token',
    'secret',
    'key',
    'authorization',
    'bearer',
    'credentials',
    'auth',
  ];

  const masked = { ...data };

  for (const key in masked) {
    const lowerKey = key.toLowerCase();

    // 检查是否为敏感字段
    if (sensitiveKeys.some((sensitiveKey) => lowerKey.includes(sensitiveKey))) {
      const value = masked[key];
      if (typeof value === 'string' && value.length > 0) {
        // 掩码策略：sk-***...***末尾3位
        if (value.startsWith('sk-')) {
          const end = value.length >= 8 ? value.slice(-4) : '';
          masked[key] = `sk-***...***${end}`;
        } else if (value.length <= 8) {
          masked[key] = '***';
        } else {
          const start = value.substring(0, 3);
          const end = value.substring(value.length - 3);
          masked[key] = `${start}***...***${end}`;
        }
      }
    } else if (typeof masked[key] === 'object') {
      // 递归处理嵌套对象
      masked[key] = maskSensitiveData(masked[key]);
    }
  }

  return masked;
}

interface InvokeOptions {
  /** 是否静默模式，不输出调试日志 */
  silent?: boolean;
}

/**
 * Tauri invoke 包装器
 *
 * 提供统一的错误处理和敏感信息掩码
 * Tauri 2.x 已自动处理 camelCase，前后端统一使用 camelCase 格式
 *
 * @param command 命令名称
 * @param args 参数对象
 * @param options 选项
 * @returns Promise<T>
 */
export async function invoke<T>(
  command: string,
  args?: Record<string, unknown>,
  _options: InvokeOptions = {}
): Promise<T> {
  try {
    const result = await tauriInvoke<T>(command, args as Record<string, any>);
    return result;
  } catch (error) {
    log.error(`❌ Tauri调用失败: ${command}`, {
      args: maskSensitiveData(args),
      error,
    });
    throw error;
  }
}

/**
 * 不带参数转换的原生 Tauri invoke
 *
 * 用于需要精确控制参数格式的场景
 */
export { tauriInvoke as invokeRaw };
