import { memo, useState, useEffect, CSSProperties } from 'react';
import { Tooltip, Divider, Typography } from 'antd';
import {
  FolderOpenOutlined,
  SaveOutlined,
  SettingOutlined,
  TranslationOutlined,
  BulbOutlined,
  BulbFilled,
  BugOutlined,
  GlobalOutlined,
  ArrowRightOutlined,
  StopOutlined,
} from '@ant-design/icons';
import { CSS_COLORS } from '../hooks/useCssColors';
import { ActionButton, InfoCard } from './ui';
import { LanguageSelector } from './LanguageSelector';
import type { LanguageInfo } from '../types/generated/LanguageInfo';
import { useAppData } from '../hooks/useConfig';
import { useSupportedLanguages } from '../hooks/useLanguage';

const { Text } = Typography;

// 容器高度常量
const MENU_HEIGHT = '48px';
const MENU_PADDING_X = 'var(--space-4)'; // 16px
const MENU_GAP = 'var(--space-3)'; // 12px

// ==================== Props Interfaces ====================

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
  onCancelTranslation?: () => void;
}

interface LogoSectionProps {
  compact?: boolean;
}

interface FileActionsProps {
  onOpenFile: () => void;
  onSaveFile: () => void;
  onSaveAsFile: () => void;
  hasEntries: boolean;
  compact?: boolean;
}

interface TranslateActionProps {
  onTranslateAll: () => void;
  isTranslating: boolean;
  hasEntries: boolean;
  hasAIConfig: boolean;
  onCancelTranslation?: () => void;
}

interface LanguageSelectorSectionProps {
  sourceLanguage?: string;
  targetLanguage?: string;
  onTargetLanguageChange?: (langCode: string, langInfo: LanguageInfo | undefined) => void;
  hasEntries: boolean;
  isTranslating: boolean;
  compact?: boolean;
}

interface SystemActionsProps {
  isDarkMode: boolean;
  onThemeToggle?: () => void;
  onSettings: () => void;
  onDevTools?: () => void;
}

// ==================== Sub Components ====================

/**
 * Logo区域 - 简化渐变，移除复杂动画
 */
const LogoSection = memo(function LogoSection({ compact }: LogoSectionProps) {
  return (
    <div
      style={{
        fontSize: compact ? '20px' : '22px',
        fontWeight: 800,
        fontFamily: 'var(--display-font)',
        background: CSS_COLORS.brandPrimary,
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
        marginRight: 'var(--space-4)',
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-2)',
        letterSpacing: '-0.5px',
        flexShrink: 0,
        whiteSpace: 'nowrap',
        cursor: 'pointer',
        transition: 'opacity var(--duration-base) ease',
      }}
    >
      <GlobalOutlined
        style={{ fontSize: compact ? '20px' : '22px', color: CSS_COLORS.brandPrimary }}
      />
      <span>{compact ? 'AI L10n' : 'AI L10n Studio'}</span>
    </div>
  );
});

/**
 * 文件操作按钮组
 */
const FileActions = memo(function FileActions({
  onOpenFile,
  onSaveFile,
  onSaveAsFile,
  hasEntries,
  compact,
}: FileActionsProps) {
  return (
    <div
      style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}
      role="group"
      aria-label="文件操作"
    >
      <Tooltip title="打开 PO 文件 (Ctrl+O)">
        <ActionButton
          variant="ghost"
          size="small"
          icon={<FolderOpenOutlined />}
          onClick={onOpenFile}
          aria-label="打开 PO 文件 (Ctrl+O)"
        >
          {!compact && '打开'}
        </ActionButton>
      </Tooltip>

      <Tooltip title="保存到原文件 (Ctrl+S)">
        <ActionButton
          variant="ghost"
          size="small"
          icon={<SaveOutlined />}
          onClick={onSaveFile}
          disabled={!hasEntries}
          aria-label={hasEntries ? '保存到原文件 (Ctrl+S)' : '保存（请先打开文件）'}
          aria-disabled={!hasEntries}
        >
          {!compact && '保存'}
        </ActionButton>
      </Tooltip>

      <Tooltip title="另存为新文件">
        <ActionButton
          variant="ghost"
          size="small"
          onClick={onSaveAsFile}
          disabled={!hasEntries}
          aria-label={hasEntries ? '另存为新文件' : '另存为（请先打开文件）'}
          aria-disabled={!hasEntries}
        >
          {!compact && '另存为'}
        </ActionButton>
      </Tooltip>
    </div>
  );
});

/**
 * 翻译主按钮 - 更突出的视觉层次
 */
