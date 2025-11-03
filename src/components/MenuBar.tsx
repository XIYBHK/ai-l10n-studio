import { Button, Tooltip, Divider, Space, Typography } from 'antd';
import {
  FolderOpenOutlined,
  SaveOutlined,
  SettingOutlined,
  TranslationOutlined,
  BulbOutlined,
  BulbFilled,
  BugOutlined,
  CodeOutlined,
  GlobalOutlined,
} from '@ant-design/icons';
import { useTheme } from '../hooks/useTheme';
import { LanguageSelector } from './LanguageSelector';
import type { LanguageInfo } from '../types/generated/LanguageInfo'; // ✅ 使用生成的类型
import { useAppData } from '../hooks/useConfig';

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

export const MenuBar: React.FC<MenuBarProps> = ({
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

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '8px 16px',
        background: colors.bgTertiary,
        borderBottom: `1px solid ${colors.borderPrimary}`,
        gap: '8px',
      }}
    >
      <div
        style={{
          fontSize: '16px',
          fontWeight: 600,
          marginRight: '16px',
          color: colors.statusUntranslated,
        }}
      >
        🌐 PO 翻译工具
      </div>

      <Tooltip title="打开 PO 文件 (Ctrl+O)">
        <Button icon={<FolderOpenOutlined />} onClick={onOpenFile} size="middle">
          打开
        </Button>
      </Tooltip>

      <Tooltip title="保存到原文件 (Ctrl+S)">
        <Button icon={<SaveOutlined />} onClick={onSaveFile} disabled={!hasEntries} size="middle">
          保存
        </Button>
      </Tooltip>

      <Tooltip title="另存为新文件">
        <Button icon={<SaveOutlined />} onClick={onSaveAsFile} disabled={!hasEntries} size="middle">
          另存为
        </Button>
      </Tooltip>

      <Divider type="vertical" style={{ height: '24px', margin: '0 8px' }} />

      <Tooltip title="翻译所有未翻译条目">
        <Button
          type="primary"
          icon={<TranslationOutlined />}
          onClick={onTranslateAll}
          loading={isTranslating}
          disabled={!activeAIConfig || !hasEntries}
          size="middle"
        >
          {isTranslating ? '翻译中...' : '批量翻译'}
        </Button>
      </Tooltip>

      {/* Phase 5: 语言选择器 */}
      {hasEntries && (
        <>
          <Divider type="vertical" style={{ height: '24px', margin: '0 8px' }} />
          <Space size="small" align="center">
            <GlobalOutlined style={{ fontSize: '16px', color: colors.textSecondary }} />
            {sourceLanguage && (
              <Text type="secondary" style={{ fontSize: '13px' }}>
                {sourceLanguage}
              </Text>
            )}
            <Text type="secondary" style={{ fontSize: '13px' }}>
              →
            </Text>
            <LanguageSelector
              value={targetLanguage}
              onChange={onTargetLanguageChange}
              placeholder="目标语言"
              disabled={isTranslating}
              style={{ width: 180 }}
            />
          </Space>
        </>
      )}

      <div style={{ flex: 1 }} />

      {onThemeToggle && (
        <Tooltip title={isDarkMode ? '切换到亮色模式' : '切换到暗色模式'}>
          <Button
            icon={isDarkMode ? <BulbFilled /> : <BulbOutlined />}
            onClick={onThemeToggle}
            size="middle"
            type="text"
          />
        </Tooltip>
      )}

      {onDevTools && (
        <Tooltip title="后端日志 - 查看Rust翻译引擎日志">
          <Button icon={<BugOutlined />} onClick={onDevTools} size="middle" type="text" />
        </Tooltip>
      )}

      <Tooltip title="前端日志 - 按 F12 打开浏览器开发者工具">
        <Button
          icon={<CodeOutlined />}
          onClick={() => {
            // 仅日志提示，避免阻塞弹窗
            console.info('[DevTools] 按 F12 打开开发者工具，或右键 → 检查 → Console');
          }}
          size="middle"
          type="text"
        />
      </Tooltip>

      <Tooltip title="设置 API 密钥和翻译选项">
        <Button icon={<SettingOutlined />} onClick={onSettings} size="middle">
          设置
        </Button>
      </Tooltip>

      {!activeAIConfig && (
        <div
          style={{
            padding: '4px 12px',
            background: isDarkMode ? 'rgba(250, 173, 20, 0.15)' : '#fff7e6',
            border: `1px solid ${colors.statusNeedsReview}`,
            borderRadius: '4px',
            fontSize: '12px',
            color: colors.statusNeedsReview,
          }}
        >
          ⚠️ 请先在设置中配置 AI 服务
        </div>
      )}
    </div>
  );
};
