/**
 * Tauri invoke 包装器
 * 
 * 提供参数转换功能，避免循环依赖
 */

import { invoke as tauriInvoke } from '@tauri-apps/api/core';
import { convertKeysToSnakeCase } from '../utils/paramConverter';
import { createModuleLogger } from '../utils/logger';

const log = createModuleLogger('TauriInvoke');

interface InvokeOptions {
  /** 是否自动转换参数为 snake_case（默认true） */
  autoConvertParams?: boolean;
  /** 是否静默模式，不输出调试日志 */
  silent?: boolean;
}

/**
 * 带参数转换的 Tauri invoke 包装器
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
    autoConvertParams = true,
    silent = false,
  } = options;

  let processedArgs = args;

  // 🔄 自动参数转换：camelCase → snake_case
  if (autoConvertParams && args) {
    processedArgs = convertKeysToSnakeCase(args as Record<string, any>);
    
    if (!silent && JSON.stringify(args) !== JSON.stringify(processedArgs)) {
      log.debug(`🔄 参数转换: ${command}`, { 
        original: args, 
        converted: processedArgs 
      });
    }
  }

  if (!silent) {
    log.debug(`📤 Tauri调用: ${command}`, processedArgs);
  }

  try {
    const result = await tauriInvoke<T>(command, processedArgs as Record<string, any>);
    
    if (!silent) {
      log.debug(`📥 Tauri响应: ${command}`, result);
    }
    
    return result;
  } catch (error) {
    log.error(`❌ Tauri调用失败: ${command}`, { 
      args: processedArgs, 
      error 
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
