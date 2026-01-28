/**
 * 翻译状态管理（会话临时）
 *
 * 职责：
 * - 管理 PO 条目列表（entries）
 * - 管理当前选中条目（currentEntry）
 * - 管理当前索引（currentIndex）
 * - 提供条目操作方法
 *
 * 注意：此 Store 的状态不持久化，应用关闭后清空
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { POEntry } from '../types/tauri';
import { createModuleLogger } from '../utils/logger';

const log = createModuleLogger('useTranslationStore');

interface TranslationState {
  // 条目状态
  entries: POEntry[];
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

  // Actions - 导航
  nextEntry: () => void;
  previousEntry: () => void;

  // Actions - 重置
  reset: () => void;
}

export const useTranslationStore = create<TranslationState>()(
  devtools(
    (set, get) => ({
      // 初始状态
      entries: [],
      currentEntry: null,
      currentIndex: -1,
      currentFilePath: null,

      // 设置条目列表
      setEntries: (entries) => {
        log.info('设置条目列表', { count: entries.length });
        set({
          entries,
          currentEntry: entries.length > 0 ? entries[0] : null,
          currentIndex: entries.length > 0 ? 0 : -1,
        });
      },

      // 设置当前条目
      setCurrentEntry: (entry) => {
        const { entries } = get();
        const index = entries.findIndex((e) => e === entry);
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
        const { entries, currentIndex } = get();
        if (index >= 0 && index < entries.length) {
          const newEntries = [...entries];
          newEntries[index] = { ...newEntries[index], ...updates };
          set({ entries: newEntries });

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
        set({
          entries: [],
          currentEntry: null,
          currentIndex: -1,
          currentFilePath: null,
        });
      },
    }),
    { name: 'TranslationStore' }
  )
);
