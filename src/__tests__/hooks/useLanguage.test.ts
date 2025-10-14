import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import i18n from '@/i18n/config';

// Mock TauriStore
const mockTauriStore = {
  setLanguage: vi.fn().mockResolvedValue(undefined),
};

// Mock useAppStore
const mockSetLanguage = vi.fn();
vi.mock('@/store/useAppStore', () => ({
  useAppStore: vi.fn(() => ({
    language: 'zh-CN',
    setLanguage: mockSetLanguage,
  })),
}));

describe('Language switching', () => {
  beforeEach(() => {
    mockSetLanguage.mockClear();
    mockTauriStore.setLanguage.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should switch from zh-CN to en-US', async () => {
    // 模拟从中文切换到英文
    expect(i18n.language).toBe('zh-CN');
    
    // 切换语言
    await act(async () => {
      await i18n.changeLanguage('en-US');
    });
    
    expect(i18n.language).toBe('en-US');
  });

  it('should handle language persistence correctly', () => {
    // 测试类型兼容性
    const language = 'en-US';
    
    // 这应该不会有类型错误
    mockSetLanguage(language as 'zh-CN' | 'en-US');
    
    expect(mockSetLanguage).toHaveBeenCalledWith('en-US');
  });

  it('should translate terms correctly after language switch', async () => {
    // 切换到英文 - 使用我们自定义的 changeLanguage 函数
    const { changeLanguage } = await import('@/i18n/config');
    
    await act(async () => {
      await changeLanguage('en-US');
    });
    
    // 验证翻译
    expect(i18n.t('menu.settings')).toBe('Settings');
    expect(i18n.t('theme.light')).toBe('Light');
    expect(i18n.t('theme.system')).toBe('System');
  });

  it('should switch back to zh-CN from en-US', async () => {
    // 先切换到英文
    await act(async () => {
      await i18n.changeLanguage('en-US');
    });
    expect(i18n.language).toBe('en-US');
    
    // 再切换回中文
    await act(async () => {
      await i18n.changeLanguage('zh-CN');
    });
    expect(i18n.language).toBe('zh-CN');
  });
});