const TranslateAction = memo(function TranslateAction({
  onTranslateAll,
  isTranslating,
  hasEntries,
  hasAIConfig,
  onCancelTranslation,
}: TranslateActionProps) {
  const getAriaLabel = () => {
    if (!hasAIConfig) return '批量翻译（请先配置 AI 服务）';
    if (!hasEntries) return '批量翻译（请先打开文件）';
    if (isTranslating) return '停止翻译';
    return '批量翻译所有未翻译条目';
  };

  return (
    <Tooltip title={!hasAIConfig ? '请先配置 AI 服务' : isTranslating ? '停止翻译' : '翻译所有未翻译条目'}>
      <ActionButton
        variant={isTranslating ? 'secondary' : 'primary'}
        size="small"
        icon={isTranslating ? <StopOutlined /> : <TranslationOutlined />}
        onClick={isTranslating ? onCancelTranslation : onTranslateAll}
        disabled={!hasAIConfig || !hasEntries}
        aria-label={getAriaLabel()}
        aria-disabled={!hasAIConfig || !hasEntries}
        aria-busy={isTranslating}
        danger={isTranslating}
        style={{
          backgroundColor: isTranslating ? undefined : CSS_COLORS.brandPrimary,
          borderColor: isTranslating ? undefined : CSS_COLORS.brandPrimary,
          boxShadow: isTranslating
            ? undefined
            : '0 2px 8px rgba(139, 92, 246, 0.25)',
          fontWeight: 600,
        }}
      >
        {isTranslating ? '停止翻译' : '批量翻译'}
      </ActionButton>
    </Tooltip>
  );
});

/**
 * 语言选择区域 - 统一输入框样式
 */
const LanguageSelectorSection = memo(function LanguageSelectorSection({
  sourceLanguage,
  targetLanguage,
  onTargetLanguageChange,
  hasEntries,
  isTranslating,
  compact,
}: LanguageSelectorSectionProps) {
  const { languages } = useSupportedLanguages();

  const getLanguageDisplayName = (code?: string) => {
    if (!code) return '';
    const lang = languages.find((l) => l.code === code);
    return lang ? lang.display_name : code;
  };

  if (!hasEntries) return null;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        backgroundColor: CSS_COLORS.bgTertiary,
        padding: 'var(--space-1) var(--space-3)',
        borderRadius: 'var(--radius-md)',
        border: `1px solid ${CSS_COLORS.borderSecondary}`,
        flexShrink: 0,
        whiteSpace: 'nowrap',
        gap: 'var(--space-2)',
      }}
    >
      {sourceLanguage && (
        <Text strong style={{ fontSize: 'var(--font-size-sm)', color: CSS_COLORS.textSecondary }}>
          {compact ? sourceLanguage : getLanguageDisplayName(sourceLanguage)}
        </Text>
      )}

      <ArrowRightOutlined
        style={{
          fontSize: 'var(--font-size-sm)',
          color: CSS_COLORS.textTertiary,
        }}
      />

      <LanguageSelector
        value={targetLanguage}
        onChange={onTargetLanguageChange}
        placeholder={compact ? '目标' : '目标语言'}
        disabled={isTranslating}
        style={{ width: compact ? 100 : 140 }}
      />
    </div>
  );
});

/**
 * 系统操作按钮组（主题、设置、调试）
 */
const SystemActions = memo(function SystemActions({
  isDarkMode,
  onThemeToggle,
  onSettings,
  onDevTools,
}: SystemActionsProps) {
  return (
    <div
      style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}
      role="group"
      aria-label="系统操作"
    >
      {onThemeToggle && (
        <Tooltip title={isDarkMode ? '切换到亮色模式' : '切换到暗色模式'}>
          <ActionButton
            variant="text"
            size="small"
            icon={isDarkMode ? <BulbFilled /> : <BulbOutlined />}
            onClick={onThemeToggle}
            aria-label={isDarkMode ? '切换到亮色模式' : '切换到暗色模式'}
            aria-pressed={isDarkMode}
            style={{ color: CSS_COLORS.textSecondary }}
          />
        </Tooltip>
      )}

      <Tooltip title="设置">
        <ActionButton
          variant="text"
          size="small"
          icon={<SettingOutlined />}
          onClick={onSettings}
          aria-label="打开设置"
          style={{ color: CSS_COLORS.textSecondary }}
        />
      </Tooltip>

      {onDevTools && (
        <Tooltip title="调试日志">
          <ActionButton
            variant="text"
            size="small"
            icon={<BugOutlined />}
            onClick={onDevTools}
            aria-label="打开调试日志"
            style={{ color: CSS_COLORS.textTertiary }}
          />
        </Tooltip>
      )}
    </div>
  );
});

/**
 * AI配置提示 - 使用InfoCard组件
 */
const AIConfigPrompt = memo(function AIConfigPrompt({ isDarkMode }: { isDarkMode?: boolean }) {
  return (
    <div style={{ flexShrink: 0 }}>
      <InfoCard
        type="warning"
        icon={<BulbFilled />}
        description="请先配置 AI 服务"
        style={{
          padding: 'var(--space-2) var(--space-3)',
          fontSize: 'var(--font-size-xs)',
          borderRadius: 'var(--radius-lg)',
          backgroundColor: isDarkMode ? 'rgba(250, 173, 20, 0.15)' : '#fff7e6',
          border: `1px solid ${CSS_COLORS.statusNeedsReview}`,
        }}
      />
    </div>
  );
});

