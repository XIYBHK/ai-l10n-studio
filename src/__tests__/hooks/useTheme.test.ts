import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useTheme } from '@/hooks/useTheme';
import { useAppStore } from '@/store/useAppStore';

// Mock AppStore
vi.mock('@/store/useAppStore', () => ({
  useAppStore: vi.fn(),
}));

// Mock Tauri API
vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: vi.fn(() => ({
    theme: vi.fn().mockResolvedValue('light'),
    setTheme: vi.fn().mockResolvedValue(undefined),
    onThemeChanged: vi.fn().mockResolvedValue(() => {}),
  })),
}));

describe('useTheme', () => {
  const mockSetTheme = vi.fn();
  let mockStore: any;

  beforeEach(() => {
    mockSetTheme.mockClear();
    
    mockStore = {
      theme: 'light',
      setTheme: mockSetTheme,
    };
    
    (useAppStore as any).mockImplementation((selector: any) => selector(mockStore));
    
    // Mock matchMedia
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation(query => {
        const isDarkMode = query === '(prefers-color-scheme: dark)';
        return {
          matches: false, // 默认系统为浅色主题
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        };
      }),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should follow system theme when mode is system', () => {
    // 设置初始主题为 light
    mockStore.theme = 'light';
    const { result, rerender } = renderHook(() => useTheme());
    
    expect(result.current.themeMode).toBe('light');
    expect(result.current.appliedTheme).toBe('light');
    
    // 切换到 system 模式
    act(() => {
      mockStore.theme = 'system';
      rerender();
    });
    
    expect(result.current.themeMode).toBe('system');
    expect(result.current.appliedTheme).toBe('light'); // 系统检测为 light
  });

  it('should update when system theme changes', async () => {
    // Mock 系统为暗色主题
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation(query => {
        const isDarkMode = query === '(prefers-color-scheme: dark)';
        return {
          matches: isDarkMode, // 系统为暗色主题
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        };
      }),
    });

    mockStore.theme = 'system';
    const { result } = renderHook(() => useTheme());
    
    expect(result.current.themeMode).toBe('system');
    expect(result.current.appliedTheme).toBe('dark'); // 系统检测为 dark
  });

  it('should update appliedTheme when switching from non-system to system', () => {
    // Mock 系统为暗色主题
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation(query => {
        const isDarkMode = query === '(prefers-color-scheme: dark)';
        return {
          matches: isDarkMode, // 系统为暗色主题  
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        };
      }),
    });

    // 开始为 light 模式
    mockStore.theme = 'light';
    const { result, rerender } = renderHook(() => useTheme());
    
    expect(result.current.appliedTheme).toBe('light');
    
    // 切换到 system 模式（系统为 dark）
    act(() => {
      mockStore.theme = 'system';
      rerender();
    });
    
    // 应该立即切换到系统的暗色主题
    expect(result.current.appliedTheme).toBe('dark');
  });
});
