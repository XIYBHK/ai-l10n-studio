import React from 'react';
import { Button, Tooltip, Divider, Space, Typography } from 'antd';
import {
  FolderOpenOutlined,
  SaveOutlined,
  SettingOutlined,
  TranslationOutlined,
  BulbOutlined,
  BulbFilled,
  BugOutlined,
  GlobalOutlined,
} from '@ant-design/icons';
import { useTheme } from '../hooks/useTheme';
import { LanguageSelector } from './LanguageSelector';
import type { LanguageInfo } from '../types/generated/LanguageInfo'; // ✅ 使用生成的类型
import { useAppData } from '../hooks/useConfig';
import { useSupportedLanguages } from '../hooks/useLanguage';

const { Text } = Typography;

interface MenuBarProps {
  onOpenFile: () => void;
  onSaveFile: () => void;
  onSaveAsFile: () => void;
  onTranslateAll: () => void;
  onSettings: () => void;
  onDevTools?: () => void;
  // ⛔ 移除: apiKey 和 onApiKeyChange (使用 useAppData 统一获取)
  isTranslating: boolean;
  hasEntries: boolean;
  isDarkMode?: boolean;
  onThemeToggle?: () => void;
  // Phase 5: 语言选择
  sourceLanguage?: string;
  targetLanguage?: string;
  onTargetLanguageChange?: (langCode: string, langInfo: LanguageInfo | undefined) => void;
}

export const MenuBar: React.FC<MenuBarProps> = React.memo(({
  onOpenFile,
  onSaveFile,
  onSaveAsFile,
  onTranslateAll,
  onSettings,
  onDevTools,
  // ⛔ 移除: apiKey 参数
  isTranslating,
  hasEntries,
  isDarkMode = false,
  onThemeToggle,
  sourceLanguage,
  targetLanguage,
  onTargetLanguageChange,
}) => {
  const { colors } = useTheme();

  // ✅ 使用统一数据提供者获取AI配置状态
  const { activeAIConfig } = useAppData();

  // ✅ 获取支持的语言列表用于显示可读名称
  const { languages } = useSupportedLanguages();

  // 根据语言代码查找显示名称
  const getLanguageDisplayName = (code?: string) => {
    if (!code) return '';
    const lang = languages.find((l) => l.code === code);
    return lang ? lang.display_name : code;
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '12px 20px',
        background: colors.bgSecondary,
        borderBottom: `1px solid ${colors.borderPrimary}`,
        gap: '12px',
        height: '64px',
        boxShadow: isDarkMode ? 'none' : '0 1px 2px rgba(0,0,0,0.03)',
        zIndex: 10
      }}
    >
      <div
        style={{
          fontSize: '18px',
          fontWeight: 700,
          marginRight: '24px',
          color: colors.statusUntranslated,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          letterSpacing: '-0.5px'
        }}
      >
        <GlobalOutlined style={{fontSize: '24px', color: colors.statusUntranslated}} />
        <span style={{ color: colors.textPrimary }}>
          AI L10n Studio
        </span>
      </div>

      <Space size="small">
        <Tooltip title="打开 PO 文件 (Ctrl+O)">
          <Button icon={<FolderOpenOutlined />} onClick={onOpenFile}>
            打开
          </Button>
        </Tooltip>

        <Tooltip title="保存到原文件 (Ctrl+S)">
          <Button icon={<SaveOutlined />} onClick={onSaveFile} disabled={!hasEntries}>
            保存
          </Button>
        </Tooltip>

        <Tooltip title="另存为新文件">
          <Button onClick={onSaveAsFile} disabled={!hasEntries}>
            另存为
          </Button>
        </Tooltip>
      </Space>

      <Divider type="vertical" style={{ height: '24px', margin: '0 12px', borderColor: colors.borderSecondary }} />

      <Tooltip title="翻译所有未翻译条目">
        <Button
          type="primary"
          icon={<TranslationOutlined />}
          onClick={onTranslateAll}
          loading={isTranslating}
          disabled={!activeAIConfig || !hasEntries}
          style={{
            borderRadius: '6px',
            fontWeight: 500,
            padding: '4px 20px',
            height: '36px',
            boxShadow: '0 2px 4px rgba(59, 130, 246, 0.2)'
          }}
        >
          {isTranslating ? '翻译中...' : '批量翻译'}
        </Button>
      </Tooltip>

      {/* Phase 5: 语言选择器 */}
      {hasEntries && (
        <div style={{
            display: 'flex', 
            alignItems: 'center', 
            background: colors.bgTertiary, 
            padding: '4px 12px', 
            borderRadius: '6px',
            border: `1px solid ${colors.borderSecondary}`,
            marginLeft: '12px'
        }}>
            <GlobalOutlined style={{ fontSize: '16px', color: colors.textSecondary, marginRight: 8 }} />
            {sourceLanguage && (
              <Text strong style={{ fontSize: '13px', color: colors.textSecondary }}>
                {getLanguageDisplayName(sourceLanguage)}
              </Text>
            )}
            <Text type="secondary" style={{ fontSize: '13px', margin: '0 8px' }}>
              →
            </Text>
            <LanguageSelector
              value={targetLanguage}
              onChange={onTargetLanguageChange}
              placeholder="目标语言"
              disabled={isTranslating}
              style={{ width: 160 }}
            />
        </div>
      )}

      <div style={{ flex: 1 }} />

      {!activeAIConfig && (
        <div
          style={{
            padding: '6px 16px',
            background: isDarkMode ? 'rgba(250, 173, 20, 0.15)' : '#fff7e6',
            border: `1px solid ${colors.statusNeedsReview}`,
            borderRadius: '20px',
            fontSize: '12px',
            fontWeight: 500,
            color: colors.statusNeedsReview,
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <BulbFilled />
          请先配置 AI 服务
        </div>
      )}

      <Space size={4}>
        {onThemeToggle && (
            <Tooltip title={isDarkMode ? '切换到亮色模式' : '切换到暗色模式'}>
            <Button
                icon={isDarkMode ? <BulbFilled /> : <BulbOutlined />}
                onClick={onThemeToggle}
                type="text"
                style={{color: colors.textSecondary}}
            />
            </Tooltip>
        )}

        <Tooltip title="设置">
            <Button 
                icon={<SettingOutlined />} 
                onClick={onSettings} 
                type="text"
                style={{color: colors.textSecondary}}
            />
        </Tooltip>
        
        {onDevTools && (
            <Tooltip title="调试日志">
            <Button icon={<BugOutlined />} onClick={onDevTools} type="text" style={{color: colors.textTertiary}} />
            </Tooltip>
        )}
      </Space>
    </div>
  );
});