// ==================== Main Component ====================

// 用于监听窗口宽度
function useWindowWidth() {
  const [width, setWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024);

  useEffect(() => {
    const handleResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return width;
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
  onCancelTranslation,
}: MenuBarProps) {
  const { activeAIConfig } = useAppData();
  const windowWidth = useWindowWidth();

  // 响应式断点
  const isCompact = windowWidth < 1024;
  const isMinimal = windowWidth < 768;

  const containerStyles: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    padding: `0 ${MENU_PADDING_X}`,
    backgroundColor: CSS_COLORS.bgSecondary,
    borderBottom: `1px solid ${CSS_COLORS.borderPrimary}`,
    gap: MENU_GAP,
    height: MENU_HEIGHT,
    boxShadow: isDarkMode ? 'none' : '0 1px 2px rgba(0,0,0,0.03)',
    zIndex: 10,
  };

  // 紧凑模式下的简化布局
  if (isMinimal) {
    return (
      <nav style={containerStyles} aria-label="主菜单">
        <LogoSection compact />

        <div
          style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}
          role="group"
          aria-label="文件操作"
        >
          <Tooltip title="打开 PO 文件 (Ctrl+O)">
            <ActionButton
              variant="ghost"
              size="small"
              icon={<FolderOpenOutlined />}
              onClick={onOpenFile}
              aria-label="打开 PO 文件 (Ctrl+O)"
            />
          </Tooltip>

          <Tooltip title="保存 (Ctrl+S)">
            <ActionButton
              variant="ghost"
              size="small"
              icon={<SaveOutlined />}
              onClick={onSaveFile}
              disabled={!hasEntries}
              aria-label={hasEntries ? '保存 (Ctrl+S)' : '保存（请先打开文件）'}
              aria-disabled={!hasEntries}
            />
          </Tooltip>
        </div>

        <Tooltip title={!activeAIConfig ? '请先配置 AI 服务' : isTranslating ? '停止翻译' : '批量翻译'}>
          <ActionButton
            variant={isTranslating ? 'secondary' : 'primary'}
            size="small"
            icon={isTranslating ? <StopOutlined /> : <TranslationOutlined />}
            onClick={isTranslating ? onCancelTranslation : onTranslateAll}
            disabled={!activeAIConfig || !hasEntries}
            danger={isTranslating}
            aria-label={
              !activeAIConfig
                ? '批量翻译（请先配置 AI 服务）'
                : !hasEntries
                  ? '批量翻译（请先打开文件）'
                  : isTranslating
                    ? '停止翻译'
                    : '批量翻译所有未翻译条目'
            }
            aria-disabled={!activeAIConfig || !hasEntries}
            aria-busy={isTranslating}
          />
        </Tooltip>

        <div style={{ flex: 1 }} />

        {!activeAIConfig && (
          <BulbFilled
            style={{ color: CSS_COLORS.statusNeedsReview }}
            aria-label="请先配置 AI 服务"
          />
        )}

        <SystemActions
          isDarkMode={isDarkMode}
          onThemeToggle={onThemeToggle}
          onSettings={onSettings}
          onDevTools={onDevTools}
        />
      </nav>
    );
  }

  return (
    <nav style={containerStyles} aria-label="主菜单">
      {/* Logo */}
      <LogoSection compact={isCompact} />

      {/* 文件操作 */}
      <FileActions
        onOpenFile={onOpenFile}
        onSaveFile={onSaveFile}
        onSaveAsFile={onSaveAsFile}
        hasEntries={hasEntries}
        compact={isCompact}
      />

      {/* 分隔线 */}
      <Divider
        type="vertical"
        style={{
          height: '20px',
          margin: '0',
          borderColor: CSS_COLORS.borderSecondary,
        }}
      />

      {/* 翻译按钮 */}
      <TranslateAction
        onTranslateAll={onTranslateAll}
        isTranslating={isTranslating}
        hasEntries={hasEntries}
        hasAIConfig={!!activeAIConfig}
        onCancelTranslation={onCancelTranslation}
      />

      {/* 语言选择器 */}
      <LanguageSelectorSection
        sourceLanguage={sourceLanguage}
        targetLanguage={targetLanguage}
        onTargetLanguageChange={onTargetLanguageChange}
        hasEntries={hasEntries}
        isTranslating={isTranslating}
        compact={isCompact}
      />

      <div style={{ flex: 1 }} />

      {/* AI配置提示 */}
      {!activeAIConfig && !isCompact && <AIConfigPrompt isDarkMode={isDarkMode} />}
      {!activeAIConfig && isCompact && (
        <Tooltip title="请先配置 AI 服务">
          <BulbFilled style={{ color: CSS_COLORS.statusNeedsReview, fontSize: '16px' }} />
        </Tooltip>
      )}

      {/* 系统操作 */}
      <SystemActions
        isDarkMode={isDarkMode}
        onThemeToggle={onThemeToggle}
        onSettings={onSettings}
        onDevTools={onDevTools}
      />
    </nav>
  );
});

export default MenuBar;
