import { useCallback, useEffect, useRef } from 'react';
import { Channel } from '@tauri-apps/api/core';
import { invoke } from '../services/tauriInvoke';
import { createModuleLogger } from '../utils/logger';
import type { BatchProgressEvent } from '../types/generated/BatchProgressEvent';
import type { BatchResultWithTaskId } from '../types/generated/BatchResultWithTaskId';
import type { TranslationInput } from '../types/generated/TranslationInput';
import type { TranslationItem } from '../types/generated/TranslationItem';
import type { ContextualRefineRequest, TranslationStats } from '../types/tauri';

const log = createModuleLogger('useChannelTranslation');
export type { BatchProgressEvent, BatchResultWithTaskId };
export interface TranslationCallbacks {
  onProgress?: (processed: number, total: number, percentage: number) => void;
  onStats?: (stats: TranslationStats) => void;
  onItems?: (items: TranslationItem[]) => void;
}

interface Run {
  taskId: number | null;
  cancelRequested: boolean;
  cancelSent: boolean;
  finished: Promise<void>;
  finish: () => void;
}

async function cancelRun(run: Run) {
  run.cancelRequested = true;
  if (run.taskId === null || run.cancelSent) return;
  run.cancelSent = true;
  try {
    await invoke('cancel_translation', { taskId: run.taskId });
  } catch (error) {
    run.cancelSent = false;
    throw error;
  }
}

export const useChannelTranslation = () => {
  const activeRun = useRef<Run | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (activeRun.current) {
        void cancelRun(activeRun.current).catch((error) => log.error('Cancel failed', error));
      }
      activeRun.current = null;
    };
  }, []);

  const translateBatch = useCallback(
    async (
      inputs: TranslationInput[],
      targetLanguage: string,
      callbacks: TranslationCallbacks = {},
      refineRequests?: ContextualRefineRequest[]
    ): Promise<BatchResultWithTaskId> => {
      if (inputs.length === 0) throw new Error('No translation inputs');
      if (activeRun.current) throw new Error('A translation is already running');
      let finish = () => {};
      const finished = new Promise<void>((resolve) => {
        finish = resolve;
      });
      const run: Run = {
        taskId: null,
        cancelRequested: false,
        cancelSent: false,
        finished,
        finish,
      };
      activeRun.current = run;
      const isCurrent = () => mounted.current && activeRun.current === run;
      let processed = 0;
      const received = new Map<number, TranslationItem>();
      const applyItems = (items: TranslationItem[]) => {
        const changed = items.filter((item) => {
          const previous = received.get(item.index);
          if (previous?.translation === item.translation && previous.source === item.source)
            return false;
          received.set(item.index, item);
          return true;
        });
        if (changed.length) callbacks.onItems?.(changed);
      };
      const observeTask = (taskId: number) => {
        run.taskId = taskId;
        if (run.cancelRequested) {
          void cancelRun(run).catch((error) => log.error('Cancel failed', error));
        }
      };
      try {
        const progressChannel = new Channel<BatchProgressEvent>();
        progressChannel.onmessage = (event) => {
          observeTask(event.task_id);
          if (!isCurrent()) return;
          processed = Math.max(processed, event.processed);
          const percentage = event.total ? (processed / event.total) * 100 : 0;
          applyItems(event.items);
          callbacks.onStats?.(event.stats);
          callbacks.onProgress?.(processed, event.total, percentage);
        };
        const result = await invoke<BatchResultWithTaskId>(
          refineRequests ? 'contextual_refine' : 'translate_batch_with_channel',
          {
            ...(refineRequests ? { requests: refineRequests } : { inputs }),
            targetLanguage,
            progressChannel,
          }
        );
        observeTask(result.task_id);
        if (isCurrent()) {
          // The return value is authoritative even if a final channel event was lost.
          applyItems(result.items);
          callbacks.onStats?.(result.stats);
          const percentage = (result.items.length / inputs.length) * 100;
          callbacks.onProgress?.(result.items.length, inputs.length, percentage);
        }
        return result;
      } finally {
        run.finish();
        if (isCurrent()) {
          activeRun.current = null;
        }
      }
    },
    []
  );

  const cancelTranslation = useCallback(async () => {
    if (activeRun.current) await cancelRun(activeRun.current);
  }, []);

  const reset = useCallback(() => {
    if (activeRun.current) {
      void cancelRun(activeRun.current).catch((error) => log.error('Cancel failed', error));
    }
    activeRun.current = null;
  }, []);

  const cancelAndWait = useCallback(async () => {
    const run = activeRun.current;
    if (!run) return;
    await cancelRun(run);
    await run.finished;
  }, []);

  return {
    translateBatch,
    cancelTranslation,
    cancelAndWait,
    reset,
  };
};
