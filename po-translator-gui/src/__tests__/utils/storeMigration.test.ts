/**
 * Store 迁移工具测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { needsMigration, migrateToTauriStore, cleanupLocalStorage } from '../../utils/storeMigration';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    get length() {
      return Object.keys(store).length;
    },
    key: (index: number) => {
      const keys = Object.keys(store);
      return keys[index] || null;
    },
  };
})();

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

// Mock TauriStore
vi.mock('../../store/tauriStore', () => {
  const mockData = new Map<string, any>();
  
  return {
    tauriStore: {
      init: vi.fn().mockResolvedValue(undefined),
      has: vi.fn().mockImplementation((key: string) => {
        return Promise.resolve(mockData.has(key));
      }),
      setTheme: vi.fn().mockImplementation((theme: string) => {
        mockData.set('theme', theme);
        return Promise.resolve();
      }),
      setLanguage: vi.fn().mockImplementation((lang: string) => {
        mockData.set('language', lang);
        return Promise.resolve();
      }),
      updateCumulativeStats: vi.fn().mockImplementation((stats: any) => {
        mockData.set('cumulativeStats', stats);
        return Promise.resolve();
      }),
      save: vi.fn().mockResolvedValue(undefined),
      set: vi.fn().mockImplementation((key: string, value: any) => {
        mockData.set(key, value);
        return Promise.resolve();
      }),
      clear: () => {
        mockData.clear();
      },
    },
  };
});

describe('Store 迁移工具', () => {
  beforeEach(() => {
    // 清空 localStorage
    localStorage.clear();
    
    // 重置 mock
    vi.clearAllMocks();
  });

  describe('needsMigration', () => {
    it('当没有 localStorage 数据时应该返回 false', async () => {
      const needs = await needsMigration();
      expect(needs).toBe(false);
    });

    it('当有 localStorage 数据但 TauriStore 已有数据时应该返回 false', async () => {
      localStorage.setItem('app-settings', JSON.stringify({
        state: { theme: 'dark' }
      }));

      const { tauriStore } = await import('../../store/tauriStore');
      vi.mocked(tauriStore.has).mockResolvedValue(true);

      const needs = await needsMigration();
      expect(needs).toBe(false);
    });

    it('当有 localStorage 数据且 TauriStore 无数据时应该返回 true', async () => {
      localStorage.setItem('app-settings', JSON.stringify({
        state: { theme: 'dark' }
      }));

      const { tauriStore } = await import('../../store/tauriStore');
      vi.mocked(tauriStore.has).mockResolvedValue(false);

      const needs = await needsMigration();
      expect(needs).toBe(true);
    });
  });

  describe('migrateToTauriStore', () => {
    it('应该能够迁移主题设置', async () => {
      localStorage.setItem('app-settings', JSON.stringify({
        state: { theme: 'dark', language: 'en' }
      }));

      const result = await migrateToTauriStore();

      expect(result.success).toBe(true);
      expect(result.migratedKeys).toContain('theme');
      expect(result.migratedKeys).toContain('language');
    });

    it('应该能够迁移累计统计', async () => {
      localStorage.setItem('app-stats', JSON.stringify({
        state: {
          cumulativeStats: {
            total: 100,
            token_stats: {
              total_tokens: 1000,
              cost: 0.5
            }
          }
        }
      }));

      const result = await migrateToTauriStore();

      expect(result.success).toBe(true);
      expect(result.migratedKeys).toContain('cumulativeStats');
    });

    it('应该能够从旧的 app-storage 迁移', async () => {
      localStorage.setItem('app-storage', JSON.stringify({
        state: {
          theme: 'dark',
          language: 'zh-CN',
          cumulativeStats: {
            total: 50,
            token_stats: {
              total_tokens: 500,
              cost: 0.25
            }
          }
        }
      }));

      const result = await migrateToTauriStore();

      expect(result.success).toBe(true);
      expect(result.migratedKeys).toHaveLength(3);
    });

    it('应该处理部分迁移失败', async () => {
      localStorage.setItem('app-settings', JSON.stringify({
        state: { theme: 'dark' }
      }));

      const { tauriStore } = await import('../../store/tauriStore');
      vi.mocked(tauriStore.setTheme).mockRejectedValueOnce(new Error('保存失败'));

      const result = await migrateToTauriStore();

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('cleanupLocalStorage', () => {
    it('应该清理所有相关的 localStorage 数据', () => {
      localStorage.setItem('app-settings', 'test');
      localStorage.setItem('app-stats', 'test');
      localStorage.setItem('app-storage', 'test');
      localStorage.setItem('other-data', 'test');

      cleanupLocalStorage();

      expect(localStorage.getItem('app-settings')).toBeNull();
      expect(localStorage.getItem('app-stats')).toBeNull();
      expect(localStorage.getItem('app-storage')).toBeNull();
      expect(localStorage.getItem('other-data')).toBe('test'); // 不应该被删除
    });
  });
});

