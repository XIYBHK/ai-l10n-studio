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
import { POEntry, PODocument } from '../types/tauri';
import { createModuleLogger } from '../utils/logger';

const log = createModuleLogger('useTranslationStore');

export interface EditorDraft {
  entryIndex: number;
  pluralIndex: number | null;
  value: string;
}

export const editorDraftKey = (index: number, pluralIndex: number | null) =>
  `${index}:${pluralIndex ?? 'singular'}`;

// ============================================
// State & Actions 定义
// ============================================
interface TranslationState {
  document: PODocument | null;
  documentRevision: number;
  contentRevision: number;
  savedContentRevision: number;
  entryVersions: number[];
  drafts: Record<string, EditorDraft>;
  entries: POEntry[];
  entryIndexMap: Map<POEntry, number>;
  currentEntry: POEntry | null;
  currentIndex: number;

  currentFilePath: string | null;

  sourceLanguage: string;
  targetLanguage: string;

  setEntries: (entries: POEntry[]) => void;
  setDocument: (document: PODocument, path: string | null) => void;
  setDraft: (index: number, pluralIndex: number | null, value: string) => void;
  discardDraft: (index: number, pluralIndex: number | null) => void;
  clearTranslations: (indices: number[]) => void;
  commitDrafts: (indices?: number[]) => number[];
  markSaved: (documentRevision: number, contentRevision: number, path: string) => void;
  updateEntries: (
    updates: { index: number; updates: Partial<POEntry> }[],
    revision?: number
  ) => void;
  setCurrentEntry: (entry: POEntry | null) => void;
  setCurrentIndex: (index: number) => void;
  updateEntry: (index: number, updates: Partial<POEntry>) => void;
  setCurrentFilePath: (path: string | null) => void;

  setSourceLanguage: (language: string) => void;

  getEntryIndex: (entry: POEntry) => number;

  nextEntry: () => void;
  previousEntry: () => void;

  reset: () => void;
}

const initialState = {
  document: null,
  documentRevision: 0,
  contentRevision: 0,
  savedContentRevision: 0,
  entryVersions: [] as number[],
  drafts: {} as Record<string, EditorDraft>,
  entries: [],
  entryIndexMap: new Map<POEntry, number>(),
  currentEntry: null,
  currentIndex: -1,
  currentFilePath: null,
  sourceLanguage: '',
  targetLanguage: 'zh-CN',
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

        const currentIndex = entries.findIndex((entry) => !entry.obsolete && !!entry.msgid);
        set({
          entries,
          entryIndexMap,
          currentEntry: entries[currentIndex] ?? null,
          currentIndex,
          documentRevision: get().documentRevision + 1,
          contentRevision: 0,
          savedContentRevision: 0,
          entryVersions: entries.map(() => 0),
          drafts: {},
        });
      },

      setDocument: (document, path) => {
        const entries = document.entries.map((entry) => ({
          ...entry,
          needsReview: entry.flags.includes('fuzzy'),
        }));
        const currentIndex = entries.findIndex((entry) => !entry.obsolete && !!entry.msgid);
        set({
          document,
          entries,
          entryIndexMap: new Map(entries.map((entry, index) => [entry, index])),
          currentEntry: entries[currentIndex] ?? null,
          currentIndex,
          currentFilePath: path,
          documentRevision: get().documentRevision + 1,
          contentRevision: 0,
          savedContentRevision: path ? 0 : -1,
          entryVersions: entries.map(() => 0),
          drafts: {},
          sourceLanguage: '',
          targetLanguage: document.metadata.Language || 'zh-CN',
        });
      },

      updateEntries: (updates, revision) => {
        const state = get();
        if (revision !== undefined && revision !== state.documentRevision) return;
        const entries = [...state.entries];
        const entryIndexMap = new Map(state.entryIndexMap);
        const entryVersions = [...state.entryVersions];
        let changed = false;
        for (const item of updates) {
          const previous = entries[item.index];
          if (!previous) continue;
          const entry = { ...previous, ...item.updates };
          if (item.updates.needsReview !== undefined) {
            entry.flags = entry.flags.filter((flag) => flag !== 'fuzzy');
            if (item.updates.needsReview) entry.flags.push('fuzzy');
          }
          if (JSON.stringify(entry) === JSON.stringify(previous)) continue;
          changed = true;
          entryVersions[item.index] = (entryVersions[item.index] ?? 0) + 1;
          entryIndexMap.delete(previous);
          entryIndexMap.set(entry, item.index);
          entries[item.index] = entry;
        }
        if (changed)
          set({
            entries,
            entryIndexMap,
            entryVersions,
            contentRevision: state.contentRevision + 1,
            currentEntry: entries[state.currentIndex] ?? null,
          });
      },

      setDraft: (index, pluralIndex, value) => {
        const state = get();
        const entry = state.entries[index];
        if (!entry) return;
        const key = editorDraftKey(index, pluralIndex);
        const saved =
          pluralIndex === null ? entry.msgstr : (entry.msgstr_plural[pluralIndex] ?? '');
        const drafts = { ...state.drafts };
        if (value === saved) delete drafts[key];
        else drafts[key] = { entryIndex: index, pluralIndex, value };
        const entryVersions = [...state.entryVersions];
        entryVersions[index] = (entryVersions[index] ?? 0) + 1;
        set({ drafts, entryVersions });
      },

      discardDraft: (index, pluralIndex) => {
        const drafts = { ...get().drafts };
        delete drafts[editorDraftKey(index, pluralIndex)];
        set({ drafts });
      },

      commitDrafts: (indices) => {
        const state = get();
        const drafts = { ...state.drafts };
        const patches = new Map<number, Partial<POEntry>>();
        for (const [key, draft] of Object.entries(drafts)) {
          if (indices && !indices.includes(draft.entryIndex)) continue;
          const entry = state.entries[draft.entryIndex];
          if (!entry) continue;
          const patch = patches.get(draft.entryIndex) ?? {
            needsReview: true,
            translationSource: undefined,
          };
          if (draft.pluralIndex === null) patch.msgstr = draft.value;
          else {
            patch.msgstr_plural = [...(patch.msgstr_plural ?? entry.msgstr_plural)];
            patch.msgstr_plural[draft.pluralIndex] = draft.value;
          }
          patches.set(draft.entryIndex, patch);
          delete drafts[key];
        }
        state.updateEntries(Array.from(patches, ([index, updates]) => ({ index, updates })));
        set({ drafts });
        return [...patches.keys()];
      },

      clearTranslations: (indices) => {
        const state = get();
        const drafts = Object.fromEntries(
          Object.entries(state.drafts).filter(([, draft]) => !indices.includes(draft.entryIndex))
        );
        const entryVersions = [...state.entryVersions];
        for (const index of indices) entryVersions[index] = (entryVersions[index] ?? 0) + 1;
        set({ drafts, entryVersions });
        get().updateEntries(
          indices.flatMap((index) => {
            const entry = state.entries[index];
            return entry
              ? [
                  {
                    index,
                    updates: {
                      msgstr: '',
                      msgstr_plural: entry.msgstr_plural.map(() => ''),
                      needsReview: false,
                      translationSource: undefined,
                    },
                  },
                ]
              : [];
          })
        );
      },

      markSaved: (revision, contentRevision, path) => {
        if (get().documentRevision === revision)
          set({
            savedContentRevision: contentRevision,
            currentFilePath: path,
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
        get().updateEntries([{ index, updates }]);
      },

      setCurrentFilePath: (path) => {
        log.info('设置文件路径', { path });
        set({ currentFilePath: path });
      },

      setSourceLanguage: (language) => {
        log.debug('设置源语言', { language });
        set({ sourceLanguage: language });
      },

      // O(1) 获取条目索引
      getEntryIndex: (entry) => {
        const { entryIndexMap } = get();
        return entryIndexMap.get(entry) ?? -1;
      },

      // 下一个条目
      nextEntry: () => {
        const { currentIndex, entries } = get();
        const newIndex = entries.findIndex(
          (entry, index) => index > currentIndex && !entry.obsolete && !!entry.msgid
        );
        if (newIndex !== -1) {
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
        let newIndex = currentIndex - 1;
        while (newIndex >= 0 && (entries[newIndex].obsolete || !entries[newIndex].msgid))
          newIndex--;
        if (newIndex >= 0) {
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
        set({ ...initialState, documentRevision: get().documentRevision + 1 });
      },
    }),
    { name: 'TranslationStore' }
  )
);

