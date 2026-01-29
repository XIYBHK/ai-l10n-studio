/**
 * Tauri Store 管理器
 *
 * 提供类型安全的持久化存储，替代 localStorage
 */

import { Store } from '@tauri-apps/plugin-store';

const isTauriRuntime =
  typeof window !== 'undefined' && typeof (window as any).__TAURI__?.invoke === 'function';

/**
 * Store 数据类型定义
 */
export interface AppStoreData {
  // 应用设置
  theme: 'light' | 'dark' | 'system';
  language: string;

  // 累计统计
  cumulativeStats: {
    totalTranslated: number;
    totalTokens: number;
    totalCost: number;
    sessionCount: number;
    lastUpdated: number;
    tmHits: number;
    deduplicated: number;
    aiTranslated: number;
    tmLearned: number;
    inputTokens: number;
    outputTokens: number;
  };

  // 最近文件列表
  recentFiles: string[];

  // 用户偏好
  preferences: {
    autoSave: boolean;
    notifications: {
      enabled: boolean;
      onComplete: boolean;
      onError: boolean;
      onProgress: boolean;
    };
    editorFontSize: number;
    showLineNumbers: boolean;
  };

  // 翻译历史
  translationHistory: Array<{
    timestamp: number;
    source: string;
    target: string;
    provider: string;
    tokenUsed: number;
  }>;

  // 窗口状态
  windowState: {
    width: number;
    height: number;
    x?: number;
    y?: number;
    maximized: boolean;
  };
}

export type StoreKey = keyof AppStoreData;

/**
 * TauriStore 管理类
 */
class TauriStore {
  private store: Store | null = null;
  private initialized = false;
  private initPromise: Promise<void> | null = null;
  private memoryStore = new Map<StoreKey, unknown>();

