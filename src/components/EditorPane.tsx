import { useState, useEffect, memo } from 'react';
import { Input, Button, message } from 'antd';
import { CopyOutlined, SaveOutlined, GlobalOutlined, TranslationOutlined } from '@ant-design/icons';
import { POEntry } from '../types/tauri';
import { useTranslationStore } from '../store';
import { analyzeTranslationDifference } from '../utils/termAnalyzer';
import { TermConfirmModal } from './TermConfirmModal';
import { ErrorBoundary } from './ErrorBoundary';
import { createModuleLogger } from '../utils/logger';
import { termLibraryCommands } from '../services/commands';
import { useAppData } from '../hooks/useConfig';
import { useTermLibrary } from '../hooks/useTermLibrary';
import styles from './EditorPane.module.css';

const { TextArea } = Input;
const log = createModuleLogger('EditorPane');

interface EditorPaneProps {
  entry: POEntry | null;
  onEntryUpdate: (index: number, updates: Partial<POEntry>) => void;
  aiTranslation?: string;
}

export const EditorPane = memo(function EditorPane({
  entry,
  onEntryUpdate,
  aiTranslation,
}: EditorPaneProps) {
  const { activeAIConfig } = useAppData();
  const { refresh: refreshTermLibrary } = useTermLibrary();

  const [translation, setTranslation] = useState('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [termModalVisible, setTermModalVisible] = useState(false);
  const [detectedDifference, setDetectedDifference] = useState<{
    original: string;
    aiTranslation: string;
    userTranslation: string;
    difference: any;
  } | null>(null);

  useEffect(() => {
    if (entry) {
      setTranslation(entry.msgstr || '');
      setHasUnsavedChanges(false);
      log.debug('条目已切换', {
        msgid: entry.msgid,
        msgstr: entry.msgstr,
        hasAiTranslation: !!aiTranslation,
        aiTranslation: aiTranslation,
      });
    }
  }, [entry]); // 只在 entry 变化时重置，不依赖 aiTranslation

  const handleTranslationChange = (value: string) => {
    setTranslation(value);
    setHasUnsavedChanges(entry?.msgstr !== value);
  };

  const handleBlur = () => {
    if (hasUnsavedChanges && entry) {
      log.debug('译文输入框失去焦点，自动保存');
      handleSaveTranslation();
    }
  };

  const handleSaveTranslation = () => {
    if (!entry) return;

    const { entries } = useTranslationStore.getState();
    const index = entries.findIndex((e) => e === entry);

    log.info('🔍 准备保存译文', {
      index,
      translation,
      hasAiTranslation: !!aiTranslation,
      aiTranslation: aiTranslation,
      isDifferent: translation !== aiTranslation,
    });

    if (index >= 0) {
      onEntryUpdate(index, { msgstr: translation, needsReview: false });
      setHasUnsavedChanges(false);
      message.success('译文已保存');
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
  };

  const handleCopyOriginal = () => {
    if (entry?.msgid) {
      navigator.clipboard.writeText(entry.msgid);
      message.success('原文已复制到剪贴板');
    }
  };

  // 快捷键支持：Ctrl+Enter 保存译文
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && hasUnsavedChanges) {
        e.preventDefault();
        handleSaveTranslation();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasUnsavedChanges, translation, entry, aiTranslation]);

  if (!entry) {
    return (
      <div className={styles.emptyContainer}>
        <div className={styles.emptyIcon}>📝</div>
        <div className={styles.emptyText}>请从左侧列表选择一个条目进行编辑</div>
        <div className={styles.emptySubtext}>或者点击工具栏的"打开"按钮导入 PO 文件</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* 工具栏 */}
      <div className={styles.toolbar}>
        <div className={styles.toolbarStatus}>
          {hasUnsavedChanges && <span className={styles.unsavedText}>● 有未保存的修改</span>}
        </div>
        <div className={styles.toolbarActions}>
          <Button size="small" icon={<CopyOutlined />} onClick={handleCopyOriginal}>
            复制原文
          </Button>
          <Button
            size="small"
            type="primary"
            icon={<SaveOutlined />}
            onClick={handleSaveTranslation}
            disabled={!hasUnsavedChanges}
          >
            保存译文 (Ctrl+Enter)
          </Button>
        </div>
      </div>

      {/* 双栏编辑区域 - Poedit 风格 */}
      <div className={styles.splitView}>
        {/* 原文区域 */}
        <div className={styles.sourceArea}>
          <div className={styles.sectionHeader}>
            <GlobalOutlined /> 原文 (Source)
          </div>
          <div className={`${styles.sourceContent} font-mono`}>
            {entry.msgid || <span className={styles.emptyContent}>(空)</span>}

            {/* 上下文和注释 */}
            {(entry.msgctxt || (entry.comments && entry.comments.length > 0)) && (
              <div className={styles.contextBox}>
                {entry.msgctxt && (
                  <div
                    className={styles.contextItem}
                    style={{ marginBottom: entry.comments?.length ? 8 : 0 }}
                  >
                    <div className={styles.contextLabel}>上下文:</div>
                    <div className={styles.contextValue}>{entry.msgctxt}</div>
                  </div>
                )}
                {entry.comments && entry.comments.length > 0 && (
                  <div className={styles.contextItem}>
                    <div className={styles.contextLabel}>注释:</div>
                    {entry.comments.map((comment, index) => (
                      <div key={index} className={styles.commentItem}>
                        {comment}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 译文区域 */}
        <div className={styles.targetArea}>
          <div className={styles.sectionHeader}>
            <TranslationOutlined /> 译文 (Translation)
          </div>
          <div className={styles.targetContentContainer}>
            <TextArea
              className={`${styles.textArea} font-mono`}
              value={translation}
              onChange={(e) => handleTranslationChange(e.target.value)}
              onBlur={handleBlur}
              placeholder="在此输入翻译内容..."
              bordered={false}
            />
            {/* 悬浮保存提示 */}
            {hasUnsavedChanges && <div className={styles.unsavedBadge}>按 Ctrl+Enter 保存</div>}
          </div>
        </div>
      </div>

      {/* 状态栏 */}
      <div className={styles.statusBar}>
        <span>行: {entry.line_start}</span>
        <span>字符: {translation.length}</span>
        <span>{translation ? '✓ 已翻译' : '○ 未翻译'}</span>
      </div>

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
                    message.info('正在生成风格总结...', 1);
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