// ============================================
// 原子化 Selectors（Zustand 最佳实践）
// 使用这些 selectors 可以避免不必要重渲染
// ============================================

export const selectEntries = (state: TranslationState) => state.entries;
export const selectCurrentEntry = (state: TranslationState) => state.currentEntry;
export const selectCurrentIndex = (state: TranslationState) => state.currentIndex;
export const selectCurrentFilePath = (state: TranslationState) => state.currentFilePath;
export const selectSourceLanguage = (state: TranslationState) => state.sourceLanguage;
export const selectTargetLanguage = (state: TranslationState) => state.targetLanguage;
export const selectDocumentDirty = (state: TranslationState) =>
  state.contentRevision !== state.savedContentRevision || Object.keys(state.drafts).length > 0;

export const selectSetEntries = (state: TranslationState) => state.setEntries;
export const selectSetCurrentEntry = (state: TranslationState) => state.setCurrentEntry;
export const selectUpdateEntry = (state: TranslationState) => state.updateEntry;
export const selectSetCurrentFilePath = (state: TranslationState) => state.setCurrentFilePath;
export const selectSetSourceLanguage = (state: TranslationState) => state.setSourceLanguage;
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

export const useEntries = () => useTranslationStore(selectEntries);
export const useCurrentEntry = () => useTranslationStore(selectCurrentEntry);
export const useCurrentIndex = () => useTranslationStore(selectCurrentIndex);
export const useCurrentFilePath = () => useTranslationStore(selectCurrentFilePath);
export const useEntryCount = () => useTranslationStore(selectEntryCount);
export const useHasEntries = () => useTranslationStore(selectHasEntries);
export const useSourceLanguage = () => useTranslationStore(selectSourceLanguage);
export const useTargetLanguage = () => useTranslationStore(selectTargetLanguage);

export const useSetEntries = () => useTranslationStore(selectSetEntries);
export const useSetCurrentEntry = () => useTranslationStore(selectSetCurrentEntry);
export const useSetCurrentFilePath = () => useTranslationStore(selectSetCurrentFilePath);
export const useSetSourceLanguage = () => useTranslationStore(selectSetSourceLanguage);
export const useUpdateEntry = () => useTranslationStore(selectUpdateEntry);
export const useGetEntryIndex = () => useTranslationStore(selectGetEntryIndex);
