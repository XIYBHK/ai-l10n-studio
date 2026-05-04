import { useState, useCallback } from 'react';
import { message } from 'antd';
import { useTranslation } from 'react-i18next';
import { POEntry } from '../types/tauri';
import { analyzeTranslationDifference } from '../utils/termAnalyzer';
import { termLibraryCommands } from '../services/termCommands';
import { useAppData } from './useConfig';
import { useTermLibrary } from './useTermLibrary';
import { createModuleLogger } from '../utils/logger';

const log = createModuleLogger('useTermDetection');

const DIFFERENCE_CONFIDENCE_THRESHOLD = 0.6;

export interface DetectedDifference {
  original: string;
  aiTranslation: string;
  userTranslation: string;
  context: string | null;
  difference: ReturnType<typeof analyzeTranslationDifference>;
}

export interface UseTermDetectionResult {
  termModalVisible: boolean;
  detectedDifference: DetectedDifference | null;
  detectDifference: (entry: POEntry, userTranslation: string) => void;
  handleTermConfirm: (addToLibrary: boolean) => Promise<void>;
  handleTermCancel: () => void;
}

export function useTermDetection(): UseTermDetectionResult {
  const { t } = useTranslation();
  const { activeAIConfig } = useAppData();
  const { refresh: refreshTermLibrary } = useTermLibrary();

  const [termModalVisible, setTermModalVisible] = useState(false);
  const [detectedDifference, setDetectedDifference] = useState<DetectedDifference | null>(null);

  const detectDifference = useCallback((entry: POEntry, userTranslation: string) => {
    if (!entry.needsReview || !entry.msgstr || userTranslation === entry.msgstr) {
      log.debug('跳过术语检测', {
        needsReview: entry.needsReview,
        hasOriginalMsgstr: !!entry.msgstr,
        isDifferent: userTranslation !== entry.msgstr,
      });
      return;
    }

    try {
      const difference = analyzeTranslationDifference(entry.msgid, entry.msgstr, userTranslation);
      if (!difference) {
        log.error('analyzeTranslationDifference 返回 null/undefined');
        return;
      }
      if (difference.confidence < DIFFERENCE_CONFIDENCE_THRESHOLD) {
        log.debug('置信度不足，不触发弹窗', { confidence: difference.confidence });
        return;
      }

      log.info('检测到高置信度差异，准备弹窗确认', {
        confidence: difference.confidence,
        type: difference.type,
      });
      setDetectedDifference({
        original: entry.msgid,
        aiTranslation: entry.msgstr,
        userTranslation,
        context: entry.msgctxt ?? null,
        difference,
      });
      setTermModalVisible(true);
    } catch (error) {
      log.logError(error, '术语检测失败');
      message.error(
        t('errors.termDetectFailed', {
          error: error instanceof Error ? error.message : t('errors.unknown'),
        })
      );
    }
  }, [t]);

  const handleTermCancel = useCallback(() => {
    setTermModalVisible(false);
    setDetectedDifference(null);
  }, []);

  const handleTermConfirm = useCallback(
    async (addToLibrary: boolean) => {
      if (!detectedDifference) {
        handleTermCancel();
        return;
      }
      try {
        if (!addToLibrary) {
          return;
        }
        await termLibraryCommands.addTerm({
          source: detectedDifference.original,
          userTranslation: detectedDifference.userTranslation,
          aiTranslation: detectedDifference.aiTranslation,
          context: detectedDifference.context,
        });
        log.info('术语添加成功');

        const shouldUpdate = await termLibraryCommands.shouldUpdateStyleSummary();
        if (shouldUpdate && activeAIConfig) {
          message.info(t('messages.generatingStyleSummary'), 1);
          await termLibraryCommands.generateStyleSummary();
          message.success(t('messages.termAddedWithSummary'));
        } else {
          message.success(t('messages.termAdded'));
        }
        refreshTermLibrary();
      } catch (error) {
        log.logError(error, '添加术语失败');
        message.error(
          t('errors.termAddFailed', {
            error: error instanceof Error ? error.message : t('errors.unknown'),
          })
        );
      } finally {
        handleTermCancel();
      }
    },
    [detectedDifference, activeAIConfig, refreshTermLibrary, t, handleTermCancel]
  );

  return {
    termModalVisible,
    detectedDifference,
    detectDifference,
    handleTermConfirm,
    handleTermCancel,
  };
}
