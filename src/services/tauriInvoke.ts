/**
 * Tauri invoke 包装器
 *
 * 提供参数转换功能，避免循环依赖
 */

import { invoke as tauriInvoke } from '@tauri-apps/api/core';
import { convertKeysToSnakeCase } from '../utils/paramConverter';
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
  /**
   * 是否自动转换参数为 snake_case
   *
   * **架构约定**（2025-10）：
   * - 默认 `false` - Tauri 2.x 已自动处理 camelCase，无需转换
   * - 前端统一使用 camelCase 参数
   * - 后端通过 `#[serde(rename_all = "camelCase")]` 统一序列化
   *
   * 仅在特殊场景（如旧版兼容）需要设置为 `true`
   */
  autoConvertParams?: boolean;
  /** 是否静默模式，不输出调试日志 */
  silent?: boolean;
}

/**
 * 带参数转换的 Tauri invoke 包装器
 *
 * **架构设计**（2025-10）：
 * - Tauri 2.x 期望前端传递 camelCase 参数
 * - 默认不转换参数（`autoConvertParams = false`）
 * - 前后端统一使用 camelCase 格式
 *
 * @param command 命令名称
 * @param args 参数对象
 * @param options 选项
 * @returns Promise<T>
 */
export async function invoke<T>(
  command: string,
  args?: Record<string, unknown>,
  options: InvokeOptions = {}
): Promise<T> {
  const {
    autoConvertParams = false, // 🎯 架构决策：默认不转换，Tauri 2.x 已处理
    silent = true, // ✅ 默认静默，减少控制台日志污染（参考 clash-verge-rev）
  } = options;

  let processedArgs = args;

  // 🔄 自动参数转换：camelCase → snake_case
  if (autoConvertParams && args) {
    processedArgs = convertKeysToSnakeCase(args as Record<string, any>);

    if (!silent && JSON.stringify(args) !== JSON.stringify(processedArgs)) {
      log.debug(`🔄 参数转换: ${command}`, {
        original: maskSensitiveData(args),
        converted: maskSensitiveData(processedArgs),
      });
    }
  }

  // ❌ 默认不输出调试日志，避免控制台污染
  // if (!silent) {
  //   log.debug(`📤 Tauri调用: ${command}`, maskSensitiveData(processedArgs));
  // }

  try {
    const result = await tauriInvoke<T>(command, processedArgs as Record<string, any>);

    // ❌ 默认不输出调试日志，避免控制台污染
    // if (!silent) {
    //   log.debug(`📥 Tauri响应: ${command}`, maskSensitiveData(result));
    // }

    return result;
  } catch (error) {
    log.error(`❌ Tauri调用失败: ${command}`, {
      args: maskSensitiveData(processedArgs),
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
