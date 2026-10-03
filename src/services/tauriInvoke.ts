import { invoke as tauriInvoke } from '@tauri-apps/api/core';
import { createModuleLogger } from '../utils/logger';

const log = createModuleLogger('TauriInvoke');
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

function maskValue(value: unknown): unknown {
  if (typeof value !== 'string') return value == null ? value : '***';
  if (!value) return value;
  if (value.startsWith('sk-')) {
    return `sk-***...***${value.length >= 8 ? value.slice(-4) : ''}`;
  }
  if (value.length <= 8) return '***';
  return `${value.slice(0, 3)}***...***${value.slice(-3)}`;
}

export function maskSensitiveData(data: unknown): unknown {
  if (!data || typeof data !== 'object') return data;
  if (Array.isArray(data)) return data.map(maskSensitiveData);
  return Object.fromEntries(
    Object.entries(data).map(([key, value]) => [
      key,
      sensitiveKeys.some((sensitive) => key.toLowerCase().includes(sensitive))
        ? maskValue(value)
        : maskSensitiveData(value),
    ])
  );
}

export async function invoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  try {
    log.info(`Tauri调用开始: ${command}`, { args: maskSensitiveData(args) });
    const result = await tauriInvoke<T>(command, args);
    log.info(`Tauri调用成功: ${command}`);
    return result;
  } catch (error) {
    log.error(`Tauri调用失败: ${command}`, { args: maskSensitiveData(args), error });
    throw error;
  }
}
