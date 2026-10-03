import { useEffect, useCallback, useRef, startTransition } from 'react';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { App } from 'antd';
import { useTranslation } from 'react-i18next';
import { useSWRConfig } from 'swr';
import { TRANSLATION_MEMORY_KEY } from './useTranslationMemory';
import { TERM_LIBRARY_KEY } from './useTermLibrary';
import { useChannelTranslation } from './useChannelTranslation';
import {
  useEntries,
  useCurrentEntry,
  useCurrentFilePath,
  useSourceLanguage,
  useTargetLanguage,
  useSetCurrentEntry,
  useUpdateEntry,
  useIsTranslating,
  useSetTranslating,
  useProgress,
  useSetProgress,
  useResetSessionStats,
  useUpdateSessionStats,
  useUpdateCumulativeStatsAction,
  useTranslationStore,
} from '../store';
import { POEntry, TranslationStats } from '../types/tauri';
import { poFileCommands, dialogCommands } from '../services/fileCommands';
import { i18nCommands } from '../services/translationCommands';
import { createModuleLogger } from '../utils/logger';
import { statsDelta, translationSlots } from '../utils/poDocument';
import { createTargetDocument } from '../utils/poDocument';
import { canonicalTargetLanguage } from '../utils/translationMemory';
import { selectDocumentDirty } from '../store/useTranslationStore';
import { askUnsavedDocument, askTargetDocument } from '../components/UnsavedDocumentDialog';
import { confirmDocumentEntries } from '../services/documentActions';
import { notificationManager } from '../utils/notificationManager';
import type { TranslationItem } from '../types/generated/TranslationItem';

const log = createModuleLogger('useTranslationFlow');

