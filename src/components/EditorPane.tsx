import { useState, useEffect, memo, useCallback } from 'react';
import { App } from 'antd';
import { useTranslation } from 'react-i18next';
import { POEntry } from '../types/tauri';
import { useTranslationStore } from '../store';
import { announceToScreenReader } from '../utils/accessibility';
import { TermConfirmModal } from './TermConfirmModal';
import { ErrorBoundary } from './ErrorBoundary';
import { createModuleLogger } from '../utils/logger';
import { useTermDetection } from '../hooks/useTermDetection';
import { useEditorState } from '../hooks/useEditorState';
import { pluralCount } from '../utils/poDocument';
import { EditorToolbar } from './editor/EditorToolbar';
import { SourceSection } from './editor/SourceSection';
import { TargetSection } from './editor/TargetSection';
import { StatusBar } from './editor/StatusBar';
import { EmptyState } from './ui/EmptyState';
import styles from './EditorPane.module.css';

const log = createModuleLogger('EditorPane');

interface EditorPaneProps {
  entry: POEntry | null;
  onConfirmEntries: (indices: number[]) => Promise<void>;
  onNavigatePrev?: () => void;
  onNavigateNext?: () => void;
  canNavigatePrev?: boolean;
  canNavigateNext?: boolean;
}

export const EditorPane = memo(function EditorPane({
  entry,
  onConfirmEntries,
  onNavigatePrev,
  onNavigateNext,
  canNavigatePrev,
  canNavigateNext,
}: EditorPaneProps) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const entries = useTranslationStore((state) => state.entries);
  const revision = useTranslationStore((state) => state.documentRevision);
  const document = useTranslationStore((state) => state.document);
  const {
    termModalVisible,
    detectedDifference,
    detectDifference,
    handleTermConfirm,
    handleTermCancel,
  } = useTermDetection();

  const entryIndex = entry ? entries.indexOf(entry) : -1;
  const identity = `${revision}:${entryIndex}:${entry?.msgctxt}:${entry?.msgid}:${entry?.line_start}`;
  const [pluralSelection, setPluralSelection] = useState({ identity, index: 0 });
  const pluralIndex = pluralSelection.identity === identity ? pluralSelection.index : 0;
  const savedTranslation = entry?.msgid_plural
    ? (entry.msgstr_plural[pluralIndex] ?? '')
    : (entry?.msgstr ?? '');
  const {
    translation,
    setTranslation: handleTranslationChange,
    hasUnsavedChanges,
    cancel,
  } = useEditorState(entryIndex, entry?.msgid_plural ? pluralIndex : null, savedTranslation);
  const [saving, setSaving] = useState(false);

  const handleSaveTranslation = useCallback(async () => {
    if (!entry || entryIndex < 0 || saving) return;
    setSaving(true);
    try {
      await onConfirmEntries([entryIndex]);
      if (useTranslationStore.getState().documentRevision !== revision) return;
      message.success(t('messages.translationSaved'));
      announceToScreenReader(t('messages.translationSaved'), 'polite');
      if (!entry.msgid_plural) detectDifference(entry, translation);
    } catch (error) {
      log.logError(error, 'Confirm translation failed');
      message.error(t('document.confirmFailed', { error: String(error) }));
    } finally {
      setSaving(false);
    }
  }, [entry, entryIndex, saving, onConfirmEntries, revision, translation, t, detectDifference]);

  const handleCancel = useCallback(() => {
    cancel();
    message.info(t('messages.editCancelled'));
  }, [cancel, t]);

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
        saving={saving}
        onSave={handleSaveTranslation}
        onCancel={handleCancel}
        onCopyOriginal={handleCopyOriginal}
        onNavigatePrev={onNavigatePrev}
        onNavigateNext={onNavigateNext}
        canNavigatePrev={canNavigatePrev}
        canNavigateNext={canNavigateNext}
      />

      {entry.msgid_plural && (
        <div>
          <select
            aria-label={t('editor.pluralForm', { index: pluralIndex })}
            value={pluralIndex}
            onChange={(event) => {
              setPluralSelection({ identity, index: Number(event.target.value) });
            }}
          >
            {Array.from({ length: pluralCount(entry, document?.metadata ?? {}) }, (_, index) => (
              <option key={index} value={index}>
                {t('editor.pluralForm', { index })}
              </option>
            ))}
          </select>
          <span>
            {t('editor.pluralRule')}: {document?.metadata['Plural-Forms'] ?? ''}
          </span>
          <div>{entry.msgid_plural}</div>
        </div>
      )}

      {/* 双栏编辑区域 */}
      <div className={styles.splitView} role="form" aria-label="翻译编辑表单">
        {/* 原文区域 */}
        <SourceSection entry={entry} />

        {/* 译文区域 */}
        <TargetSection
          entry={entry}
          translation={translation}
          onTranslationChange={handleTranslationChange}
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
