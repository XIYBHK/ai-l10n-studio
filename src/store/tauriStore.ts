/**
 * Tauri Store 管理器
 * 
 * 提供类型安全的持久化存储，替代 localStorage
 * 
 * 特性：
 * - 类型安全
 * - 自动持久化
 * - 错误处理
 * - 性能优化
 */

import { Store } from '@tauri-apps/plugin-store';

/**
 * Store 数据类型定义
 */
export interface AppStoreData {
  // 应用设置
  theme: 'light' | 'dark';
  language: string;
  
  // 累计统计
  cumulativeStats: {
    totalTranslated: number;
    totalTokens: number;
    totalCost: number;
    sessionCount: number;
    lastUpdated: number;
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

/**
 * Store 键类型
 */
export type StoreKey = keyof AppStoreData;

/**
 * TauriStore 管理类
 */
class TauriStore {
  private store: Store | null = null;
  private initialized = false;
  private initPromise: Promise<void> | null = null;

  /**
   * 初始化 Store
   */
  async init(): Promise<void> {
    // 避免重复初始化
    if (this.initialized) return;
    
    // 如果正在初始化，返回现有的 Promise
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      try {
        console.log('[TauriStore] 初始化...');
        
        // Tauri v2: 使用静态方法 Store.load() 加载或创建 Store
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

  /**
   * 确保 Store 已初始化
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.init();
    }
    
    if (!this.store) {
      throw new Error('Store 未初始化');
    }
  }

  /**
   * 获取值
   */
  async get<K extends StoreKey>(key: K): Promise<AppStoreData[K] | null> {
    try {
      await this.ensureInitialized();
      const value = await this.store!.get<AppStoreData[K]>(key);
      console.log(`[TauriStore] 获取 ${key}:`, value);
      return value;
    } catch (error) {
      console.error(`[TauriStore] 获取 ${key} 失败:`, error);
      return null;
    }
  }

  /**
   * 设置值
   */
  async set<K extends StoreKey>(key: K, value: AppStoreData[K]): Promise<void> {
    try {
      await this.ensureInitialized();
      await this.store!.set(key, value);
      console.log(`[TauriStore] 设置 ${key}:`, value);
    } catch (error) {
      console.error(`[TauriStore] 设置 ${key} 失败:`, error);
      throw error;
    }
  }

  /**
   * 检查键是否存在
   */
  async has(key: StoreKey): Promise<boolean> {
    try {
      await this.ensureInitialized();
      return await this.store!.has(key);
    } catch (error) {
      console.error(`[TauriStore] 检查 ${key} 失败:`, error);
      return false;
    }
  }

  /**
   * 删除键
   */
  async delete(key: StoreKey): Promise<void> {
    try {
      await this.ensureInitialized();
      await this.store!.delete(key);
      console.log(`[TauriStore] 删除 ${key}`);
    } catch (error) {
      console.error(`[TauriStore] 删除 ${key} 失败:`, error);
      throw error;
    }
  }

  /**
   * 清空所有数据
   */
  async clear(): Promise<void> {
    try {
      await this.ensureInitialized();
      await this.store!.clear();
      console.log('[TauriStore] 清空所有数据');
    } catch (error) {
      console.error('[TauriStore] 清空失败:', error);
      throw error;
    }
  }

  /**
   * 保存到磁盘
   */
  async save(): Promise<void> {
    try {
      await this.ensureInitialized();
      await this.store!.save();
      console.log('[TauriStore] 保存成功');
    } catch (error) {
      console.error('[TauriStore] 保存失败:', error);
      throw error;
    }
  }

  /**
   * 获取所有键
   */
  async keys(): Promise<string[]> {
    try {
      await this.ensureInitialized();
      return await this.store!.keys();
    } catch (error) {
      console.error('[TauriStore] 获取键列表失败:', error);
      return [];
    }
  }

  /**
   * 获取所有值
   */
  async values(): Promise<unknown[]> {
    try {
      await this.ensureInitialized();
      return await this.store!.values();
    } catch (error) {
      console.error('[TauriStore] 获取值列表失败:', error);
      return [];
    }
  }

  /**
   * 获取条目数量
   */
  async length(): Promise<number> {
    try {
      await this.ensureInitialized();
      return await this.store!.length();
    } catch (error) {
      console.error('[TauriStore] 获取长度失败:', error);
      return 0;
    }
  }

  // ========== 便捷方法 ==========

  /**
   * 获取主题
   */
  async getTheme(): Promise<'light' | 'dark'> {
    const theme = await this.get('theme');
    return theme ?? 'light';
  }

  /**
   * 设置主题
   */
  async setTheme(theme: 'light' | 'dark'): Promise<void> {
    await this.set('theme', theme);
    await this.save();
  }

  /**
   * 获取语言
   */
  async getLanguage(): Promise<string> {
    const lang = await this.get('language');
    return lang ?? 'zh';
  }

  /**
   * 设置语言
   */
  async setLanguage(language: string): Promise<void> {
    await this.set('language', language);
    await this.save();
  }

  /**
   * 获取累计统计
   */
  async getCumulativeStats(): Promise<AppStoreData['cumulativeStats']> {
    const stats = await this.get('cumulativeStats');
    return stats ?? {
      totalTranslated: 0,
      totalTokens: 0,
      totalCost: 0,
      sessionCount: 0,
      lastUpdated: Date.now(),
    };
  }

  /**
   * 更新累计统计
   */
  async updateCumulativeStats(
    updates: Partial<AppStoreData['cumulativeStats']>
  ): Promise<void> {
    const currentStats = await this.getCumulativeStats();
    const newStats = {
      ...currentStats,
      ...updates,
      lastUpdated: Date.now(),
    };
    await this.set('cumulativeStats', newStats);
    await this.save();
  }

  /**
   * 获取最近文件列表
   */
  async getRecentFiles(): Promise<string[]> {
    const files = await this.get('recentFiles');
    return files ?? [];
  }

  /**
   * 添加最近文件
   */
  async addRecentFile(filePath: string): Promise<void> {
    const recentFiles = await this.getRecentFiles();
    
    // 去重并添加到开头
    const updated = [
      filePath,
      ...recentFiles.filter(f => f !== filePath)
    ].slice(0, 10); // 最多保留 10 个
    
    await this.set('recentFiles', updated);
    await this.save();
  }

  /**
   * 获取用户偏好
   */
  async getPreferences(): Promise<AppStoreData['preferences']> {
    const prefs = await this.get('preferences');
    return prefs ?? {
      autoSave: true,
      notifications: {
        enabled: true,
        onComplete: true,
        onError: true,
        onProgress: false,
      },
      editorFontSize: 14,
      showLineNumbers: true,
    };
  }

  /**
   * 更新用户偏好
   */
  async updatePreferences(
    updates: Partial<AppStoreData['preferences']>
  ): Promise<void> {
    const currentPrefs = await this.getPreferences();
    const newPrefs = {
      ...currentPrefs,
      ...updates,
      // 合并嵌套的 notifications 对象
      notifications: {
        ...currentPrefs.notifications,
        ...(updates.notifications || {}),
      },
    };
    await this.set('preferences', newPrefs);
    await this.save();
  }

  /**
   * 添加翻译历史记录
   */
  async addTranslationHistory(entry: AppStoreData['translationHistory'][0]): Promise<void> {
    const history = await this.get('translationHistory') ?? [];
    
    // 最多保留 100 条记录
    const updated = [entry, ...history].slice(0, 100);
    
    await this.set('translationHistory', updated);
    await this.save();
  }

  /**
   * 获取翻译历史
   */
  async getTranslationHistory(limit = 20): Promise<AppStoreData['translationHistory']> {
    const history = await this.get('translationHistory');
    return (history ?? []).slice(0, limit);
  }

  /**
   * 保存窗口状态
   */
  async saveWindowState(state: AppStoreData['windowState']): Promise<void> {
    await this.set('windowState', state);
    await this.save();
  }

  /**
   * 获取窗口状态
   */
  async getWindowState(): Promise<AppStoreData['windowState'] | null> {
    return await this.get('windowState');
  }
}

// 导出单例
export const tauriStore = new TauriStore();

// 默认导出
export default tauriStore;

