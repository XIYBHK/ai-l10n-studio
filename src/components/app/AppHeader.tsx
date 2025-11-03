/**
 * 应用顶部头部
 * 包含语言设置和文件信息
 */

import React from 'react';
import { Row, Col, Select, Space, Typography } from 'antd';
import { FileTextOutlined } from '@ant-design/icons';
import { useAppStore } from '../../store/useAppStore';

const { Text } = Typography;

interface AppHeaderProps {
  currentFilePath: string | null;
  sourceLanguage: string;
  targetLanguage: string;
  onTargetLanguageChange: (lang: string) => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  currentFilePath,
  sourceLanguage,
  targetLanguage,
  onTargetLanguageChange,
}) => {
  const { language, setLanguage } = useAppStore();

  const handleLanguageChange = async (value: string) => {
    try {
      setLanguage(value as any);
    } catch (error) {
      console.error('切换语言失败:', error);
    }
  };

  return (
    <div
      style={{
        padding: '8px 16px',
        borderBottom: '1px solid #f0f0f0',
        background: '#fff',
      }}
    >
      <Row align="middle" justify="space-between">
        <Col>
          <Space size="large">
            {currentFilePath ? (
              <Text strong>
                <FileTextOutlined style={{ marginRight: 8 }} />
                {currentFilePath.split(/[/\\]/).pop()}
              </Text>
            ) : (
              <Text type="secondary">未打开文件</Text>
            )}
          </Space>
        </Col>

        <Col>
          <Space size="middle">
            {/* 源语言和目标语言 */}
            <Space>
              <Text>源语言: {sourceLanguage || '未知'}</Text>
              <Text>→</Text>
              <Select
                value={targetLanguage}
                onChange={onTargetLanguageChange}
                style={{ width: 150 }}
                size="small"
              >
                <Select.Option value="zh-CN">简体中文</Select.Option>
                <Select.Option value="en-US">English</Select.Option>
                <Select.Option value="zh-TW">繁體中文</Select.Option>
                <Select.Option value="ja-JP">日本語</Select.Option>
                <Select.Option value="ko-KR">한국어</Select.Option>
                <Select.Option value="es-ES">Español</Select.Option>
                <Select.Option value="fr-FR">Français</Select.Option>
                <Select.Option value="de-DE">Deutsch</Select.Option>
                <Select.Option value="ru-RU">Русский</Select.Option>
                <Select.Option value="pt-PT">Português</Select.Option>
                <Select.Option value="ar-SA">العربية</Select.Option>
              </Select>
            </Space>

            {/* 应用语言 */}
            <Select
              value={language}
              onChange={handleLanguageChange}
              style={{ width: 120 }}
              size="small"
            >
              <Select.Option value="zh-CN">中文</Select.Option>
              <Select.Option value="en-US">English</Select.Option>
            </Select>
          </Space>
        </Col>
      </Row>
    </div>
  );
};

export default AppHeader;
