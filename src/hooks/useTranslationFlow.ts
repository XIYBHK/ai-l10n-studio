/**
 * 翻译流程 Hook
 * 封装文件操作、翻译执行、条目管理等核心业务逻辑
 *
 * 优化点：
 * 1. 使用原子化 selectors，避免不必要重渲染
 * 2. 使用 O(1) 索引查找替代 O(n) indexOf
 * 3. 移除不必要的 useCallback
 * 4. 修复 Tauri 事件监听的竞态条件
 */

import { useState, useEffect, useCallback } from 'react';
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
import { POEntry, TranslationStats } from '../types/tauri';
import type { LanguageInfo } from '../types/generated/LanguageInfo';
import {
  poFileCommands,
  dialogCommands,
  i18nCommands,
  translatorCommands,
} from '../services/commands';
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

  // Hooks
  const { execute: parsePOFile } = useAsync(poFileCommands.parse);
  const channelTranslation = useChannelTranslation();

  useEffect(() => {
    resetSessionStats();
    log.info('🔄 翻译流程初始化，会话统计已重置');
  }, [resetSessionStats]);

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
        },
        onItem: (index, translation) => {
          const entry = entriesToTranslate[index];
          // ✅ 使用 O(1) 查找替代 O(n) indexOf
          const entryIndex = getEntryIndex(entry);
          if (entryIndex >= 0) {
            updateEntry(entryIndex, {
              msgstr: translation,
              needsReview: true,
            });
          }
        },
      });

      entriesToTranslate.forEach((entry, localIndex) => {
        // ✅ 使用 O(1) 查找替代 O(n) indexOf
        const entryIndex = getEntryIndex(entry);
        if (entryIndex >= 0 && localIndex < result.translations.length) {
          const translation = result.translations[localIndex];
          const source = (result.translation_sources && result.translation_sources[localIndex]) as
            | 'tm'
            | 'dedup'
            | 'ai'
            | undefined;

          if (translation) {
            updateEntry(entryIndex, {
              msgstr: translation,
              needsReview: true,
              translationSource: source,
            });
          }
        }
      });

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

        updateSessionStats(finalStats);
        updateCumulativeStats(finalStats);

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
    cancelTranslation: channelTranslation.cancelTranslation,
    resetTranslationStats: () => setTranslationStats(null),
  };
}
