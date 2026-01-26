/**
 * Store 模块统一导出
 *
 * 架构：
 * - useAppStore: 应用级配置（主题、语言、累计统计）
 * - useTranslationStore: 翻译状态（条目、当前条目、文件路径）
 * - useSessionStore: 会话状态（翻译进度、会话统计）
 * - useStatsStore: 累计统计（持久化）
 * - tauriStore: 底层持久化存储
 */

import { loadPersistedState } from './useAppStore';
import { loadStats } from './useStatsStore';

export { useAppStore } from './useAppStore';
export { useTranslationStore } from './useTranslationStore';
export { useSessionStore } from './useSessionStore';
export { useStatsStore } from './useStatsStore';
export { tauriStore } from './tauriStore';

/**
 * 初始化所有持久化状态
 * 应在应用启动时调用
 */
export async function initializeStores() {
  console.log('[Store] 初始化所有 Store...');

  try {
    await Promise.all([loadPersistedState(), loadStats()]);
    console.log('[Store] 所有 Store 初始化成功');
  } catch (error) {
    console.error('[Store] Store 初始化失败:', error);
    throw error;
  }
}
