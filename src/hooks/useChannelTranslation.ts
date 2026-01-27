import { useState, useCallback, useRef } from 'react';
import { Channel } from '@tauri-apps/api/core';
import { invoke } from '../services/tauriInvoke';
import { createModuleLogger } from '../utils/logger';

const log = createModuleLogger('useChannelTranslation');

// ========== 类型定义 ==========

export interface BatchProgressEvent {
  current: number;
  total: number;
  percentage: number;
  text?: string;
}

export interface BatchStatsEvent {
  total: number;
  tm_hits: number;
  deduplicated: number;
  ai_translated: number;
  token_stats: TokenStatsEvent;
  tm_learned: number;
}

export interface TokenStatsEvent {
  total_tokens: number;
  prompt_tokens: number;
  completion_tokens: number;
  cost: number;
}

export interface TokenStats {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  cost: number;
}

export interface TranslationStats {
  total: number;
  tm_hits: number;
  deduplicated: number;
  ai_translated: number;
  token_stats: TokenStats;
  tm_learned: number;
}

export interface BatchResult {
  translations: string[];
  translation_sources: string[];
  stats: TranslationStats;
}

export interface TranslationCallbacks {
  onProgress?: (current: number, total: number, percentage: number) => void;
  onStats?: (stats: BatchStatsEvent) => void;
  onItem?: (index: number, translation: string) => void;
}

export const useChannelTranslation = () => {
  const [isTranslating, setIsTranslating] = useState(false);
  const [progress, setProgress] = useState<BatchProgressEvent>({
    current: 0,
    total: 0,
    percentage: 0,
  });
  const [stats, setStats] = useState<BatchStatsEvent | null>(null);

  const callbacksRef = useRef<TranslationCallbacks>({});

  const translateBatch = useCallback(
    async (
      texts: string[],
      targetLanguage: string,
      callbacks?: TranslationCallbacks
    ): Promise<BatchResult> => {
      if (texts.length === 0) {
        throw new Error('没有需要翻译的文本');
      }

      setIsTranslating(true);
      setProgress({ current: 0, total: texts.length, percentage: 0 });
      setStats(null);
      callbacksRef.current = callbacks || {};

      log.info('🚀 开始 Channel 批量翻译', {
        total: texts.length,
        targetLanguage,
      });

      try {
        const progressChannel = new Channel<BatchProgressEvent>();
        const statsChannel = new Channel<BatchStatsEvent>();

        progressChannel.onmessage = (progressEvent: any) => {
          const currentRaw = (progressEvent.current ?? progressEvent.processed ?? 0) as number;
          const total = (progressEvent.total ?? 0) as number;
          const percentage = (progressEvent.percentage ?? 0) as number;
          const text = (progressEvent.text ?? progressEvent.current_item) as string | undefined;
          const index = (progressEvent.index ?? null) as number | null;

          const monotonicCurrent = Math.max(progress.current ?? 0, currentRaw);
          const normalized = { current: monotonicCurrent, total, percentage, text } as any;
          log.debug('📊 进度更新:', normalized);
          setProgress(normalized);

          if (callbacksRef.current.onProgress) {
            callbacksRef.current.onProgress(monotonicCurrent, total, percentage);
          }

          if (callbacksRef.current.onItem && index !== null && typeof text === 'string') {
            callbacksRef.current.onItem(index, text);
          }
        };

        statsChannel.onmessage = (statsEvent) => {
          log.debug('📈 统计更新:', statsEvent);
          setStats(statsEvent);

          if (callbacksRef.current.onStats) {
            callbacksRef.current.onStats(statsEvent);
          }
        };

        const result = await invoke<BatchResult>(
          'translate_batch_with_channel',
          {
            texts,
            targetLanguage,
            progressChannel,
            statsChannel,
          },
          {}
        );

        log.info('✅ 批量翻译完成', {
          translated: result.translations.length,
          tm_hits: result.stats.tm_hits,
          ai_translated: result.stats.ai_translated,
          cost: result.stats.token_stats.cost,
        });

        return result;
      } catch (error) {
        log.error('❌ 批量翻译失败:', error);
        throw error;
      } finally {
        setIsTranslating(false);
      }
    },
    []
  );

  const reset = useCallback(() => {
    setProgress({ current: 0, total: 0, percentage: 0 });
    setStats(null);
    setIsTranslating(false);
    callbacksRef.current = {};
  }, []);

  return {
    isTranslating,
    progress,
    stats,
    translateBatch,
    reset,
  };
};
