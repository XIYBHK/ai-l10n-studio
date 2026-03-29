import { useState, useEffect, memo, useCallback } from 'react';
import { message } from 'antd';
import { POEntry } from '../types/tauri';
import { useTranslationStore } from '../store';
import { analyzeTranslationDifference } from '../utils/termAnalyzer';
import { announceToScreenReader } from '../utils/accessibility';
import { TermConfirmModal } from './TermConfirmModal';
import { ErrorBoundary } from './ErrorBoundary';
import { createModuleLogger } from '../utils/logger';
import { termLibraryCommands } from '../services/termCommands';
import { useAppData } from '../hooks/useConfig';
import { useTermLibrary } from '../hooks/useTermLibrary';
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
  const { activeAIConfig } = useAppData();
  const { refresh: refreshTermLibrary } = useTermLibrary();
  const entries = useTranslationStore((state) => state.entries);

  const [translation, setTranslation] = useState('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [originalTranslation, setOriginalTranslation] = useState('');
  const [termModalVisible, setTermModalVisible] = useState(false);
  const [detectedDifference, setDetectedDifference] = useState<{
    original: string;
    aiTranslation: string;
    userTranslation: string;
    difference: any;
  } | null>(null);

  // 当条目变化时重置状态
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
        aiTranslation: aiTranslation,
      });
    }
  }, [entry]);

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
      message.success('译文已保存');
      announceToScreenReader('译文已保存', 'polite');
      log.info('译文已保存', { index, translation });

      // 保存后检测术语差异
      if (entry.needsReview && entry.msgstr && translation !== entry.msgstr) {
        log.debug('开始检测术语差异', {
          original: entry.msgid,
          aiTranslation: entry.msgstr,
          userTranslation: translation,
          reason: '用户修改了AI译文（needsReview=true）',
        });

        try {
          const difference = analyzeTranslationDifference(entry.msgid, entry.msgstr, translation);

          log.debug('差异分析结果', JSON.stringify(difference, null, 2));

          if (!difference) {
            log.error('analyzeTranslationDifference返回null/undefined');
            return;
          }

          if (difference.confidence >= 0.6) {
            log.info('检测到高置信度差异，准备弹窗确认', {
              confidence: difference.confidence,
              type: difference.type,
              hasAiTerm: !!difference.ai_term,
              hasUserTerm: !!difference.user_term,
            });

            const diffData = {
              original: entry.msgid,
              aiTranslation: entry.msgstr,
              userTranslation: translation,
              difference: difference,
            };

            setDetectedDifference(diffData);
            setTermModalVisible(true);
          } else {
            log.debug('置信度不足，不触发弹窗', { confidence: difference.confidence });
          }
        } catch (error) {
          log.logError(error, '术语检测失败');
          message.error(`术语检测失败: ${error instanceof Error ? error.message : '未知错误'}`);
        }
      } else {
        log.debug('跳过术语检测', {
          needsReview: entry.needsReview,
          hasOriginalMsgstr: !!entry.msgstr,
          isDifferent: translation !== entry.msgstr,
          reason: !entry.needsReview ? '非AI翻译（手动输入或从文件加载）' : '译文未修改',
        });
      }
    }
  }, [entry, entries, onEntryUpdate, translation, aiTranslation]);

  const handleBlur = useCallback(() => {
    if (hasUnsavedChanges && entry) {
      log.debug('译文输入框失去焦点，自动保存');
      handleSaveTranslation();
    }
  }, [hasUnsavedChanges, entry, handleSaveTranslation]);

  const handleCancel = useCallback(() => {
    setTranslation(originalTranslation);
    setHasUnsavedChanges(false);
    message.info('已取消修改');
  }, [originalTranslation]);

  const handleCopyOriginal = useCallback(() => {
    if (entry?.msgid) {
      navigator.clipboard.writeText(entry.msgid);
      message.success('原文已复制到剪贴板');
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
          title="请从左侧列表选择一个条目"
          description='或者点击工具栏的"打开"按钮导入 PO 文件开始翻译'
          showShortcuts
          shortcuts={[
            { key: 'Ctrl + O', description: '打开文件' },
            { key: 'Ctrl + S', description: '保存文件' },
            { key: 'Ctrl + Enter', description: '保存译文' },
            { key: 'Esc', description: '取消编辑' },
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

      {/* 术语确认弹窗 */}
      {termModalVisible && detectedDifference && detectedDifference.difference && (
        <ErrorBoundary
          fallback={
            <div style={{ padding: '20px' }}>
              <p>术语确认弹窗渲染失败，请查看控制台日志</p>
            </div>
          }
        >
          <TermConfirmModal
            visible={termModalVisible}
            original={detectedDifference.original}
            aiTranslation={detectedDifference.aiTranslation}
            userTranslation={detectedDifference.userTranslation}
            difference={detectedDifference.difference}
            onConfirm={async (addToLibrary) => {
              log.info('用户确认术语弹窗', { addToLibrary });
              try {
                if (addToLibrary) {
                  const termData = {
                    source: detectedDifference.original,
                    userTranslation: detectedDifference.userTranslation,
                    aiTranslation: detectedDifference.aiTranslation,
                    context: entry?.msgctxt || null,
                  };
                  log.debug('添加术语到术语库', termData);

                  await termLibraryCommands.addTerm(termData);

                  log.info('术语添加成功');

                  const shouldUpdate = await termLibraryCommands.shouldUpdateStyleSummary();
                  log.debug('检查是否需要更新风格总结', { shouldUpdate });

                  if (shouldUpdate && activeAIConfig) {
                    message.info('正在生成风格总结…', 1);
                    await termLibraryCommands.generateStyleSummary();
                    message.success('术语已添加，风格总结已更新');
                  } else {
                    message.success('术语已添加到术语库');
                  }

                  refreshTermLibrary();
                }
              } catch (error) {
                log.logError(error, '添加术语失败');
                message.error(
                  `添加术语失败: ${error instanceof Error ? error.message : '未知错误'}`
                );
              } finally {
                setTermModalVisible(false);
                setDetectedDifference(null);
              }
            }}
            onCancel={() => {
              log.info('用户取消术语弹窗');
              setTermModalVisible(false);
              setDetectedDifference(null);
            }}
          />
        </ErrorBoundary>
      )}
    </div>
  );
});
