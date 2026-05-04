import { useState, useEffect, memo, useCallback } from 'react';
import { message } from 'antd';
import { useTranslation } from 'react-i18next';
import { POEntry } from '../types/tauri';
import { useTranslationStore } from '../store';
import { announceToScreenReader } from '../utils/accessibility';
import { TermConfirmModal } from './TermConfirmModal';
import { ErrorBoundary } from './ErrorBoundary';
import { createModuleLogger } from '../utils/logger';
import { useTermDetection } from '../hooks/useTermDetection';
import { EditorToolbar } from './editor/EditorToolbar';
import { SourceSection } from './editor/SourceSection';
import { TargetSection } from './editor/TargetSection';
import { StatusBar } from './editor/StatusBar';
import { EmptyState } from './ui/EmptyState';
import styles from './EditorPane.module.css';

const log = createModuleLogger('EditorPane');

interface EditorPaneProps {
  entry: POEntry | null;
  onEntryUpdate: (index: number, updates: Partial<POEntry>) => void;
  aiTranslation?: string;
  onNavigatePrev?: () => void;
  onNavigateNext?: () => void;
  canNavigatePrev?: boolean;
  canNavigateNext?: boolean;
}

export const EditorPane = memo(function EditorPane({
  entry,
  onEntryUpdate,
  aiTranslation,
  onNavigatePrev,
  onNavigateNext,
  canNavigatePrev,
  canNavigateNext,
}: EditorPaneProps) {
  const { t } = useTranslation();
  const entries = useTranslationStore((state) => state.entries);
  const {
    termModalVisible,
    detectedDifference,
    detectDifference,
    handleTermConfirm,
    handleTermCancel,
  } = useTermDetection();

  const [translation, setTranslation] = useState('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [originalTranslation, setOriginalTranslation] = useState('');

  useEffect(() => {
    if (entry) {
      const initialTranslation = entry.msgstr || '';
      setTranslation(initialTranslation);
      setOriginalTranslation(initialTranslation);
      setHasUnsavedChanges(false);
      log.debug('条目已切换', {
        msgid: entry.msgid,
        msgstr: entry.msgstr,
        hasAiTranslation: !!aiTranslation,
        aiTranslation,
      });
    }
  }, [entry, aiTranslation]);

  const handleTranslationChange = useCallback(
    (value: string) => {
      setTranslation(value);
      setHasUnsavedChanges(entry ? entry.msgstr !== value : false);
    },
    [entry]
  );

  const handleSaveTranslation = useCallback(() => {
    if (!entry) return;

    const index = entries.findIndex((e) => e === entry);

    log.info('准备保存译文', {
      index,
      translation,
      hasAiTranslation: !!aiTranslation,
      aiTranslation: aiTranslation,
      isDifferent: translation !== aiTranslation,
    });

    if (index >= 0) {
      onEntryUpdate(index, { msgstr: translation, needsReview: false });
      setHasUnsavedChanges(false);
      setOriginalTranslation(translation);
      message.success(t('messages.translationSaved'));
      announceToScreenReader(t('messages.translationSaved'), 'polite');
      log.info('译文已保存', { index, translation });

      detectDifference(entry, translation);
    }
  }, [entry, entries, onEntryUpdate, translation, aiTranslation, t, detectDifference]);

  const handleBlur = useCallback(() => {
    if (hasUnsavedChanges && entry) {
      log.debug('译文输入框失去焦点，自动保存');
      handleSaveTranslation();
    }
  }, [hasUnsavedChanges, entry, handleSaveTranslation]);

  const handleCancel = useCallback(() => {
    setTranslation(originalTranslation);
    setHasUnsavedChanges(false);
    message.info(t('messages.editCancelled'));
  }, [originalTranslation]);

  const handleCopyOriginal = useCallback(() => {
    if (entry?.msgid) {
      navigator.clipboard.writeText(entry.msgid);
      message.success(t('messages.originalCopied'));
    }
  }, [entry]);

  // 快捷键支持
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Enter: 保存
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && hasUnsavedChanges) {
        e.preventDefault();
        handleSaveTranslation();
      }
      // Esc: 取消
      if (e.key === 'Escape' && hasUnsavedChanges) {
        e.preventDefault();
        handleCancel();
      }
      // Ctrl+↑: 上一项
      if ((e.ctrlKey || e.metaKey) && e.key === 'ArrowUp' && onNavigatePrev) {
        e.preventDefault();
        onNavigatePrev();
      }
      // Ctrl+↓: 下一项
      if ((e.ctrlKey || e.metaKey) && e.key === 'ArrowDown' && onNavigateNext) {
        e.preventDefault();
        onNavigateNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasUnsavedChanges, handleSaveTranslation, handleCancel, onNavigatePrev, onNavigateNext]);

  if (!entry) {
    return (
      <div className={styles.emptyContainer}>
        <EmptyState
          type="default"
          title={t('emptyState.title.selectEntry')}
          description={t('emptyState.description.selectEntry')}
          showShortcuts
          shortcuts={[
            { key: 'Ctrl + O', description: t('emptyState.shortcuts.openFile') },
            { key: 'Ctrl + S', description: t('emptyState.shortcuts.saveFile') },
            { key: 'Ctrl + Enter', description: t('emptyState.shortcuts.saveTranslation') },
            { key: 'Esc', description: t('emptyState.shortcuts.cancelEdit') },
          ]}
        />
      </div>
    );
  }

  const saveStatusId = 'save-status';

  return (
    <div className={styles.container} role="region" aria-label="翻译编辑器" id="main-editor">
      {/* 工具栏 */}
      <EditorToolbar
        hasUnsavedChanges={hasUnsavedChanges}
        onSave={handleSaveTranslation}
        onCancel={handleCancel}
        onCopyOriginal={handleCopyOriginal}
        onNavigatePrev={onNavigatePrev}
        onNavigateNext={onNavigateNext}
        canNavigatePrev={canNavigatePrev}
        canNavigateNext={canNavigateNext}
      />

      {/* 双栏编辑区域 */}
      <div className={styles.splitView} role="form" aria-label="翻译编辑表单">
        {/* 原文区域 */}
        <SourceSection entry={entry} />

        {/* 译文区域 */}
        <TargetSection
          entry={entry}
          translation={translation}
          onTranslationChange={handleTranslationChange}
          onBlur={handleBlur}
          hasUnsavedChanges={hasUnsavedChanges}
          saveStatusId={saveStatusId}
        />
      </div>

      {/* 状态栏 */}
      <StatusBar
        lineNumber={entry.line_start}
        charCount={translation.length}
        isTranslated={!!translation}
      />

      {termModalVisible && detectedDifference && detectedDifference.difference && (
        <ErrorBoundary>
          <TermConfirmModal
            visible={termModalVisible}
            original={detectedDifference.original}
            aiTranslation={detectedDifference.aiTranslation}
            userTranslation={detectedDifference.userTranslation}
            difference={detectedDifference.difference}
            onConfirm={handleTermConfirm}
            onCancel={handleTermCancel}
          />
        </ErrorBoundary>
      )}
    </div>
  );
});
