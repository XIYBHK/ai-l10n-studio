import { useState, useCallback } from 'react';
import { createModuleLogger } from '../utils/logger';

const log = createModuleLogger('useAsync');

/**
 * 异步操作的状态
 */
export interface AsyncState<T> {
  loading: boolean;
  error: Error | null;
  data: T | null;
}

/**
 * 通用的异步操作 Hook
 *
 * 自动管理 loading、error、data 状态，消除重复代码
 *
 * @param asyncFn - 异步函数
 * @param onSuccess - 成功回调（可选）
 * @param onError - 错误回调（可选）
 *
 * @example
 * ```tsx
 * const { loading, error, data, execute } = useAsync(
 *   async (id: string) => {
 *     return await api.fetchUser(id);
 *   }
 * );
 *
 * // 调用
 * await execute('user-123');
 * ```
 */
export function useAsync<T, Args extends any[]>(
  asyncFn: (...args: Args) => Promise<T>,
  options: {
    onSuccess?: (data: T) => void;
    onError?: (error: Error) => void;
    initialData?: T;
  } = {}
) {
  const [state, setState] = useState<AsyncState<T>>({
    loading: false,
    error: null,
    data: options.initialData || null,
  });

  const execute = useCallback(
    async (...args: Args): Promise<T> => {
      setState((prev) => ({ ...prev, loading: true, error: null }));

      try {
        const result = await asyncFn(...args);
        setState({ loading: false, error: null, data: result });

        if (options.onSuccess) {
          options.onSuccess(result);
        }

        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setState({ loading: false, error, data: null });

        log.logError(error, '异步操作失败');

        if (options.onError) {
          options.onError(error);
        }

        throw error;
      }
    },
    [asyncFn, options.onSuccess, options.onError]
  );

  const reset = useCallback(() => {
    setState({
      loading: false,
      error: null,
      data: options.initialData || null,
    });
  }, [options.initialData]);

  return {
    ...state,
    execute,
    reset,
  };
}

