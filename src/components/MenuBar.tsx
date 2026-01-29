import React, { useMemo, memo } from 'react';
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
import { useCssColors } from '../hooks/useCssColors';
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
  isTranslating: boolean;
  hasEntries: boolean;
  isDarkMode?: boolean;
  onThemeToggle?: () => void;
  sourceLanguage?: string;
  targetLanguage?: string;
  onTargetLanguageChange?: (langCode: string, langInfo: LanguageInfo | undefined) => void;
}

export const MenuBar = memo(function MenuBar({
  onOpenFile,
  onSaveFile,
  onSaveAsFile,
  onTranslateAll,
  onSettings,
  onDevTools,
  isTranslating,
  hasEntries,
  isDarkMode = false,
  onThemeToggle,
  sourceLanguage,
  targetLanguage,
  onTargetLanguageChange,
}: MenuBarProps) {
  const { colors } = useTheme();
  const cssColors = useCssColors();

  const { activeAIConfig } = useAppData();
  const { languages } = useSupportedLanguages();

  // 根据语言代码查找显示名称
  const getLanguageDisplayName = (code?: string) => {
    if (!code) return '';
    const lang = languages.find((l) => l.code === code);
    return lang ? lang.display_name : code;
  };

  return (
    <div
      className="menu-bar-stagger"
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '12px 20px',
        backgroundColor: cssColors.bgSecondary,
        borderBottom: `1px solid ${cssColors.borderPrimary}`,
        gap: '12px',
        height: '64px',
        boxShadow: isDarkMode ? 'none' : '0 1px 2px rgba(0,0,0,0.03)',
        zIndex: 10,
      }}
    >
      <div
        style={{
          fontSize: '24px',
          fontWeight: 800,
          fontFamily: 'var(--display-font)',
          background: `linear-gradient(135deg, ${cssColors.brandPrimary} 0%, ${cssColors.brandSecondary} 100%)`,
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          marginRight: '24px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          letterSpacing: '-1px',
          flexShrink: 0,
          whiteSpace: 'nowrap',
          cursor: 'pointer',
          transition: `transform var(--theme-transition-duration) var(--theme-transition-timing)`,
          willChange: 'transform',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.02)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
        }}
      >
        <GlobalOutlined style={{ fontSize: '24px', color: cssColors.brandPrimary }} />
        <span>AI L10n Studio</span>
      </div>

      <Space size="small" style={{ flexShrink: 0 }}>
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

      <Divider
        orientation="vertical"
        style={{ height: '24px', margin: '0 12px', borderColor: cssColors.borderSecondary }}
      />

      <Tooltip title="翻译所有未翻译条目">
        <Button
          type="primary"
          icon={<TranslationOutlined />}
          onClick={onTranslateAll}
          loading={isTranslating}
          disabled={!activeAIConfig || !hasEntries}
          style={{
            borderRadius: '8px',
            fontWeight: 600,
            padding: '4px 20px',
            height: '36px',
            background: `linear-gradient(135deg, ${cssColors.brandPrimary} 0%, #b48edb 100%)`,
            border: 'none',
            boxShadow: '0 2px 8px rgba(203, 166, 247, 0.25)',
            transition: `transform var(--theme-transition-duration) var(--theme-transition-timing), box-shadow var(--theme-transition-duration) var(--theme-transition-timing)`,
            willChange: 'transform',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(203, 166, 247, 0.35)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 2px 8px rgba(203, 166, 247, 0.25)';
          }}
        >
          {isTranslating ? '翻译中...' : '批量翻译'}
        </Button>
      </Tooltip>

      {hasEntries && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            backgroundColor: cssColors.bgTertiary,
            padding: '4px 12px',
            borderRadius: '6px',
            border: `1px solid ${cssColors.borderSecondary}`,
            marginLeft: '12px',
            flexShrink: 0,
            whiteSpace: 'nowrap',
          }}
        >
          <GlobalOutlined
            style={{ fontSize: '16px', color: cssColors.textSecondary, marginRight: 8 }}
          />
          {sourceLanguage && (
            <Text strong style={{ fontSize: '13px', color: cssColors.textSecondary }}>
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
            border: `1px solid ${cssColors.statusNeedsReview}`,
            borderRadius: '20px',
            fontSize: '12px',
            fontWeight: 500,
            color: cssColors.statusNeedsReview,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
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
              style={{ color: cssColors.textSecondary }}
            />
          </Tooltip>
        )}

        <Tooltip title="设置">
          <Button
            icon={<SettingOutlined />}
            onClick={onSettings}
            type="text"
            style={{ color: cssColors.textSecondary }}
          />
        </Tooltip>

        {onDevTools && (
          <Tooltip title="调试日志">
            <Button
              icon={<BugOutlined />}
              onClick={onDevTools}
              type="text"
              style={{ color: cssColors.textTertiary }}
            />
          </Tooltip>
        )}
      </Space>
    </div>
  );
});
