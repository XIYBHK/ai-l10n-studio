/**
 * 翻译流程 Hook
 * 封装文件操作、翻译执行、条目管理等核心业务逻辑
 *
 * 优化点：
 * 1. 使用原子化 selectors，避免不必要重渲染
 * 2. 使用 O(1) 索引查找替代 O(n) indexOf
 * 3. 移除不必要的 useCallback
 * 4. 修复 Tauri 事件监听的竞态条件
 * 5. 实现渐进式上屏队列机制（0.33秒间隔）
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { listen } from '@tauri-apps/api/event';
import { message as msg } from 'antd';
import { useChannelTranslation } from './useChannelTranslation';
import {
  useEntries,
  useCurrentEntry,
  useCurrentFilePath,
  useSetEntries,
  useSetCurrentEntry,
  useSetCurrentFilePath,
  useUpdateEntry,
  useGetEntryIndex,
  useIsTranslating,
  useSetTranslating,
  useProgress,
  useSetProgress,
  useResetSessionStats,
  useUpdateSessionStats,
  useUpdateCumulativeStatsAction,
} from '../store';
import { useAsync } from './useAsync';
import { POEntry, TranslationStats, TranslationQueueItem } from '../types/tauri';
import type { LanguageInfo } from '../types/generated/LanguageInfo';
import { poFileCommands, dialogCommands } from '../services/fileCommands';
import { i18nCommands, translatorCommands } from '../services/translationCommands';
import { createModuleLogger } from '../utils/logger';

const log = createModuleLogger('useTranslationFlow');

export function useTranslationFlow() {
  // Store 状态 - 使用原子化 hooks
  const entries = useEntries();
  const currentEntry = useCurrentEntry();
  const currentFilePath = useCurrentFilePath();
  const isTranslating = useIsTranslating();

  // Actions
  const setEntries = useSetEntries();
  const setCurrentEntry = useSetCurrentEntry();
  const setCurrentFilePath = useSetCurrentFilePath();
  const updateEntry = useUpdateEntry();
  const getEntryIndex = useGetEntryIndex();
  const setTranslating = useSetTranslating();
  const setProgress = useSetProgress();
  const progress = useProgress();
  const resetSessionStats = useResetSessionStats();
  const updateSessionStats = useUpdateSessionStats();
  const updateCumulativeStats = useUpdateCumulativeStatsAction();

  // UI 状态
  const [translationStats, setTranslationStats] = useState<TranslationStats | null>(null);
  const [sourceLanguage, setSourceLanguage] = useState<string>('');
  const [targetLanguage, setTargetLanguage] = useState<string>('zh-CN');

  // 渐进式上屏队列
  const updateQueue = useRef<TranslationQueueItem[]>([]);
  const isProcessingQueue = useRef(false);
  const queueTimerRef = useRef<number | null>(null);

  // Hooks
  const { execute: parsePOFile } = useAsync(poFileCommands.parse);
  const channelTranslation = useChannelTranslation();

  useEffect(() => {
    resetSessionStats();
    log.info('🔄 翻译流程初始化，会话统计已重置');
  }, [resetSessionStats]);

  // 队列消费器 - 自适应间隔
  const processUpdateQueue = useCallback(() => {
    if (isProcessingQueue.current || updateQueue.current.length === 0) return;

    isProcessingQueue.current = true;

    const processNext = () => {
      const item = updateQueue.current.shift();
      if (!item) {
        isProcessingQueue.current = false;
        return;
      }

      // 更新条目并标记为刚更新（触发动画）
      updateEntry(item.index, {
        msgstr: item.translation,
        needsReview: item.source === 'ai',
        justUpdated: true,
      });

      // 500ms 后移除高亮标记（动画完成）
      setTimeout(() => {
        updateEntry(item.index, { justUpdated: false });
      }, 500);

      // 刷新统计（如果有增量统计）
      if (item.incrementalStats) {
        const stats: TranslationStats = {
          total: 1,
          tm_hits: item.incrementalStats.tmHits || 0,
          deduplicated: item.incrementalStats.deduplicated || 0,
          ai_translated: item.incrementalStats.aiTranslated || 0,
          tm_learned: item.incrementalStats.tmLearned || 0,
          token_stats: {
            input_tokens: item.incrementalStats.tokenStats?.inputTokens || 0,
            output_tokens: item.incrementalStats.tokenStats?.outputTokens || 0,
            total_tokens: item.incrementalStats.tokenStats?.totalTokens || 0,
            cost: item.incrementalStats.tokenStats?.cost || 0,
          },
        };
        updateSessionStats(stats);
      }

      // 自适应间隔：队列越长，间隔越短
      if (updateQueue.current.length > 0) {
        const queueLength = updateQueue.current.length;
        let interval: number;

        if (queueLength > 100) {
          interval = 50; // 超过100条：50ms（快速处理）
        } else if (queueLength > 50) {
          interval = 100; // 50-100条：100ms（中速）
        } else if (queueLength > 20) {
          interval = 200; // 20-50条：200ms（适中）
        } else {
          interval = 300; // 少于20条：300ms（慢速，便于观察）
        }

        queueTimerRef.current = window.setTimeout(processNext, interval);
      } else {
        isProcessingQueue.current = false;
        log.info('✅ 队列处理完成');
      }
    };

    processNext();
  }, [setEntries, updateSessionStats]);

  // 入队函数
  const enqueueUpdate = useCallback(
    (item: TranslationQueueItem) => {
      updateQueue.current.push(item);
      if (!isProcessingQueue.current) {
        processUpdateQueue();
      }
    },
    [processUpdateQueue]
  );

  // 清空队列（切换文件/停止翻译时）
  const clearQueue = useCallback(() => {
    updateQueue.current = [];
    if (queueTimerRef.current) {
      clearTimeout(queueTimerRef.current);
      queueTimerRef.current = null;
    }
    isProcessingQueue.current = false;
    log.info('🧹 上屏队列已清空');
  }, []);

  // 翻译统计事件监听 - 修复竞态条件
  useEffect(() => {
    let unlistenFn: (() => void) | null = null;
    let isActive = true;

    const setupListener = async () => {
      const unlisten = await listen<{ stats: TranslationStats }>('translation:after', (event) => {
        if (!isActive) return;
        const stats = event.payload.stats;
        log.info('📊 收到翻译统计', stats);

        updateSessionStats(stats);
        updateCumulativeStats(stats);
      });

      if (isActive) {
        unlistenFn = unlisten;
      } else {
        unlisten();
      }
    };

    setupListener();

    return () => {
      isActive = false;
      unlistenFn?.();
    };
  }, [updateSessionStats, updateCumulativeStats]);

  // 文件拖放监听 - 修复竞态条件和依赖
  useEffect(() => {
    let unlistenFn: (() => void) | null = null;
    let isActive = true;

    const setupListener = async () => {
      const unlisten = await listen<string[]>('tauri://file-drop', async (event) => {
        if (!isActive) return;

        const files = event.payload;
        if (files && files.length > 0) {
          const filePath = files[0];
          if (filePath.toLowerCase().endsWith('.po')) {
            try {
              const newEntries = (await parsePOFile(filePath)) as POEntry[];
              // 使用 getState 获取最新状态
              setEntries(newEntries);
              setCurrentFilePath(filePath);
              await detectAndSetLanguages(newEntries);
              log.info('通过拖放导入文件成功', { filePath });
            } catch (error) {
              log.logError(error, '解析拖放文件失败');
              msg.error(`文件导入失败：${error instanceof Error ? error.message : '未知错误'}`);
            }
          }
        }
      });

      if (isActive) {
        unlistenFn = unlisten;
      } else {
        unlisten();
      }
    };

    setupListener();

    return () => {
      isActive = false;
      unlistenFn?.();
    };
  }, [parsePOFile, setEntries, setCurrentFilePath]);

  const detectAndSetLanguages = async (entriesToDetect: POEntry[]) => {
    try {
      const sampleTexts = entriesToDetect
        .filter((e) => e.msgid && e.msgid.trim())
        .slice(0, 5)
        .map((e) => e.msgid)
        .join(' ');

      if (sampleTexts) {
        const detectedLang = await i18nCommands.detectLanguage(sampleTexts);
        setSourceLanguage(detectedLang.display_name);
        const defaultTarget = await i18nCommands.getDefaultTargetLanguage(detectedLang.code);
        setTargetLanguage(defaultTarget.code);
        log.info('语言检测完成', {
          source: detectedLang.display_name,
          target: defaultTarget.display_name,
        });
      }
    } catch (error) {
      log.logError(error, '语言检测失败');
      setSourceLanguage('未知');
      setTargetLanguage('zh-CN');
    }
  };

  const openFile = async () => {
    try {
      // 切换文件时清空队列
      clearQueue();

      const filePath = await dialogCommands.openFile();
      if (filePath) {
        const newEntries = (await parsePOFile(filePath)) as POEntry[];
        setEntries(newEntries);
        setCurrentFilePath(filePath);
        await detectAndSetLanguages(newEntries);
        log.info('文件加载成功', { filePath, entryCount: newEntries.length });
      }
    } catch (error) {
      log.logError(error, '打开文件失败');
      msg.error(`打开文件失败：${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  const saveFile = async () => {
    if (!currentFilePath) {
      msg.warning('没有打开的文件，请使用"另存为"');
      return;
    }
    try {
      await poFileCommands.save(currentFilePath, entries);
      msg.success('保存成功！');
      log.info('文件保存成功', { filePath: currentFilePath });
    } catch (error) {
      log.logError(error, '保存文件失败');
      msg.error(`保存失败：${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  const saveAsFile = async () => {
    try {
      const filePath = await dialogCommands.saveFile();
      if (filePath) {
        await poFileCommands.save(filePath, entries);
        setCurrentFilePath(filePath);
        msg.success('保存成功！');
        log.info('文件另存为成功', { filePath });
      }
    } catch (error) {
      log.logError(error, '另存为失败');
      msg.error(`保存失败：${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  const executeTranslation = async (entriesToTranslate: POEntry[]) => {
    const texts = entriesToTranslate.map((e) => e.msgid);
    let completedCount = 0;

    try {
      setTranslating(true);
      setProgress(0);

      log.info('🚀 开始翻译', { count: texts.length });

      const result = await channelTranslation.translateBatch(texts, targetLanguage, {
        onProgress: (current, _total, percentage) => {
          setProgress(percentage);
          completedCount = current;
        },
        onStats: (stats) => {
          const convertedStats = {
            ...stats,
            token_stats: {
              total_tokens: stats.token_stats.total_tokens,
              prompt_tokens: stats.token_stats.prompt_tokens,
              completion_tokens: stats.token_stats.completion_tokens,
              input_tokens: stats.token_stats.prompt_tokens,
              output_tokens: stats.token_stats.completion_tokens,
              cost: stats.token_stats.cost,
            },
          } as TranslationStats;
          setTranslationStats(convertedStats);

          // 批量统计到达后，分配到队列中的每一项作为增量统计
          const aiQueueItems = updateQueue.current.filter((item) => item.source === 'ai');
          const queueLength = aiQueueItems.length;
          if (queueLength > 0) {
            const incrementalStats = {
              tmHits: 0,
              deduplicated: 0,
              aiTranslated: Math.ceil(stats.ai_translated / queueLength),
              tmLearned: Math.ceil(stats.tm_learned / queueLength),
              tokenStats: {
                inputTokens: Math.ceil(stats.token_stats.prompt_tokens / queueLength),
                outputTokens: Math.ceil(stats.token_stats.completion_tokens / queueLength),
                totalTokens: Math.ceil(stats.token_stats.total_tokens / queueLength),
                cost: stats.token_stats.cost / queueLength,
              },
            };

            // 仅为AI翻译项添加增量统计
            aiQueueItems.forEach((item) => {
              if (!item.incrementalStats) {
                item.incrementalStats = incrementalStats;
              }
            });
          }
        },
        onItem: (index, translation) => {
          const entry = entriesToTranslate[index];
          const entryIndex = getEntryIndex(entry);
          if (entryIndex >= 0) {
            // 入队而非立即更新
            enqueueUpdate({
              index: entryIndex,
              translation,
              source: 'ai',
            });
          }
        },
      });

      // 注意：由于使用渐进式上屏，不在这里立即更新条目
      // 所有更新都通过 onItem 回调入队处理

      if (result.stats) {
        const finalStats: TranslationStats = {
          total: texts.length,
          tm_hits: result.stats.tm_hits || 0,
          deduplicated: result.stats.deduplicated || 0,
          ai_translated: result.stats.ai_translated || 0,
          token_stats: {
            input_tokens: result.stats.token_stats.input_tokens || 0,
            output_tokens: result.stats.token_stats.output_tokens || 0,
            total_tokens: result.stats.token_stats.total_tokens || 0,
            cost: result.stats.token_stats.cost || 0,
          },
          tm_learned: result.stats.tm_learned || 0,
        };

        log.info('📊 统计已更新', finalStats);
      }

      log.info('✅ 翻译完成', { count: completedCount });
      return true;
    } catch (error) {
      log.logError(error, '翻译失败');
      const errorMessage = error instanceof Error ? error.message : String(error);
      msg.error({ content: errorMessage, duration: 8 });
      return false;
    } finally {
      setTranslating(false);
      setProgress(0);
      // 翻译完成后等待队列处理完毕
      log.info('🎯 翻译完成，等待队列处理', { queueLength: updateQueue.current.length });
    }
  };

  const translateAll = async () => {
    if (isTranslating) {
      log.warn('翻译正在进行中，忽略重复请求');
      return;
    }

    const untranslatedEntries = entries.filter((entry) => entry.msgid && !entry.msgstr);
    if (untranslatedEntries.length === 0) {
      return;
    }

    log.info('准备批量翻译', { untranslatedCount: untranslatedEntries.length });
    await executeTranslation(untranslatedEntries);
  };

  const handleTranslateSelected = async (indices: number[]) => {
    const selectedEntries = indices
      .map((i) => entries[i])
      .filter((e: POEntry | undefined): e is POEntry => e !== undefined && !!e.msgid && !e.msgstr);

    if (selectedEntries.length === 0) {
      msg.info('选中的条目都已翻译');
      return;
    }

    await executeTranslation(selectedEntries);
  };

  const handleContextualRefine = async (indices: number[]) => {
    const selectedEntries = indices
      .map((i) => ({ index: i, entry: entries[i] }))
      .filter(({ entry }) => entry !== undefined && !!entry.msgid && !!entry.needsReview)
      .map(({ index, entry }) => ({ index, entry: entry as POEntry }));

    if (selectedEntries.length === 0) {
      msg.info('选中的条目中没有待确认的项');
      return;
    }

    setTranslating(true);

    try {
      const requests = selectedEntries.map(({ index, entry }) => ({
        msgid: entry.msgid,
        msgctxt: entry.msgctxt ?? null,
        comment: entry.comments.join('\n') ?? null,
        previousEntry: index > 0 ? (entries[index - 1]?.msgstr ?? null) : null,
        nextEntry: index < entries.length - 1 ? (entries[index + 1]?.msgstr ?? null) : null,
      }));

      log.info('[精翻] 开始精翻', { count: requests.length });
      const results = await translatorCommands.contextualRefine(requests, targetLanguage);

      results.forEach((translation, i) => {
        const { index } = selectedEntries[i];
        updateEntry(index, {
          msgstr: translation,
          needsReview: true,
          translationSource: 'ai',
        });
      });

      log.info('[精翻] 完成', { count: results.length });
    } catch (error) {
      log.logError(error, '精翻失败');
      const errorMessage = error instanceof Error ? error.message : String(error);
      msg.error({ content: errorMessage, duration: 8 });
    } finally {
      setTranslating(false);
    }
  };

  // ✅ 移除不必要的 useCallback
  const handleEntrySelect = (entry: POEntry) => {
    setCurrentEntry(entry);
  };

  // ✅ 移除不必要的 useCallback
  const handleEntryUpdate = (index: number, updates: Partial<POEntry>) => {
    updateEntry(index, updates);
  };

  // ✅ 移除不必要的 useCallback
  const handleTargetLanguageChange = (langCode: string, langInfo: LanguageInfo | undefined) => {
    setTargetLanguage(langCode);
    if (langInfo) {
      log.info('切换目标语言', { code: langInfo.code, name: langInfo.display_name });
    }
  };

  // 包装取消翻译，确保清空队列
  const cancelTranslation = useCallback(() => {
    clearQueue();
    channelTranslation.cancelTranslation();
    log.info('🛑 翻译已取消，队列已清空');
  }, [channelTranslation, clearQueue]);

  return {
    entries,
    currentEntry,
    currentFilePath,
    isTranslating,
    progress,
    translationStats,
    sourceLanguage,
    targetLanguage,
    openFile,
    saveFile,
    saveAsFile,
    translateAll,
    handleTranslateSelected,
    handleContextualRefine,
    handleEntrySelect,
    handleEntryUpdate,
    handleTargetLanguageChange,
    cancelTranslation,
    resetTranslationStats: () => setTranslationStats(null),
  };
}