  async init(): Promise<void> {
    if (this.initialized) return;

    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      try {
        console.log('[TauriStore] 初始化...');
        if (!isTauriRuntime) {
          this.initialized = true;
          console.log('[TauriStore] 非 Tauri 环境，使用内存存储');
          return;
        }
        this.store = await Store.load('app-settings.json');
        this.initialized = true;
        console.log('[TauriStore] 初始化成功');
      } catch (error) {
        console.error('[TauriStore] 初始化失败:', error);
        throw error;
      }
    })();

    return this.initPromise;
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.init();
    }

    if (isTauriRuntime && !this.store) {
      throw new Error('Store 未初始化');
    }
  }

  async get<K extends StoreKey>(key: K): Promise<AppStoreData[K] | null> {
    try {
      await this.ensureInitialized();
      if (!isTauriRuntime) {
        return (this.memoryStore.get(key) as AppStoreData[K] | undefined) ?? null;
      }
      const value = await this.store!.get<AppStoreData[K]>(key);
      console.log(`[TauriStore] 获取 ${key}:`, value);
      return value ?? null;
    } catch (error) {
      console.error(`[TauriStore] 获取 ${key} 失败:`, error);
      return null;
    }
  }

  async set<K extends StoreKey>(key: K, value: AppStoreData[K]): Promise<void> {
    try {
      await this.ensureInitialized();
      if (!isTauriRuntime) {
        this.memoryStore.set(key, value);
        return;
      }
      await this.store!.set(key, value);
      console.log(`[TauriStore] 设置 ${key}:`, value);
    } catch (error) {
      console.error(`[TauriStore] 设置 ${key} 失败:`, error);
      throw error;
    }
  }

  async has(key: StoreKey): Promise<boolean> {
    try {
      await this.ensureInitialized();
      if (!isTauriRuntime) {
        return this.memoryStore.has(key);
      }
      return await this.store!.has(key);
    } catch (error) {
      console.error(`[TauriStore] 检查 ${key} 失败:`, error);
      return false;
    }
  }

  async delete(key: StoreKey): Promise<void> {
    try {
      await this.ensureInitialized();
      if (!isTauriRuntime) {
        this.memoryStore.delete(key);
        return;
      }
      await this.store!.delete(key);
      console.log(`[TauriStore] 删除 ${key}`);
    } catch (error) {
      console.error(`[TauriStore] 删除 ${key} 失败:`, error);
      throw error;
    }
  }

  async clear(): Promise<void> {
    try {
      await this.ensureInitialized();
      if (!isTauriRuntime) {
        this.memoryStore.clear();
        return;
      }
      await this.store!.clear();
      console.log('[TauriStore] 清空所有数据');
    } catch (error) {
      console.error('[TauriStore] 清空失败:', error);
      throw error;
    }
  }

  async save(): Promise<void> {
    try {
      await this.ensureInitialized();
      if (!isTauriRuntime) return;
      await this.store!.save();
      console.log('[TauriStore] 保存成功');
    } catch (error) {
      console.error('[TauriStore] 保存失败:', error);
      throw error;
    }
  }

  async keys(): Promise<string[]> {
    try {
      await this.ensureInitialized();
      if (!isTauriRuntime) {
        return Array.from(this.memoryStore.keys());
      }
      return await this.store!.keys();
    } catch (error) {
      console.error('[TauriStore] 获取键列表失败:', error);
      return [];
    }
  }

  async values(): Promise<unknown[]> {
    try {
      await this.ensureInitialized();
      if (!isTauriRuntime) {
        return Array.from(this.memoryStore.values());
      }
      return await this.store!.values();
    } catch (error) {
      console.error('[TauriStore] 获取值列表失败:', error);
      return [];
    }
  }

  async length(): Promise<number> {
    try {
      await this.ensureInitialized();
      if (!isTauriRuntime) {
        return this.memoryStore.size;
      }
      return await this.store!.length();
    } catch (error) {
      console.error('[TauriStore] 获取长度失败:', error);
      return 0;
    }
  }

  // ========== 便捷方法 ==========

  async getTheme(): Promise<'light' | 'dark' | 'system'> {
    const theme = await this.get('theme');
    return theme ?? 'system';
  }

  async setTheme(theme: 'light' | 'dark' | 'system'): Promise<void> {
    await this.set('theme', theme);
    await this.save();
  }

  async getLanguage(): Promise<string> {
    const lang = await this.get('language');
    return lang ?? 'zh';
  }

  async setLanguage(language: string): Promise<void> {
    await this.set('language', language);
    await this.save();
  }

  async getCumulativeStats(): Promise<AppStoreData['cumulativeStats']> {
    const stats = await this.get('cumulativeStats');
    return (
      stats ?? {
        totalTranslated: 0,
        totalTokens: 0,
        totalCost: 0,
        sessionCount: 0,
        lastUpdated: Date.now(),
        tmHits: 0,
        deduplicated: 0,
        aiTranslated: 0,
        tmLearned: 0,
        inputTokens: 0,
        outputTokens: 0,
      }
    );
  }

  async updateCumulativeStats(updates: Partial<AppStoreData['cumulativeStats']>): Promise<void> {
    const currentStats = await this.getCumulativeStats();
    const newStats = {
      ...currentStats,
      ...updates,
      lastUpdated: Date.now(),
    };
    await this.set('cumulativeStats', newStats);
    await this.save();
  }

  async getRecentFiles(): Promise<string[]> {
    const files = await this.get('recentFiles');
    return files ?? [];
  }

  async addRecentFile(filePath: string): Promise<void> {
    const recentFiles = await this.getRecentFiles();
    const updated = [filePath, ...recentFiles.filter((f) => f !== filePath)].slice(0, 10);
    await this.set('recentFiles', updated);
    await this.save();
  }

  async getPreferences(): Promise<AppStoreData['preferences']> {
    const prefs = await this.get('preferences');
    return (
      prefs ?? {
        autoSave: true,
        notifications: {
          enabled: true,
          onComplete: true,
          onError: true,
          onProgress: false,
        },
        editorFontSize: 14,
        showLineNumbers: true,
      }
    );
  }

  async updatePreferences(updates: Partial<AppStoreData['preferences']>): Promise<void> {
    const currentPrefs = await this.getPreferences();
    const newPrefs = {
      ...currentPrefs,
      ...updates,
      notifications: {
        ...currentPrefs.notifications,
        ...(updates.notifications || {}),
      },
    };
    await this.set('preferences', newPrefs);
    await this.save();
  }

  async addTranslationHistory(entry: AppStoreData['translationHistory'][0]): Promise<void> {
    const history = (await this.get('translationHistory')) ?? [];
    const updated = [entry, ...history].slice(0, 100);
    await this.set('translationHistory', updated);
    await this.save();
  }

  async getTranslationHistory(limit = 20): Promise<AppStoreData['translationHistory']> {
    const history = await this.get('translationHistory');
    return (history ?? []).slice(0, limit);
  }

  async saveWindowState(state: AppStoreData['windowState']): Promise<void> {
    await this.set('windowState', state);
    await this.save();
  }

  async getWindowState(): Promise<AppStoreData['windowState'] | null> {
    return await this.get('windowState');
  }
}

export const tauriStore = new TauriStore();

export default tauriStore;
