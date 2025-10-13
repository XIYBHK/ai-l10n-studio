import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useAsync } from '@/hooks/useAsync';

describe('useAsync Hook', () => {
  it('应该初始化为非加载状态', () => {
    const asyncFn = vi.fn().mockResolvedValue('result');
    const { result } = renderHook(() => useAsync(asyncFn));

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.data).toBeNull(); // 实际实现返回 null
  });

  it('应该正确执行异步函数并返回数据', async () => {
    const mockData = { id: 1, name: 'Test' };
    const asyncFn = vi.fn().mockResolvedValue(mockData);

    const { result } = renderHook(() => useAsync(asyncFn));

    // 执行异步操作
    await result.current.execute();

    // 等待异步操作完成
    await waitFor(() => expect(result.current.loading).toBe(false));

    // 验证结果
    expect(result.current.data).toEqual(mockData);
    expect(result.current.error).toBeNull();
    expect(asyncFn).toHaveBeenCalledTimes(1);
  });

  it('应该正确处理异步函数错误', async () => {
    const mockError = new Error('Test error');
    const asyncFn = vi.fn().mockRejectedValue(mockError);

    const { result } = renderHook(() => useAsync(asyncFn));

    // 执行异步操作并捕获错误
    try {
      await result.current.execute();
    } catch (err) {
      // 预期会抛出错误
    }

    // 等待异步操作完成
    await waitFor(() => expect(result.current.loading).toBe(false));

    // 验证错误被捕获
    expect(result.current.error).toBe(mockError);
    expect(result.current.data).toBeNull(); // 错误时 data 为 null
  });

  it('应该支持带参数的异步函数', async () => {
    const asyncFn = vi.fn((id: number) => Promise.resolve({ id, name: `User ${id}` }));

    const { result } = renderHook(() => useAsync(asyncFn));

    // 执行带参数的异步操作
    await result.current.execute(42);

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data).toEqual({ id: 42, name: 'User 42' });
    expect(asyncFn).toHaveBeenCalledWith(42);
  });

  it('应该支持多次执行', async () => {
    let callCount = 0;
    const asyncFn = vi.fn(() => {
      callCount++;
      return Promise.resolve(callCount);
    });

    const { result } = renderHook(() => useAsync(asyncFn));

    // 第一次执行
    await result.current.execute();
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toBe(1);

    // 第二次执行
    await result.current.execute();
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toBe(2);

    expect(asyncFn).toHaveBeenCalledTimes(2);
  });

  it('应该在重新执行时清除之前的错误', async () => {
    const asyncFn = vi
      .fn()
      .mockRejectedValueOnce(new Error('First error'))
      .mockResolvedValueOnce('Success');

    const { result } = renderHook(() => useAsync(asyncFn));

    // 第一次执行（失败）
    try {
      await result.current.execute();
    } catch (err) {
      // 预期会抛出错误
    }
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeTruthy();

    // 第二次执行（成功）
    await result.current.execute();
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBeNull();
    expect(result.current.data).toBe('Success');
  });

  it('应该正确处理快速连续调用', async () => {
    let resolveCount = 0;
    const asyncFn = vi.fn(() => {
      resolveCount++;
      return new Promise((resolve) => setTimeout(() => resolve(resolveCount), 10));
    });

    const { result } = renderHook(() => useAsync(asyncFn));

    // 快速连续调用
    await result.current.execute();
    await result.current.execute();
    await result.current.execute();

    await waitFor(() => expect(result.current.loading).toBe(false));

    // 最后一次调用的结果应该生效
    expect(result.current.data).toBe(3);
  });
});
