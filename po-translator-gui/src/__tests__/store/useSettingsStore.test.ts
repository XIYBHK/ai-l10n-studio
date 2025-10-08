/**
 * useSettingsStore 测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSettingsStore, loadSettings } from '../../store/useSettingsStore';

// Mock TauriStore
vi.mock('../../store/tauriStore', () => ({
  tauriStore: {
    init: vi.fn().mockResolvedValue(undefined),
    setTheme: vi.fn().mockResolvedValue(undefined),
    setLanguage: vi.fn().mockResolvedValue(undefined),
    getTheme: vi.fn().mockResolvedValue('dark'),
    getLanguage: vi.fn().mockResolvedValue('en'),
  },
}));

describe('useSettingsStore', () => {
  beforeEach(() => {
    // 重置 store
    const { result } = renderHook(() => useSettingsStore());
    act(() => {
      result.current.setTheme('light');
      result.current.setLanguage('zh-CN');
    });
    
    vi.clearAllMocks();
  });

  it('应该有默认主题和语言', () => {
    const { result } = renderHook(() => useSettingsStore());
    
    expect(result.current.theme).toBe('light');
    expect(result.current.language).toBe('zh-CN');
  });

  it('应该能够设置主题', () => {
    const { result } = renderHook(() => useSettingsStore());
    
    act(() => {
      result.current.setTheme('dark');
    });
    
    expect(result.current.theme).toBe('dark');
  });

  it('应该能够切换主题', () => {
    const { result } = renderHook(() => useSettingsStore());
    
    act(() => {
      result.current.toggleTheme();
    });
    
    expect(result.current.theme).toBe('dark');
    
    act(() => {
      result.current.toggleTheme();
    });
    
    expect(result.current.theme).toBe('light');
  });

  it('应该能够设置语言', () => {
    const { result } = renderHook(() => useSettingsStore());
    
    act(() => {
      result.current.setLanguage('en-US');
    });
    
    expect(result.current.language).toBe('en-US');
  });

  it('设置主题时应该调用 tauriStore', async () => {
    const { tauriStore } = await import('../../store/tauriStore');
    const { result } = renderHook(() => useSettingsStore());
    
    act(() => {
      result.current.setTheme('dark');
    });
    
    // 等待异步操作
    await new Promise(resolve => setTimeout(resolve, 0));
    
    expect(tauriStore.setTheme).toHaveBeenCalledWith('dark');
  });

  it('loadSettings 应该从 TauriStore 加载数据', async () => {
    await loadSettings();
    
    const { result } = renderHook(() => useSettingsStore());
    
    expect(result.current.theme).toBe('dark');
    expect(result.current.language).toBe('en');
  });
});

