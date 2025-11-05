import React, { useState, useEffect, memo } from 'react';
import { Input, Button, message } from 'antd';
import { CopyOutlined, SaveOutlined } from '@ant-design/icons';
import { POEntry } from '../types/tauri';
import { useSessionStore } from '../store';
import { useTheme } from '../hooks/useTheme';
import { analyzeTranslationDifference } from '../utils/termAnalyzer';
import { TermConfirmModal } from './TermConfirmModal';
import { ErrorBoundary } from './ErrorBoundary';
import { createModuleLogger } from '../utils/logger';
import { termLibraryCommands } from '../services/commands';
import { useAppData } from '../hooks/useConfig';

// 💡 优化：使用 React.memo 避免不必要的重渲染
const { TextArea } = Input;
const log = createModuleLogger('EditorPane');

interface EditorPaneProps {
  entry: POEntry | null;
  onEntryUpdate: (index: number, updates: Partial<POEntry>) => void;
  aiTranslation?: string; // AI原译文，用于术语检测
  // ⛔ 移除: apiKey (使用 useAppData 统一获取)
}

const EditorPane: React.FC<EditorPaneProps> = memo(({
  entry,
  onEntryUpdate,
  aiTranslation,
  // ⛔ 移除: apiKey 参数
}) => {
  // ✅ 使用统一数据提供者获取AI配置
  const { activeAIConfig } = useAppData();

  const [translation, setTranslation] = useState('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [termModalVisible, setTermModalVisible] = useState(false);
  const [detectedDifference, setDetectedDifference] = useState<{
    original: string;
    aiTranslation: string;
    userTranslation: string;
    difference: any;
  } | null>(null);
  const { colors } = useTheme();

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

  // ✅ 新增: 失去焦点时自动保存（触发术语检测）
  const handleBlur = () => {
    if (hasUnsavedChanges && entry) {
      log.debug('译文输入框失去焦点，自动保存');
      handleSaveTranslation();
    }
  };

  // 保存译文
  const handleSaveTranslation = () => {
    if (!entry) return;

    const { entries } = useSessionStore.getState();
    const index = entries.findIndex((e) => e === entry);

    log.info('🔍 准备保存译文', {
      index,
      translation,
      hasAiTranslation: !!aiTranslation,
      aiTranslation: aiTranslation,
      isDifferent: translation !== aiTranslation,
    });

    if (index >= 0) {
      // 保存译文并清除待确认标记
      onEntryUpdate(index, { msgstr: translation, needsReview: false });
      setHasUnsavedChanges(false);
      message.success('译文已保存');
      log.info('译文已保存', { index, translation });

      // 保存后检测术语差异
      if (aiTranslation && translation && translation !== aiTranslation) {
        log.debug('开始检测术语差异', {
          original: entry.msgid,
          aiTranslation,
          userTranslation: translation,
        });

        try {
          const difference = analyzeTranslationDifference(entry.msgid, aiTranslation, translation);

          log.debug('差异分析结果', JSON.stringify(difference, null, 2));

          // 验证difference对象
          if (!difference) {
            log.error('analyzeTranslationDifference返回null/undefined');
            return;
          }

          // 只有高置信度的差异才值得保存（confidence >= 0.6）
          if (difference.confidence >= 0.6) {
            log.info('检测到高置信度差异，准备弹窗确认', {
              confidence: difference.confidence,
              type: difference.type,
              hasAiTerm: !!difference.ai_term,
              hasUserTerm: !!difference.user_term,
            });

            const diffData = {
              original: entry.msgid,
              aiTranslation: aiTranslation,
              userTranslation: translation,
              difference: difference,
            };

            log.debug('准备设置 detectedDifference', JSON.stringify(diffData, null, 2));

            setDetectedDifference(diffData);
            setTermModalVisible(true);

            log.debug('状态已更新', { termModalVisible: true });
          } else {
            log.debug('置信度不足，不触发弹窗', { confidence: difference.confidence });
          }
        } catch (error) {
          log.logError(error, '术语检测失败');
          message.error(`术语检测失败: ${error instanceof Error ? error.message : '未知错误'}`);
        }
      } else {
        log.debug('跳过术语检测', {
          hasAiTranslation: !!aiTranslation,
          hasTranslation: !!translation,
          isDifferent: translation !== aiTranslation,
          reason: !aiTranslation ? '非AI翻译（可能是手动输入或从文件加载）' : '译文未修改',
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
      <div
        style={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: colors.textTertiary,
        }}
      >
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>📝</div>
        <div style={{ fontSize: '16px', color: colors.textSecondary }}>
          请从左侧列表选择一个条目进行编辑
        </div>
        <div style={{ fontSize: '12px', marginTop: '8px', color: colors.textTertiary }}>
          或者点击工具栏的"打开"按钮导入 PO 文件
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 工具栏 */}
      <div
        style={{
          padding: '8px 16px',
          borderBottom: `1px solid ${colors.borderSecondary}`,
          background: colors.bgTertiary,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <div style={{ fontSize: '12px', color: colors.textTertiary }}>
          {hasUnsavedChanges && (
            <span style={{ color: colors.statusUntranslated }}>● 有未保存的修改</span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
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
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* 原文区域 */}
        <div
          style={{
            flex: '0 0 40%',
            borderBottom: `1px solid ${colors.borderSecondary}`,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div
            style={{
              padding: '8px 16px',
              background: colors.bgTertiary,
              borderBottom: `1px solid ${colors.borderSecondary}`,
              fontSize: '12px',
              fontWeight: 500,
              color: colors.textSecondary,
            }}
          >
            原文 (Source)
          </div>
          <div
            style={{
              flex: 1,
              padding: '12px 16px',
              background: colors.bgTertiary,
              fontSize: '14px',
              lineHeight: '1.6',
              color: colors.textPrimary,
              overflowY: 'auto',
            }}
          >
            {entry.msgid || '(空)'}

            {/* 上下文和注释 */}
            {(entry.msgctxt || (entry.comments && entry.comments.length > 0)) && (
              <div
                style={{
                  marginTop: 16,
                  paddingTop: 12,
                  borderTop: `1px solid ${colors.borderSecondary}`,
                }}
              >
                {entry.msgctxt && (
                  <div
                    style={{
                      fontSize: '12px',
                      color: colors.statusUntranslated,
                      marginBottom: 8,
                    }}
                  >
                    <strong>上下文:</strong> {entry.msgctxt}
                  </div>
                )}
                {entry.comments && entry.comments.length > 0 && (
                  <div style={{ fontSize: '12px', color: colors.statusNeedsReview }}>
                    <strong>注释:</strong>
                    {entry.comments.map((comment, index) => (
                      <div key={index}>{comment}</div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 译文区域 */}
        <div
          style={{
            flex: '1 1 60%',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div
            style={{
              padding: '8px 16px',
              background: colors.bgTertiary,
              borderBottom: `1px solid ${colors.borderSecondary}`,
              fontSize: '12px',
              fontWeight: 500,
              color: colors.textSecondary,
            }}
          >
            译文 (Translation)
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <TextArea
              value={translation}
              onChange={(e) => handleTranslationChange(e.target.value)}
              onBlur={handleBlur}
              placeholder="请输入翻译内容..."
              bordered={false}
              style={{
                flex: 1,
                fontSize: '14px',
                lineHeight: '1.6',
                padding: '12px 16px',
                resize: 'none',
              }}
            />
          </div>
        </div>
      </div>

      {/* 状态栏 */}
      <div
        style={{
          padding: '6px 16px',
          borderTop: `1px solid ${colors.borderSecondary}`,
          background: colors.bgTertiary,
          fontSize: '12px',
          color: colors.textTertiary,
          display: 'flex',
          gap: '16px',
        }}
      >
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
                  // 🔄 使用统一命令层而非直接API调用
                  const termData = {
                    source: detectedDifference.original,
                    userTranslation: detectedDifference.userTranslation,
                    aiTranslation: detectedDifference.aiTranslation,
                    context: entry?.msgctxt || null,
                  };
                  log.debug('添加术语到术语库', termData);

                  await termLibraryCommands.addTerm(termData);

                  log.info('术语添加成功');

                  // 检查是否需要生成风格总结
                  const shouldUpdate = await termLibraryCommands.shouldUpdateStyleSummary();
                  log.debug('检查是否需要更新风格总结', { shouldUpdate });

                  if (shouldUpdate && activeAIConfig) {
                    message.info('正在生成风格总结...', 1);
                    await termLibraryCommands.generateStyleSummary();
                    message.success('术语已添加，风格总结已更新');
                  } else {
                    message.success('术语已添加到术语库');
                  }

                  log.debug('术语已更新');
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

export default EditorPane;
