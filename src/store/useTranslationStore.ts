/**
 * 翻译状态管理（会话临时）
 *
 * 优化点：
 * 1. 添加了原子化 selectors，避免不必要的重渲染
 * 2. 使用 Map 维护索引映射，O(1) 查找
 * 3. 使用 Slices Pattern 组织代码
 *
 * 职责：
 * - 管理 PO 条目列表（entries）
 * - 管理当前选中条目（currentEntry）
 * - 提供条目操作方法
 * - 通过 entryIndexMap 实现 O(1) 索引查找
 *
 * 注意：此 Store 的状态不持久化，应用关闭后清空
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { POEntry } from '../types/tauri';
import { createModuleLogger } from '../utils/logger';

const log = createModuleLogger('useTranslationStore');

// ============================================
// State & Actions 定义
// ============================================
interface TranslationState {
  // 条目状态
  entries: POEntry[];
  entryIndexMap: Map<POEntry, number>; // O(1) 索引映射
  currentEntry: POEntry | null;
  currentIndex: number;

  // 文件路径
  currentFilePath: string | null;

  // Actions - 条目管理
  setEntries: (entries: POEntry[]) => void;
  setCurrentEntry: (entry: POEntry | null) => void;
  setCurrentIndex: (index: number) => void;
  updateEntry: (index: number, updates: Partial<POEntry>) => void;
  setCurrentFilePath: (path: string | null) => void;

  // Actions - 高效索引查找
  getEntryIndex: (entry: POEntry) => number;

  // Actions - 导航
  nextEntry: () => void;
  previousEntry: () => void;

  // Actions - 重置
  reset: () => void;
}

// 初始状态
const initialState = {
  entries: [],
  entryIndexMap: new Map<POEntry, number>(),
  currentEntry: null,
  currentIndex: -1,
  currentFilePath: null,
};

// ============================================
// Store 创建
// ============================================
export const useTranslationStore = create<TranslationState>()(
  devtools(
    (set, get) => ({
      ...initialState,

      // 设置条目列表
      setEntries: (entries) => {
        log.info('设置条目列表', { count: entries.length });

        // 构建索引映射 Map
        const entryIndexMap = new Map<POEntry, number>();
        entries.forEach((entry, index) => {
          entryIndexMap.set(entry, index);
        });

        set({
          entries,
          entryIndexMap,
          currentEntry: entries.length > 0 ? entries[0] : null,
          currentIndex: entries.length > 0 ? 0 : -1,
        });
      },

      // 设置当前条目
      setCurrentEntry: (entry) => {
        const { entryIndexMap } = get();
        const index = entry ? (entryIndexMap.get(entry) ?? -1) : -1;
        log.debug('设置当前条目', { index, msgid: entry?.msgid });
        set({ currentEntry: entry, currentIndex: index });
      },

      // 设置当前索引
      setCurrentIndex: (index) => {
        const { entries } = get();
        if (index >= 0 && index < entries.length) {
          log.debug('设置当前索引', { index, total: entries.length });
          set({
            currentIndex: index,
            currentEntry: entries[index],
          });
        }
      },

      // 更新条目
      updateEntry: (index, updates) => {
        const { entries, currentIndex, entryIndexMap } = get();
        if (index >= 0 && index < entries.length) {
          const newEntries = [...entries];
          newEntries[index] = { ...newEntries[index], ...updates };

          // 重新构建索引映射（仅当条目引用变化时）
          const newEntryIndexMap = new Map(entryIndexMap);
          newEntryIndexMap.set(newEntries[index], index);

          set({ entries: newEntries, entryIndexMap: newEntryIndexMap });

          // 如果更新的是当前条目，也要更新 currentEntry
          if (index === currentIndex) {
            set({ currentEntry: newEntries[index] });
          }
          log.debug('更新条目', { index, updates });
        }
      },

      // 设置当前文件路径
      setCurrentFilePath: (path) => {
        log.info('设置文件路径', { path });
        set({ currentFilePath: path });
      },

      // O(1) 获取条目索引
      getEntryIndex: (entry) => {
        const { entryIndexMap } = get();
        return entryIndexMap.get(entry) ?? -1;
      },

      // 下一个条目
      nextEntry: () => {
        const { currentIndex, entries } = get();
        if (currentIndex < entries.length - 1) {
          const newIndex = currentIndex + 1;
          set({
            currentIndex: newIndex,
            currentEntry: entries[newIndex],
          });
          log.debug('移动到下一个条目', { index: newIndex });
        }
      },

      // 上一个条目
      previousEntry: () => {
        const { currentIndex, entries } = get();
        if (currentIndex > 0) {
          const newIndex = currentIndex - 1;
          set({
            currentIndex: newIndex,
            currentEntry: entries[newIndex],
          });
          log.debug('移动到上一个条目', { index: newIndex });
        }
      },

      // 重置所有状态
      reset: () => {
        log.info('重置翻译状态');
        set(initialState);
      },
    }),
    { name: 'TranslationStore' }
  )
);

// ============================================
// 原子化 Selectors（Zustand 最佳实践）
// 使用这些 selectors 可以避免不必要重渲染
// ============================================

// 基础状态 Selectors
export const selectEntries = (state: TranslationState) => state.entries;
export const selectCurrentEntry = (state: TranslationState) => state.currentEntry;
export const selectCurrentIndex = (state: TranslationState) => state.currentIndex;
export const selectCurrentFilePath = (state: TranslationState) => state.currentFilePath;

// Actions Selectors
export const selectSetEntries = (state: TranslationState) => state.setEntries;
export const selectSetCurrentEntry = (state: TranslationState) => state.setCurrentEntry;
export const selectUpdateEntry = (state: TranslationState) => state.updateEntry;
export const selectSetCurrentFilePath = (state: TranslationState) => state.setCurrentFilePath;
export const selectGetEntryIndex = (state: TranslationState) => state.getEntryIndex;
export const selectNextEntry = (state: TranslationState) => state.nextEntry;
export const selectPreviousEntry = (state: TranslationState) => state.previousEntry;
export const selectReset = (state: TranslationState) => state.reset;

// 派生状态 Selectors
export const selectEntryCount = (state: TranslationState) => state.entries.length;
export const selectHasEntries = (state: TranslationState) => state.entries.length > 0;
export const selectIsFirstEntry = (state: TranslationState) => state.currentIndex === 0;
export const selectIsLastEntry = (state: TranslationState) =>
  state.currentIndex === state.entries.length - 1;

// 便捷 Hooks（推荐在组件中使用）
export const useEntries = () => useTranslationStore(selectEntries);
export const useCurrentEntry = () => useTranslationStore(selectCurrentEntry);
export const useCurrentIndex = () => useTranslationStore(selectCurrentIndex);
export const useCurrentFilePath = () => useTranslationStore(selectCurrentFilePath);
export const useEntryCount = () => useTranslationStore(selectEntryCount);
export const useHasEntries = () => useTranslationStore(selectHasEntries);

// Actions Hooks
export const useSetEntries = () => useTranslationStore(selectSetEntries);
export const useSetCurrentEntry = () => useTranslationStore(selectSetCurrentEntry);
export const useSetCurrentFilePath = () => useTranslationStore(selectSetCurrentFilePath);
export const useUpdateEntry = () => useTranslationStore(selectUpdateEntry);
export const useGetEntryIndex = () => useTranslationStore(selectGetEntryIndex);
