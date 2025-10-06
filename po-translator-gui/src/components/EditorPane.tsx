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
      <Card style={{ height: '100%' }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          height: '100%',
          color: '#999'
        }}>
          请选择一个条目进行编辑
        </div>
      </Card>
    );
  }

  return (
    <Card 
      title={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Title level={4} style={{ margin: 0 }}>翻译编辑器</Title>
          <Space>
            <Button 
              size="small" 
              icon={<ReloadOutlined />}
              onClick={handleAutoTranslate}
              loading={isAutoTranslating}
              disabled={!entry.msgid || !config?.api_key}
            >
              自动翻译
            </Button>
            <Button 
              size="small" 
              icon={<SaveOutlined />}
              type="primary"
            >
              保存
            </Button>
          </Space>
        </div>
      }
      style={{ height: '100%' }}
    >
      <div style={{ height: 'calc(100% - 60px)', overflow: 'auto' }}>
        {/* 原文区域 */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <Text strong>原文 (msgid)</Text>
            <Button 
              size="small" 
              icon={<CopyOutlined />}
              onClick={handleCopyOriginal}
            >
              复制
            </Button>
          </div>
          <div style={{ 
            padding: '12px', 
            background: '#f5f5f5', 
            borderRadius: '6px',
            border: '1px solid #d9d9d9',
            minHeight: '60px',
            fontSize: '14px',
            lineHeight: '1.5'
          }}>
            {entry.msgid || '(空)'}
          </div>
        </div>

        {/* 上下文区域 */}
        {entry.msgctxt && (
          <div style={{ marginBottom: 24 }}>
            <Text strong style={{ marginBottom: 8, display: 'block' }}>上下文 (msgctxt)</Text>
            <div style={{ 
              padding: '8px 12px', 
              background: '#e6f7ff', 
              borderRadius: '6px',
              border: '1px solid #91d5ff',
              fontSize: '12px',
              color: '#666'
            }}>
              {entry.msgctxt}
            </div>
          </div>
        )}

        {/* 注释区域 */}
        {entry.comments && entry.comments.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <Text strong style={{ marginBottom: 8, display: 'block' }}>注释</Text>
            <div style={{ 
              padding: '8px 12px', 
              background: '#fff7e6', 
              borderRadius: '6px',
              border: '1px solid #ffd591',
              fontSize: '12px',
              color: '#666'
            }}>
              {entry.comments.map((comment, index) => (
                <div key={index}>{comment}</div>
              ))}
            </div>
          </div>
        )}

        {/* 译文区域 */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <Text strong>译文 (msgstr)</Text>
            <Button 
              size="small" 
              icon={<CopyOutlined />}
              onClick={handleCopyTranslation}
              disabled={!translation}
            >
              复制
            </Button>
          </div>
          <TextArea
            value={translation}
            onChange={(e) => handleTranslationChange(e.target.value)}
            placeholder="输入翻译..."
            rows={6}
            style={{ 
              fontSize: '14px',
              lineHeight: '1.5'
            }}
          />
        </div>

        {/* 行号信息 */}
        <div style={{ 
          marginTop: 16, 
          padding: '8px 12px', 
          background: '#fafafa', 
          borderRadius: '4px',
          fontSize: '12px',
          color: '#666',
          textAlign: 'center'
        }}>
          行号: {entry.line_start}
        </div>
      </div>
    </Card>
  );
};
