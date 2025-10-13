/**
 * Store 数据迁移工具
 *
 * 从 localStorage 迁移数据到 TauriStore
 */

import { tauriStore } from '../store/tauriStore';

interface LocalStorageData {
  'app-settings'?: {
    state?: {
      theme?: 'light' | 'dark';
      language?: string;
    };
  };
  'app-stats'?: {
    state?: {
      cumulativeStats?: {
        total?: number;
        token_stats?: {
          total_tokens?: number;
          cost?: number;
        };
      };
    };
  };
  'app-storage'?: {
    // 旧的 useAppStore
    state?: {
      theme?: 'light' | 'dark';
      language?: string;
      cumulativeStats?: {
        total?: number;
        token_stats?: {
          total_tokens?: number;
          cost?: number;
        };
      };
    };
  };
}

/**
 * 从 localStorage 读取数据
 */
function getLocalStorageData(): LocalStorageData {
  const data: LocalStorageData = {};

  try {
    const settingsData = localStorage.getItem('app-settings');
    if (settingsData) {
      data['app-settings'] = JSON.parse(settingsData);
    }
  } catch (error) {
    console.warn('[Migration] 读取 app-settings 失败:', error);
  }

  try {
    const statsData = localStorage.getItem('app-stats');
    if (statsData) {
      data['app-stats'] = JSON.parse(statsData);
    }
  } catch (error) {
    console.warn('[Migration] 读取 app-stats 失败:', error);
  }

  try {
    const appData = localStorage.getItem('app-storage');
    if (appData) {
      data['app-storage'] = JSON.parse(appData);
    }
  } catch (error) {
    console.warn('[Migration] 读取 app-storage 失败:', error);
  }

  return data;
}

/**
 * 检查是否需要迁移
 */
export async function needsMigration(): Promise<boolean> {
  // 检查 localStorage 是否有数据
  const hasLocalStorage =
    localStorage.getItem('app-settings') !== null ||
    localStorage.getItem('app-stats') !== null ||
    localStorage.getItem('app-storage') !== null;

  if (!hasLocalStorage) {
    return false;
  }

  // 检查 TauriStore 是否已有数据
  try {
    await tauriStore.init();
    const hasTheme = await tauriStore.has('theme');

    // 如果 TauriStore 已有数据，不需要迁移
    if (hasTheme) {
      return false;
    }

    return true;
  } catch (error) {
    console.error('[Migration] 检查迁移状态失败:', error);
    return false;
  }
}

/**
 * 执行数据迁移
 */
export async function migrateToTauriStore(): Promise<{
  success: boolean;
  migratedKeys: string[];
  errors: string[];
}> {
  const migratedKeys: string[] = [];
  const errors: string[] = [];

  console.log('[Migration] 开始迁移数据...');

  try {
    // 初始化 TauriStore
    await tauriStore.init();

    // 读取 localStorage 数据
    const localData = getLocalStorageData();

    // 迁移主题
    const theme = localData['app-settings']?.state?.theme || localData['app-storage']?.state?.theme;

    if (theme) {
      try {
        await tauriStore.setTheme(theme);
        migratedKeys.push('theme');
        console.log('[Migration] 迁移主题:', theme);
      } catch (error) {
        errors.push(`主题迁移失败: ${error}`);
      }
    }

    // 迁移语言
    const language =
      localData['app-settings']?.state?.language || localData['app-storage']?.state?.language;

    if (language) {
      try {
        await tauriStore.setLanguage(language);
        migratedKeys.push('language');
        console.log('[Migration] 迁移语言:', language);
      } catch (error) {
        errors.push(`语言迁移失败: ${error}`);
      }
    }

    // 迁移累计统计
    const stats =
      localData['app-stats']?.state?.cumulativeStats ||
      localData['app-storage']?.state?.cumulativeStats;

    if (stats) {
      try {
        await tauriStore.updateCumulativeStats({
          totalTranslated: stats.total || 0,
          totalTokens: stats.token_stats?.total_tokens || 0,
          totalCost: stats.token_stats?.cost || 0,
          sessionCount: (stats.total ?? 0) > 0 ? 1 : 0,
          lastUpdated: Date.now(),
        });
        migratedKeys.push('cumulativeStats');
        console.log('[Migration] 迁移累计统计:', stats);
      } catch (error) {
        errors.push(`累计统计迁移失败: ${error}`);
      }
    }

    // 保存到磁盘
    await tauriStore.save();

    console.log(`[Migration] 迁移完成，成功: ${migratedKeys.length}, 失败: ${errors.length}`);

    return {
      success: errors.length === 0,
      migratedKeys,
      errors,
    };
  } catch (error) {
    console.error('[Migration] 迁移失败:', error);
    return {
      success: false,
      migratedKeys,
      errors: [...errors, `迁移失败: ${error}`],
    };
  }
}

/**
 * 清理 localStorage 数据（迁移成功后调用）
 */
export function cleanupLocalStorage(): void {
  console.log('[Migration] 清理旧的 localStorage 数据...');

  try {
    localStorage.removeItem('app-settings');
    localStorage.removeItem('app-stats');
    localStorage.removeItem('app-storage');
    console.log('[Migration] localStorage 清理完成');
  } catch (error) {
    console.error('[Migration] localStorage 清理失败:', error);
  }
}

/**
 * 自动迁移工作流
 *
 * 1. 检查是否需要迁移
 * 2. 执行迁移
 * 3. 清理旧数据
 */
export async function autoMigrate(): Promise<{
  migrated: boolean;
  result?: {
    success: boolean;
    migratedKeys: string[];
    errors: string[];
  };
}> {
  try {
    // 检查是否需要迁移
    const needs = await needsMigration();

    if (!needs) {
      console.log('[Migration] 不需要迁移');
      return { migrated: false };
    }

    console.log('[Migration] 检测到需要迁移数据');

    // 执行迁移
    const result = await migrateToTauriStore();

    // 如果迁移成功，清理旧数据
    if (result.success) {
      cleanupLocalStorage();

      // 标记迁移完成
      try {
        await tauriStore.set('preferences', {
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
        await tauriStore.save();
      } catch (error) {
        console.warn('[Migration] 保存迁移标记失败:', error);
      }
    }

    return {
      migrated: true,
      result,
    };
  } catch (error) {
    console.error('[Migration] 自动迁移失败:', error);
    return {
      migrated: false,
      result: {
        success: false,
        migratedKeys: [],
        errors: [`自动迁移失败: ${error}`],
      },
    };
  }
}
