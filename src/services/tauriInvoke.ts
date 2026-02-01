/**
 * Tauri invoke 包装器
 *
 * 简化版封装，提供日志记录和敏感信息掩码
 */

import { invoke as tauriInvoke } from '@tauri-apps/api/core';
import { createModuleLogger } from '../utils/logger';

const log = createModuleLogger('TauriInvoke');

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

    if (sensitiveKeys.some((sensitiveKey) => lowerKey.includes(sensitiveKey))) {
      const value = masked[key];
      if (typeof value === 'string' && value.length > 0) {
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
      masked[key] = maskSensitiveData(masked[key]);
    }
  }

  return masked;
}

interface InvokeOptions {
  silent?: boolean;
}

export async function invoke<T>(
  command: string,
  args?: Record<string, unknown>,
  _options: InvokeOptions = {}
): Promise<T> {
  try {
    log.info(`⏳ Tauri调用开始: ${command}`, { args: maskSensitiveData(args) });
    const result = await tauriInvoke<T>(command, args as Record<string, any>);
    log.info(`✅ Tauri调用成功: ${command}`);
    return result;
  } catch (error) {
    log.error(`❌ Tauri调用失败: ${command}`, {
      args: maskSensitiveData(args),
      error,
    });
    throw error;
  }
}

export { tauriInvoke as invokeRaw };
