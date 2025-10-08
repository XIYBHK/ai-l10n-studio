/**
 * 状态管理统一导出
 * 
 * 新架构：分离瞬态和持久化状态
 * - useSessionStore: 会话状态（不持久化）
 * - useSettingsStore: 用户设置（持久化）
 * - useStatsStore: 累计统计（持久化）
 * 
 * 旧架构（向后兼容）：
 * - useAppStore: 所有状态混合
 */

// 直接导入加载函数，避免循环依赖问题
import { loadSettings } from './useSettingsStore';
import { loadStats } from './useStatsStore';

export { useSessionStore } from './useSessionStore';
export { useSettingsStore } from './useSettingsStore';
export { useStatsStore } from './useStatsStore';
export { tauriStore } from './tauriStore';
// useAppStore 已废弃，所有组件已迁移到新 Stores
// export { useAppStore } from './useAppStore';

/**
 * 初始化所有持久化状态
 * 应该在应用启动时调用
 */
export async function initializeStores() {
  console.log('[Store] 初始化所有 Store...');
  
  try {
    // 并行加载所有持久化状态
    await Promise.all([
      loadSettings(),
      loadStats(),
    ]);
    
    console.log('[Store] 所有 Store 初始化成功');
  } catch (error) {
    console.error('[Store] Store 初始化失败:', error);
    throw error;
  }
}

/**
 * ✅ 迁移完成（2025-10-08）
 * 
 * 所有组件已迁移到新的 Store 架构：
 * - useSessionStore: 会话状态（entries, currentEntry, isTranslating 等）
 * - useSettingsStore: 用户设置（theme, language）
 * - useStatsStore: 累计统计（cumulativeStats）
 * 
 * 已迁移的组件：
 * ✅ App.tsx
 * ✅ EntryList.tsx
 * ✅ EditorPane.tsx
 * ✅ AIWorkspace.tsx
 * ✅ useTheme.ts
 * 
 * 性能优势：
 * ✅ 减少不必要的持久化开销
 * ✅ 更清晰的关注点分离
 * ✅ 更容易测试和维护
 */

