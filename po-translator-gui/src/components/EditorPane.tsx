import React, { useState, useEffect } from 'react';
import { Card, Input, Button, Typography, Space, message } from 'antd';
import { SaveOutlined, CopyOutlined, ReloadOutlined } from '@ant-design/icons';
import { POEntry } from '../types/tauri';
import { useAppStore } from '../store/useAppStore';
import { useTranslator } from '../hooks/useTranslator';

const { TextArea } = Input;
const { Title, Text } = Typography;

interface EditorPaneProps {
  entry: POEntry | null;
  onEntryUpdate: (index: number, updates: Partial<POEntry>) => void;
}

export const EditorPane: React.FC<EditorPaneProps> = ({
  entry,
  onEntryUpdate,
}) => {
  const [translation, setTranslation] = useState('');
  const [isAutoTranslating, setIsAutoTranslating] = useState(false);
  
  const { config, currentIndex } = useAppStore();
  const { translateEntry, isLoading } = useTranslator();

  useEffect(() => {
    if (entry) {
      setTranslation(entry.msgstr || '');
    }
  }, [entry]);

  const handleTranslationChange = (value: string) => {
    setTranslation(value);
    if (entry && currentIndex >= 0) {
      onEntryUpdate(currentIndex, { msgstr: value });
    }
  };

  const handleAutoTranslate = async () => {
    if (!entry || !entry.msgid || !config?.api_key) {
      message.warning('请先设置API密钥');
      return;
    }

    setIsAutoTranslating(true);
    try {
      const result = await translateEntry(entry.msgid, config.api_key);
      setTranslation(result);
      if (currentIndex >= 0) {
        onEntryUpdate(currentIndex, { msgstr: result });
      }
      message.success('自动翻译完成');
    } catch (error) {
      message.error('自动翻译失败');
    } finally {
      setIsAutoTranslating(false);
    }
  };

  const handleCopyOriginal = () => {
    if (entry?.msgid) {
      navigator.clipboard.writeText(entry.msgid);
      message.success('原文已复制到剪贴板');
    }
  };

  const handleCopyTranslation = () => {
    if (translation) {
      navigator.clipboard.writeText(translation);
      message.success('译文已复制到剪贴板');
    }
  };

  if (!entry) {
    return (
      <div style={{ 
        height: '100%',
        display: 'flex', 
        flexDirection: 'column',
        alignItems: 'center', 
        justifyContent: 'center',
        color: '#bfbfbf'
      }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>📝</div>
        <div style={{ fontSize: '16px' }}>请从左侧列表选择一个条目进行编辑</div>
        <div style={{ fontSize: '12px', marginTop: '8px' }}>或者点击工具栏的"打开"按钮导入 PO 文件</div>
      </div>
    );
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 工具栏 */}
      <div style={{ 
        padding: '12px 16px', 
        borderBottom: '1px solid #f0f0f0',
        background: '#fafafa',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <Title level={5} style={{ margin: 0 }}>翻译编辑器</Title>
        <Space>
          <Button 
            size="small" 
            icon={<ReloadOutlined />}
            onClick={handleAutoTranslate}
            loading={isAutoTranslating}
            disabled={!entry.msgid || !config?.api_key}
          >
            AI 翻译
          </Button>
        </Space>
      </div>

      {/* 编辑区域 */}
      <div style={{ 
        flex: 1, 
        overflow: 'auto',
        padding: '16px'
      }}>
        {/* 原文区域 */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            marginBottom: 8 
          }}>
            <Text strong style={{ fontSize: '13px', color: '#595959' }}>
              原文
            </Text>
            <Button 
              size="small" 
              type="text"
              icon={<CopyOutlined />}
              onClick={handleCopyOriginal}
            />
          </div>
          <div style={{ 
            padding: '12px 16px', 
            background: '#fafafa', 
            borderRadius: '4px',
            border: '1px solid #e8e8e8',
            minHeight: '50px',
            fontSize: '14px',
            lineHeight: '1.6',
            color: '#262626'
          }}>
            {entry.msgid || '(空)'}
          </div>
        </div>

        {/* 上下文 */}
        {entry.msgctxt && (
          <div style={{ marginBottom: 20 }}>
            <Text strong style={{ fontSize: '13px', color: '#595959', display: 'block', marginBottom: 8 }}>
              上下文
            </Text>
            <div style={{ 
              padding: '8px 12px', 
              background: '#e6f7ff', 
              borderRadius: '4px',
              border: '1px solid #bae7ff',
              fontSize: '12px',
              color: '#0050b3'
            }}>
              📌 {entry.msgctxt}
            </div>
          </div>
        )}

        {/* 注释 */}
        {entry.comments && entry.comments.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <Text strong style={{ fontSize: '13px', color: '#595959', display: 'block', marginBottom: 8 }}>
              注释
            </Text>
            <div style={{ 
              padding: '8px 12px', 
              background: '#fffbe6', 
              borderRadius: '4px',
              border: '1px solid #ffe58f',
              fontSize: '12px',
              color: '#ad6800'
            }}>
              {entry.comments.map((comment, index) => (
                <div key={index} style={{ marginBottom: index < entry.comments!.length - 1 ? '4px' : 0 }}>
                  💬 {comment}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 译文区域 */}
        <div>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            marginBottom: 8 
          }}>
            <Text strong style={{ fontSize: '13px', color: '#595959' }}>
              译文
            </Text>
            <Button 
              size="small" 
              type="text"
              icon={<CopyOutlined />}
              onClick={handleCopyTranslation}
              disabled={!translation}
            />
          </div>
          <TextArea
            value={translation}
            onChange={(e) => handleTranslationChange(e.target.value)}
            placeholder="请输入翻译内容..."
            autoSize={{ minRows: 4, maxRows: 12 }}
            style={{ 
              fontSize: '14px',
              lineHeight: '1.6'
            }}
          />
        </div>

        {/* 状态栏 */}
        <div style={{ 
          marginTop: 16, 
          padding: '8px 0',
          fontSize: '12px',
          color: '#8c8c8c',
          borderTop: '1px solid #f0f0f0',
          display: 'flex',
          gap: '16px'
        }}>
          <span>行号: {entry.line_start}</span>
          <span>字符: {translation.length}</span>
          <span>状态: {translation ? '✓ 已翻译' : '○ 未翻译'}</span>
        </div>
      </div>
    </div>
  );
};