export function useTranslationFlow() {
  const { modal, message: msg } = App.useApp();
  const { t } = useTranslation();
  const { mutate } = useSWRConfig();
  const entries = useEntries();
  const currentEntry = useCurrentEntry();
  const currentFilePath = useCurrentFilePath();
  const isTranslating = useIsTranslating();
  const sourceLanguage = useSourceLanguage();
  const targetLanguage = useTargetLanguage();
  const setCurrentEntry = useSetCurrentEntry();
  const updateEntry = useUpdateEntry();
  const setTranslating = useSetTranslating();
  const setProgress = useSetProgress();
  const progress = useProgress();
  const resetSessionStats = useResetSessionStats();
  const updateSessionStats = useUpdateSessionStats();
  const updateCumulativeStats = useUpdateCumulativeStatsAction();
  const generation = useRef(0);
  const mounted = useRef(true);
  const running = useRef(false);
  const saving = useRef(false);
  const leavePrompt = useRef<Promise<boolean> | null>(null);
  const prepareLeave = useRef<() => Promise<boolean>>(async () => true);
  const closing = useRef(false);
  const {
    translateBatch,
    cancelTranslation: cancelBatchTranslation,
    cancelAndWait,
    reset,
  } = useChannelTranslation();

  const confirmEntries = useCallback(
    async (indices: number[]) => {
      const learned = await confirmDocumentEntries(indices);
      if (learned) {
        const learningStats: TranslationStats = {
          total: 0,
          tm_hits: 0,
          deduplicated: 0,
          ai_translated: 0,
          tm_learned: learned,
          token_stats: {
            input_tokens: 0,
            output_tokens: 0,
            total_tokens: 0,
            cost: 0,
            unpriced_requests: 0,
          },
        };
        updateSessionStats(learningStats);
        updateCumulativeStats(learningStats);
        await mutate(TRANSLATION_MEMORY_KEY);
      }
    },
    [mutate, updateSessionStats, updateCumulativeStats]
  );

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      generation.current++;
    };
  }, []);

  const loadFile = useCallback(
    async (path: string) => {
      if (!(await prepareLeave.current())) return;
      const request = ++generation.current;
      reset();
      running.current = false;
      setTranslating(false);
      setProgress(0);
      const document = await poFileCommands.parse(path);
      if (!mounted.current || request !== generation.current) return;
      startTransition(() => useTranslationStore.getState().setDocument(document, path));
      resetSessionStats();
      const sample = document.entries
        .filter((entry) => !entry.obsolete && entry.msgid.trim())
        .slice(0, 5)
        .map((entry) => entry.msgid)
        .join(' ');
      if (!sample) return;
      try {
        const language = await i18nCommands.detectLanguage(sample);
        if (!mounted.current || request !== generation.current) return;
        useTranslationStore.getState().setSourceLanguage(language.code);
      } catch (error) {
        log.logError(error, 'Language detection failed');
      }
    },
    [reset, resetSessionStats, setProgress, setTranslating]
  );

  useEffect(() => {
    let active = true;
    let unlisten: (() => void) | undefined;
    const register = async () => {
      const cleanup = await getCurrentWebviewWindow().onDragDropEvent((event) => {
        if (!active || event.payload.type !== 'drop') return;
        const path = event.payload.paths.find((file) => file.toLowerCase().endsWith('.po'));
        if (path)
          void loadFile(path).catch((error: unknown) => {
            if (active) msg.error(t('errors.importFailed', { error: String(error) }));
          });
      });
      if (active) unlisten = cleanup;
      else cleanup();
    };
    void register().catch((error) => log.logError(error, 'Drag/drop listener failed'));
    return () => {
      active = false;
      unlisten?.();
    };
  }, [loadFile, t]);

  const openFile = async () => {
    try {
      const path = await dialogCommands.openFile();
      if (mounted.current && path) await loadFile(path);
    } catch (error) {
      msg.error(t('errors.openFailed', { error: String(error) }));
    }
  };

  const persistFile = async (saveAs: boolean) => {
    if (running.current || saving.current) {
      msg.warning(t('messages.translatingCannotSave'));
      return false;
    }
    const state = useTranslationStore.getState();
    if (!state.document) {
      msg.warning(t('messages.noFileToSave'));
      return false;
    }
    saving.current = true;
    try {
      const path =
        saveAs || !state.currentFilePath ? await dialogCommands.saveFile() : state.currentFilePath;
      if (!path || useTranslationStore.getState().documentRevision !== state.documentRevision)
        return false;
      const draftedIndices = [
        ...new Set(
          Object.values(useTranslationStore.getState().drafts).map((draft) => draft.entryIndex)
        ),
      ];
      if (draftedIndices.length) {
        try {
          await confirmEntries(draftedIndices);
        } catch (error) {
          // A library failure must not prevent preserving the document on disk.
          log.logError(error, 'Manual translation confirmation failed');
          msg.warning(t('document.memorySaveFailed'));
        }
      }
      // Include edits made while the memory transaction was pending; they stay under review.
      useTranslationStore.getState().commitDrafts();
      const snapshot = useTranslationStore.getState();
      if (snapshot.documentRevision !== state.documentRevision || !snapshot.document) return false;
      const persistedEntries = snapshot.entries.map(
        ({ needsReview: _review, translationSource: _source, justUpdated: _updated, ...entry }) =>
          entry
      );
      await poFileCommands.save(path, {
        ...snapshot.document,
        metadata: { ...snapshot.document.metadata, Language: snapshot.targetLanguage },
        entries: persistedEntries,
      });
      if (
        mounted.current &&
        useTranslationStore.getState().documentRevision === state.documentRevision
      ) {
        useTranslationStore
          .getState()
          .markSaved(snapshot.documentRevision, snapshot.contentRevision, path);
        msg.success(t('messages.saveSuccess'));
      }
      return true;
    } catch (error) {
      msg.error(t('errors.saveFailed', { error: String(error) }));
      return false;
    } finally {
      saving.current = false;
    }
  };

  prepareLeave.current = async () => {
    if (saving.current) return false;
    if (leavePrompt.current) return leavePrompt.current;
    leavePrompt.current = (async () => {
      if (running.current) {
        await cancelAndWait();
        running.current = false;
        setTranslating(false);
      }
      if (!selectDocumentDirty(useTranslationStore.getState())) return true;
      const choice = await askUnsavedDocument(modal);
      if (choice === 'cancel') return false;
      if (choice === 'discard') return true;
      return (await persistFile(false)) && !selectDocumentDirty(useTranslationStore.getState());
    })();
    try {
      return await leavePrompt.current;
    } finally {
      leavePrompt.current = null;
    }
  };

  useEffect(() => {
    let active = true;
    let unlisten: (() => void) | undefined;
    const window = getCurrentWebviewWindow();
    void window
      .onCloseRequested((event) => {
        if (!active) return;
        event.preventDefault();
        if (closing.current) return;
        closing.current = true;
        void prepareLeave
          .current()
          .then(async (proceed) => {
            if (!active || !proceed) return;
            await window.destroy();
          })
          .catch((error) => {
            log.logError(error, 'Close window failed');
            msg.error(t('errors.closeFailed', { error: String(error) }));
          })
          .finally(() => {
            closing.current = false;
          });
      })
      .then((cleanup) => {
        if (active) unlisten = cleanup;
        else cleanup();
      })
      .catch((error) => log.logError(error, 'Close listener failed'));
    return () => {
      active = false;
      unlisten?.();
    };
  }, []);

  const changeTargetLanguage = async (language: string) => {
    const state = useTranslationStore.getState();
    if (
      !state.document ||
      canonicalTargetLanguage(language) === canonicalTargetLanguage(state.targetLanguage)
    )
      return;
    try {
      if (!(await askTargetDocument(modal)) || !(await prepareLeave.current())) return;
      const current = useTranslationStore.getState();
      if (current.documentRevision !== state.documentRevision || !current.document) return;
      const next = createTargetDocument(current.document, current.entries, language);
      generation.current++;
      reset();
      current.setDocument(next, null);
      useTranslationStore.getState().setSourceLanguage(state.sourceLanguage);
      resetSessionStats();
    } catch (error) {
      msg.error(String(error));
    }
  };

  const executeTranslation = async (indices: number[], refine = false) => {
    if (running.current || saving.current) return;
    const state = useTranslationStore.getState();
    const request = generation.current;
    const revision = state.documentRevision;
    const versions = [...state.entryVersions];
    const isCurrent = () =>
      mounted.current &&
      request === generation.current &&
      revision === useTranslationStore.getState().documentRevision;
    let previousStats: TranslationStats | null = null;
    let learned = false;
    try {
      const slots = translationSlots(
        state.entries,
        indices.filter(
          (index) => !Object.values(state.drafts).some((draft) => draft.entryIndex === index)
        ),
        state.document?.metadata ?? {},
        !refine
      );
      if (!slots.length) {
        msg.info(t('messages.allSelectedTranslated'));
        return;
      }
      running.current = true;
      setTranslating(true);
      setProgress(0);
      const applyItems = (items: TranslationItem[]) => {
        if (!isCurrent()) return;
        const current = useTranslationStore.getState();
        const patches = new Map<number, Partial<POEntry>>();
        for (const item of items) {
          const slot = slots[item.index];
          if (!slot) continue;
          const entry = current.entries[slot.entryIndex];
          if (current.entryVersions[slot.entryIndex] !== versions[slot.entryIndex]) continue;
          const patch = patches.get(slot.entryIndex) ?? {};
          if (slot.pluralIndex === null) patch.msgstr = item.translation;
          else {
            patch.msgstr_plural = [...(patch.msgstr_plural ?? entry.msgstr_plural)];
            patch.msgstr_plural[slot.pluralIndex] = item.translation;
          }
          patch.needsReview = patch.needsReview || entry.needsReview || item.source !== 'tm';
          patch.translationSource = item.source;
          patches.set(slot.entryIndex, patch);
        }
        current.updateEntries(
          Array.from(patches, ([index, updates]) => ({ index, updates })),
          revision
        );
        for (const index of patches.keys())
          versions[index] = useTranslationStore.getState().entryVersions[index];
      };
      const requests = refine
        ? slots.map((slot) => ({
            msgid: slot.input.text,
            context: slot.input.context,
            msgctxt: slot.input.context,
            comment: state.entries[slot.entryIndex].comments.join('\n') || null,
            previousEntry: state.entries[slot.entryIndex - 1]?.msgstr ?? null,
            nextEntry: state.entries[slot.entryIndex + 1]?.msgstr ?? null,
          }))
        : undefined;
      const result = await translateBatch(
        slots.map((slot) => slot.input),
        state.targetLanguage,
        {
          onItems: applyItems,
          onProgress: (_processed, _total, percentage) => {
            if (isCurrent()) setProgress(percentage);
          },
          onStats: (stats) => {
            learned ||= stats.tm_learned > 0;
            if (!isCurrent()) return;
            const delta = statsDelta(stats, previousStats);
            previousStats = stats;
            updateSessionStats(delta);
            updateCumulativeStats(delta);
          },
        },
        requests
      );
      learned ||= result.stats.tm_learned > 0;
      if (isCurrent() && !result.cancelled) {
        void notificationManager.translationComplete(
          slots.length,
          result.items.length,
          slots.length - result.items.length
        );
      }
    } catch (error) {
      if (isCurrent()) {
        msg.error({ content: String(error), duration: 8 });
        void notificationManager.translationError(String(error));
      }
      log.logError(error, 'Translation failed');
    } finally {
      if (learned) {
        void Promise.all([mutate(TRANSLATION_MEMORY_KEY), mutate(TERM_LIBRARY_KEY)]).catch(
          (error) => log.logError(error, 'Translation cache refresh failed')
        );
      }
      if (isCurrent()) {
        running.current = false;
        setTranslating(false);
      }
    }
  };

  const cancelTranslation = useCallback(() => {
    void cancelBatchTranslation().catch((error) => {
      log.logError(error, 'Cancel translation failed');
      msg.error(String(error));
    });
  }, [cancelBatchTranslation]);

  return {
    entries,
    currentEntry,
    currentFilePath,
    isTranslating,
    progress,
    sourceLanguage,
    targetLanguage,
    openFile,
    saveFile: () => persistFile(false),
    saveAsFile: () => persistFile(true),
    translateAll: () =>
      executeTranslation(useTranslationStore.getState().entries.map((_, index) => index)),
    handleTranslateSelected: (indices: number[]) => executeTranslation(indices),
    handleContextualRefine: (indices: number[]) =>
      executeTranslation(
        indices.filter((index) => useTranslationStore.getState().entries[index]?.needsReview),
        true
      ),
    handleEntrySelect: setCurrentEntry,
    handleEntryUpdate: updateEntry,
    confirmEntries,
    changeTargetLanguage,
    cancelTranslation,
  };
}
