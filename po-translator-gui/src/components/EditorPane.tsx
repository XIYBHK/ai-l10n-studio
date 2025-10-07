import React, { useState, useEffect } from 'react';
import { Input, Button, message } from 'antd';
import { CopyOutlined, SaveOutlined } from '@ant-design/icons';
import { POEntry } from '../types/tauri';
import { useAppStore } from '../store/useAppStore';
import { useTheme } from '../hooks/useTheme';
import { analyzeTranslationDifference } from '../utils/termAnalyzer';
import { TermConfirmModal } from './TermConfirmModal';

const { TextArea } = Input;

interface EditorPaneProps {
  entry: POEntry | null;
  onEntryUpdate: (index: number, updates: Partial<POEntry>) => void;
  aiTranslation?: string; // AI原译文，用于术语检测
  apiKey: string; // 用于生成风格总结
}

export const EditorPane: React.FC<EditorPaneProps> = ({
  entry,
  onEntryUpdate,
  aiTranslation,
  apiKey,
}) => {
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
    }
  }, [entry]);

  const handleTranslationChange = (value: string) => {
    setTranslation(value);
    setHasUnsavedChanges(entry?.msgstr !== value);
  };

  // 保存译文
  const handleSaveTranslation = () => {
    if (!entry) return;

    const { entries } = useAppStore.getState();
    const index = entries.findIndex(e => e === entry);
    
    if (index >= 0) {
      // 保存译文并清除待确认标记
      onEntryUpdate(index, { msgstr: translation, needsReview: false });
      setHasUnsavedChanges(false);
      message.success('译文已保存');
      console.log('译文已保存:', index, translation);

      // 保存后检测术语差异
      if (aiTranslation && translation && translation !== aiTranslation) {
        try {
          const difference = analyzeTranslationDifference(
            entry.msgid,
            aiTranslation,
            translation
          );
          
          // 只有高置信度的差异才值得保存（confidence >= 0.6）
          if (difference && difference.confidence >= 0.6) {
            setDetectedDifference({
              original: entry.msgid,
              aiTranslation: aiTranslation,
              userTranslation: translation,
              difference: difference,
            });
            setTermModalVisible(true);
          }
        } catch (error) {
          console.error('术语检测失败:', error);
        }
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
      <div style={{ 
        height: '100%', 
        display: 'flex', 
        flexDirection: 'column',
        alignItems: 'center', 
        justifyContent: 'center',
        color: colors.textTertiary
      }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>📝</div>
        <div style={{ fontSize: '16px', color: colors.textSecondary }}>请从左侧列表选择一个条目进行编辑</div>
        <div style={{ fontSize: '12px', marginTop: '8px', color: colors.textTertiary }}>或者点击工具栏的"打开"按钮导入 PO 文件</div>
      </div>
    );
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 工具栏 */}
      <div style={{ 
        padding: '8px 16px', 
        borderBottom: `1px solid ${colors.borderSecondary}`,
        background: colors.bgTertiary,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '8px'
      }}>
        <div style={{ fontSize: '12px', color: colors.textTertiary }}>
          {hasUnsavedChanges && (
            <span style={{ color: colors.statusUntranslated }}>● 有未保存的修改</span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Button 
            size="small" 
            icon={<CopyOutlined />}
            onClick={handleCopyOriginal}
          >
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
      <div style={{ 
        flex: 1, 
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* 原文区域 */}
        <div style={{ 
          flex: '0 0 40%',
          borderBottom: `1px solid ${colors.borderSecondary}`,
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{ 
            padding: '8px 16px',
            background: colors.bgTertiary,
            borderBottom: `1px solid ${colors.borderSecondary}`,
            fontSize: '12px',
            fontWeight: 500,
            color: colors.textSecondary
          }}>
            原文 (Source)
          </div>
          <div style={{ 
            flex: 1,
            padding: '12px 16px', 
            background: colors.bgTertiary,
            fontSize: '14px',
            lineHeight: '1.6',
            color: colors.textPrimary,
            overflowY: 'auto'
          }}>
            {entry.msgid || '(空)'}
            
            {/* 上下文和注释 */}
            {(entry.msgctxt || (entry.comments && entry.comments.length > 0)) && (
              <div style={{ marginTop: 16, paddingTop: 12, borderTop: `1px solid ${colors.borderSecondary}` }}>
                {entry.msgctxt && (
                  <div style={{ 
                    fontSize: '12px',
                    color: colors.statusUntranslated,
                    marginBottom: 8
                  }}>
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
        <div style={{ 
          flex: '1 1 60%',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{ 
            padding: '8px 16px',
            background: colors.bgTertiary,
            borderBottom: `1px solid ${colors.borderSecondary}`,
            fontSize: '12px',
            fontWeight: 500,
            color: colors.textSecondary
          }}>
            译文 (Translation)
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <TextArea
              value={translation}
              onChange={(e) => handleTranslationChange(e.target.value)}
              placeholder="请输入翻译内容..."
              bordered={false}
              style={{ 
                flex: 1,
                fontSize: '14px',
                lineHeight: '1.6',
                padding: '12px 16px',
                resize: 'none'
              }}
            />
          </div>
        </div>
      </div>

      {/* 状态栏 */}
      <div style={{ 
        padding: '6px 16px',
        borderTop: `1px solid ${colors.borderSecondary}`,
        background: colors.bgTertiary,
        fontSize: '12px',
        color: colors.textTertiary,
        display: 'flex',
        gap: '16px'
      }}>
        <span>行: {entry.line_start}</span>
        <span>字符: {translation.length}</span>
        <span>{translation ? '✓ 已翻译' : '○ 未翻译'}</span>
      </div>

      {/* 术语确认弹窗 */}
      {termModalVisible && detectedDifference && (
        <TermConfirmModal
          visible={termModalVisible}
          original={detectedDifference.original}
          aiTranslation={detectedDifference.aiTranslation}
          userTranslation={detectedDifference.userTranslation}
          difference={detectedDifference.difference}
          onConfirm={async (addToLibrary) => {
            if (addToLibrary) {
              try {
                const { invoke } = await import('@tauri-apps/api/tauri');
                await invoke('add_term_to_library', {
                  source: detectedDifference.original,
                  userTranslation: detectedDifference.userTranslation,
                  aiTranslation: detectedDifference.aiTranslation,
                  context: entry?.msgctxt || null,
                });
                
                // 检查是否需要生成风格总结
                const shouldUpdate = await invoke<boolean>('should_update_style_summary');
                if (shouldUpdate && apiKey) {
                  message.info('正在生成风格总结...', 1);
                  await invoke('generate_style_summary', { apiKey });
                  message.success('术语已添加，风格总结已更新');
                } else {
                  message.success('术语已添加到术语库');
                }
              } catch (error) {
                console.error('添加术语失败:', error);
                message.error('添加术语失败');
              }
            }
            setTermModalVisible(false);
            setDetectedDifference(null);
          }}
          onCancel={() => {
            setTermModalVisible(false);
            setDetectedDifference(null);
          }}
        />
      )}
    </div>
  );
};
