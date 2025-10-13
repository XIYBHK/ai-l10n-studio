/**
 * TauriStore 测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { tauriStore } from '../../store/tauriStore';

// Mock @tauri-apps/plugin-store
vi.mock('@tauri-apps/plugin-store', () => {
  // Create an in-memory map to simulate the store's data
  const mockData = new Map<string, any>();

  // This object simulates an instance of the Store
  const storeInstance = {
    get: vi.fn(async (key: string) => mockData.get(key) ?? null),
    set: vi.fn(async (key: string, value: any) => {
      mockData.set(key, value);
    }),
    has: vi.fn(async (key: string) => mockData.has(key)),
    delete: vi.fn(async (key: string) => mockData.delete(key)),
    clear: vi.fn(async () => mockData.clear()),
    save: vi.fn(async () => {
      /* No-op for in-memory */
    }),
    entries: vi.fn(async () => Array.from(mockData.entries())),
    keys: vi.fn(async () => Array.from(mockData.keys())),
    values: vi.fn(async () => Array.from(mockData.values())),
    onKeyChange: vi.fn(() => Promise.resolve(() => {})),
    onChange: vi.fn(() => Promise.resolve(() => {})),
    get length() {
      return mockData.size;
    },
  };

  // This object simulates the static part of the Store class
  const MockStore = {
    load: vi.fn().mockResolvedValue(storeInstance),
  };

  // The module exports an object with a `Store` property
  return { Store: MockStore };
});

describe('TauriStore', () => {
  beforeEach(async () => {
    // 重置 store
    await tauriStore.init();
    await tauriStore.clear();
  });

  describe('基础操作', () => {
    it('应该能够设置和获取主题', async () => {
      await tauriStore.setTheme('dark');
      const theme = await tauriStore.getTheme();
      expect(theme).toBe('dark');
    });

    it('应该返回默认主题', async () => {
      const theme = await tauriStore.getTheme();
      expect(theme).toBe('light');
    });

    it('应该能够设置和获取语言', async () => {
      await tauriStore.setLanguage('en');
      const language = await tauriStore.getLanguage();
      expect(language).toBe('en');
    });

    it('应该返回默认语言', async () => {
      const language = await tauriStore.getLanguage();
      expect(language).toBe('zh');
    });
  });

  describe('累计统计', () => {
    it('应该能够获取默认统计', async () => {
      const stats = await tauriStore.getCumulativeStats();
      expect(stats).toEqual({
        totalTranslated: 0,
        totalTokens: 0,
        totalCost: 0,
        sessionCount: 0,
        lastUpdated: expect.any(Number),
        // 🔧 新增字段
        tmHits: 0,
        deduplicated: 0,
        aiTranslated: 0,
        tmLearned: 0,
        inputTokens: 0,
        outputTokens: 0,
      });
    });

    it('应该能够更新统计', async () => {
      await tauriStore.updateCumulativeStats({
        totalTranslated: 100,
        totalTokens: 1000,
        totalCost: 0.5,
        sessionCount: 1,
        lastUpdated: Date.now(),
      });

      const stats = await tauriStore.getCumulativeStats();
      expect(stats.totalTranslated).toBe(100);
      expect(stats.totalTokens).toBe(1000);
      expect(stats.totalCost).toBe(0.5);
    });
  });

  describe('最近文件', () => {
    it('应该能够添加最近文件', async () => {
      await tauriStore.addRecentFile('/path/to/file1.po');
      await tauriStore.addRecentFile('/path/to/file2.po');

      const files = await tauriStore.getRecentFiles();
      expect(files).toHaveLength(2);
      expect(files[0]).toBe('/path/to/file2.po'); // 最新的在前面
    });

    it('应该去重最近文件', async () => {
      await tauriStore.addRecentFile('/path/to/file.po');
      await tauriStore.addRecentFile('/path/to/file.po');

      const files = await tauriStore.getRecentFiles();
      expect(files).toHaveLength(1);
    });

    it('应该限制最近文件数量为10', async () => {
      for (let i = 0; i < 15; i++) {
        await tauriStore.addRecentFile(`/path/to/file${i}.po`);
      }

      const files = await tauriStore.getRecentFiles();
      expect(files).toHaveLength(10);
    });
  });

  describe('用户偏好', () => {
    it('应该能够获取默认偏好', async () => {
      const prefs = await tauriStore.getPreferences();
      expect(prefs).toEqual({
        autoSave: true,
        notifications: {
          enabled: true,
          onComplete: true,
          onError: true,
          onProgress: false,
        },
        editorFontSize: 14,
        showLineNumbers: true,
      });
    });

    it('应该能够更新偏好', async () => {
      await tauriStore.updatePreferences({
        autoSave: false,
        editorFontSize: 16,
      });

      const prefs = await tauriStore.getPreferences();
      expect(prefs.autoSave).toBe(false);
      expect(prefs.editorFontSize).toBe(16);
      expect(prefs.showLineNumbers).toBe(true); // 未改变
    });

    it('应该能够更新嵌套的通知设置', async () => {
      await tauriStore.updatePreferences({
        notifications: {
          enabled: false,
          onComplete: false,
          onError: false,
          onProgress: false,
        },
      });

      const prefs = await tauriStore.getPreferences();
      expect(prefs.notifications.enabled).toBe(false);
      expect(prefs.notifications.onComplete).toBe(false);
      expect(prefs.notifications.onError).toBe(true); // 未改变
    });
  });

  describe('翻译历史', () => {
    it('应该能够添加翻译历史', async () => {
      await tauriStore.addTranslationHistory({
        timestamp: Date.now(),
        source: 'Hello',
        target: '你好',
        provider: 'moonshot',
        tokenUsed: 10,
      });

      const history = await tauriStore.getTranslationHistory();
      expect(history).toHaveLength(1);
      expect(history[0].source).toBe('Hello');
    });

    it('应该限制历史记录数量', async () => {
      for (let i = 0; i < 150; i++) {
        await tauriStore.addTranslationHistory({
          timestamp: Date.now(),
          source: `Text ${i}`,
          target: `翻译 ${i}`,
          provider: 'moonshot',
          tokenUsed: 10,
        });
      }

      const history = await tauriStore.getTranslationHistory(20);
      expect(history.length).toBeLessThanOrEqual(20);
    });
  });

  describe('错误处理', () => {
    it('应该能够处理初始化错误', async () => {
      // 测试重复初始化
      await tauriStore.init();
      await tauriStore.init(); // 不应该抛出错误
    });

    it('应该能够处理获取不存在的键', async () => {
      const result = await tauriStore.get('nonexistent' as any);
      expect(result).toBeNull();
    });
  });
});
