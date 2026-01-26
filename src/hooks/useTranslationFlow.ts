/**
 * 翻译流程 Hook
 * 封装文件操作、翻译执行、条目管理等核心业务逻辑
 */

import { useState, useEffect, useCallback } from 'react';
import { listen } from '@tauri-apps/api/event';
import { message as msg } from 'antd';
import { useChannelTranslation } from './useChannelTranslation';
import { useTranslationStore, useSessionStore, useStatsStore } from '../store';
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
  // Store 状态
  const {
    entries,
    currentEntry,
    currentFilePath,
    setEntries,
    setCurrentEntry,
    setCurrentFilePath,
    updateEntry,
  } = useTranslationStore();

  const {
    isTranslating,
    progress,
    setTranslating,
    setProgress,
    resetSessionStats,
    updateSessionStats,
  } = useSessionStore();

  // 统计状态
  const { updateCumulativeStats } = useStatsStore();

  // UI 状态
  const [translationStats, setTranslationStats] = useState<TranslationStats | null>(null);
  const [sourceLanguage, setSourceLanguage] = useState<string>('');
  const [targetLanguage, setTargetLanguage] = useState<string>('zh-CN');

  // Hooks
  const { execute: parsePOFile } = useAsync(poFileCommands.parse);
  const channelTranslation = useChannelTranslation();

  // 🔧 启动时重置会话统计
  useEffect(() => {
    resetSessionStats();
    log.info('🔄 翻译流程初始化，会话统计已重置');
  }, []);

  // ✅ 监听翻译完成事件，更新统计
  useEffect(() => {
    let unlisten: (() => void) | null = null;

    const setupListener = async () => {
      unlisten = await listen<{ stats: TranslationStats }>('translation:after', (event) => {
        const stats = event.payload.stats;
        log.info('📊 收到翻译统计', stats);

        // 更新会话统计（当前会话累计）
        updateSessionStats(stats);

        // 更新累计统计（跨会话持久化）
        updateCumulativeStats(stats);
      });
    };

    setupListener();

    return () => {
      if (unlisten) unlisten();
    };
  }, [updateSessionStats, updateCumulativeStats]);

  // 文件拖放监听
  useEffect(() => {
    let unlistenFn: (() => void) | null = null;

    const setupListener = async () => {
      unlistenFn = await listen<string[]>('tauri://file-drop', async (event) => {
        const files = event.payload;
        if (files && files.length > 0) {
          const filePath = files[0];
          if (filePath.toLowerCase().endsWith('.po')) {
            try {
              const entries = (await parsePOFile(filePath)) as POEntry[];
              setEntries(entries);
              setCurrentFilePath(filePath);
              await detectAndSetLanguages(entries);
              log.info('通过拖放导入文件成功', { filePath });
            } catch (error) {
              log.logError(error, '解析拖放文件失败');
              msg.error(`文件导入失败：${error instanceof Error ? error.message : '未知错误'}`);
            }
          }
        }
      });
    };

    setupListener();
    return () => {
      if (unlistenFn) unlistenFn();
    };
  }, []);

  // 语言检测
  const detectAndSetLanguages = async (entries: POEntry[]) => {
    try {
      const sampleTexts = entries
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

  // 打开文件
  const openFile = async () => {
    try {
      const filePath = await dialogCommands.openFile();
      if (filePath) {
        const entries = (await parsePOFile(filePath)) as POEntry[];
        setEntries(entries);
        setCurrentFilePath(filePath);
        await detectAndSetLanguages(entries);
        log.info('文件加载成功', { filePath, entryCount: entries.length });
      }
    } catch (error) {
      log.logError(error, '打开文件失败');
      msg.error(`打开文件失败：${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  // 保存文件
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

  // 另存为
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

  // 统一的翻译处理函数
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
          const entryIndex = entries.indexOf(entry);
          if (entryIndex >= 0) {
            updateEntry(entryIndex, {
              msgstr: translation,
              needsReview: true,
            });
          }
        },
      });

      // 使用最终结果更新所有条目
      entriesToTranslate.forEach((entry, localIndex) => {
        const entryIndex = entries.indexOf(entry);
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

      // 更新统计数据
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

  // 翻译所有未翻译条目
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

  // 翻译选中的条目
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

  // 精翻选中的条目
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
        msgctxt: entry.msgctxt || undefined,
        comment: entry.comments.join('\n') || undefined,
        previousEntry: index > 0 ? entries[index - 1]?.msgstr : undefined,
        nextEntry: index < entries.length - 1 ? entries[index + 1]?.msgstr : undefined,
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

  // 处理条目选择
  const handleEntrySelect = useCallback(
    (entry: POEntry) => {
      setCurrentEntry(entry);
    },
    [setCurrentEntry]
  );

  // 处理条目更新
  const handleEntryUpdate = useCallback(
    (index: number, updates: Partial<POEntry>) => {
      updateEntry(index, updates);
    },
    [updateEntry]
  );

  // 处理目标语言变更
  const handleTargetLanguageChange = useCallback(
    (langCode: string, langInfo: LanguageInfo | undefined) => {
      setTargetLanguage(langCode);
      if (langInfo) {
        log.info('切换目标语言', { code: langInfo.code, name: langInfo.display_name });
      }
    },
    []
  );

  return {
    // 状态
    entries,
    currentEntry,
    currentFilePath,
    isTranslating,
    progress,
    translationStats,
    sourceLanguage,
    targetLanguage,

    // 文件操作
    openFile,
    saveFile,
    saveAsFile,

    // 翻译操作
    translateAll,
    handleTranslateSelected,
    handleContextualRefine,

    // 条目操作
    handleEntrySelect,
    handleEntryUpdate,

    // 语言设置
    handleTargetLanguageChange,

    // 统计重置
    resetTranslationStats: () => setTranslationStats(null),
  };
}
