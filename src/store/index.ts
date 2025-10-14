/**
 * Store 模块统一导出
 *
 * 优化后的架构（2025-10-14）：
 * - useAppStore: 主要应用状态管理（主题、语言、文件状态、配置等）
 * - useSessionStore: 会话状态（条目、翻译状态等）
 * - useStatsStore: 累计统计（持久化）
 * - tauriStore: 底层持久化存储抽象
 */

// 直接导入加载函数，避免循环依赖问题
import { loadPersistedState } from './useAppStore';
import { loadStats } from './useStatsStore';

export { useAppStore } from './useAppStore'; // 主要应用状态管理
export { useSessionStore } from './useSessionStore';
export { useStatsStore } from './useStatsStore';
export { tauriStore } from './tauriStore';

/**
 * 初始化所有持久化状态
 * 应该在应用启动时调用
 */
export async function initializeStores() {
  console.log('[Store] 初始化所有 Store...');

  try {
    // 并行加载所有持久化状态
    await Promise.all([loadPersistedState(), loadStats()]);

    console.log('[Store] 所有 Store 初始化成功');
  } catch (error) {
    console.error('[Store] Store 初始化失败:', error);
    throw error;
  }
}

/**
 * ✅ 架构优化完成（2025-10-14）
 *
 * 设计原则：
 * - 不向后兼容，只使用最优设计模式
 * - useAppStore 作为单一主要状态源
 * - 清晰的关注点分离
 * - 统一的持久化机制
 * - 类型安全的状态管理
 *
 * 已优化的组件：
 * ✅ App.tsx - 使用 useAppStore
 * ✅ EntryList.tsx - 使用 useSessionStore
 * ✅ EditorPane.tsx - 使用 useSessionStore  
 * ✅ AIWorkspace.tsx - 使用 useSessionStore
 * ✅ useTheme.ts - 基于 useAppStore 的主题管理
 * ✅ SettingsModal.tsx - 使用统一命令层和 AppDataProvider
 *
 * 架构优势：
 * ✅ 单一状态源，避免重复
 * ✅ 统一的参数转换机制
 * ✅ 自动化的本地日志存储
 * ✅ 系统性的主题管理
 * ✅ 更好的类型安全和维护性
 */