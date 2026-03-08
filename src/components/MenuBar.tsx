import { memo, useState, useEffect, CSSProperties } from 'react';
import { Tooltip, Typography } from 'antd';
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

// 瀹瑰櫒楂樺害甯搁噺
const MENU_HEIGHT = '56px';
const MENU_PADDING_X = 'var(--space-5)';
const MENU_GAP = 'var(--space-4)';

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
 * Logo鍖哄煙 - 绠€鍖栨笎鍙橈紝绉婚櫎澶嶆潅鍔ㄧ敾
 */
const LogoSection = memo(function LogoSection({ compact }: LogoSectionProps) {
  return (
    <div
      style={{
        fontSize: compact ? '18px' : '20px',
        fontWeight: 700,
        fontFamily: 'var(--display-font)',
        color: CSS_COLORS.brandPrimary,
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-2)',
        letterSpacing: '-0.02em',
        flexShrink: 0,
        whiteSpace: 'nowrap',
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
 * 鏂囦欢鎿嶄綔鎸夐挳缁?
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
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-2)',
        padding: 'var(--space-1)',
        backgroundColor: CSS_COLORS.bgTertiary,
        border: `1px solid ${CSS_COLORS.borderSecondary}`,
        borderRadius: 'var(--radius-full)',
      }}
      role="group"
      aria-label="鏂囦欢鎿嶄綔"
    >
      <Tooltip title="鎵撳紑 PO 鏂囦欢 (Ctrl+O)">
        <ActionButton
          variant="ghost"
          size="small"
          icon={<FolderOpenOutlined />}
          onClick={onOpenFile}
          aria-label="鎵撳紑 PO 鏂囦欢 (Ctrl+O)"
        >
          {!compact && '鎵撳紑'}
        </ActionButton>
      </Tooltip>

      <Tooltip title="淇濆瓨鍒板師鏂囦欢 (Ctrl+S)">
        <ActionButton
          variant="ghost"
          size="small"
          icon={<SaveOutlined />}
          onClick={onSaveFile}
          disabled={!hasEntries}
          aria-label={hasEntries ? '保存到原文件 (Ctrl+S)' : '保存（请先打开文件）'}
          aria-disabled={!hasEntries}
        >
          {!compact && '淇濆瓨'}
        </ActionButton>
      </Tooltip>

      <Tooltip title="鍙﹀瓨涓烘柊鏂囦欢">
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
 * 缈昏瘧涓绘寜閽?- 鏇寸獊鍑虹殑瑙嗚灞傛
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
    if (isTranslating) return '鍋滄缈昏瘧';
    return '鎵归噺缈昏瘧鎵€鏈夋湭缈昏瘧鏉＄洰';
  };

  return (
    <Tooltip
      title={
        !hasAIConfig
          ? '璇峰厛閰嶇疆 AI 鏈嶅姟'
          : isTranslating
            ? '鍋滄缈昏瘧'
            : '缈昏瘧鎵€鏈夋湭缈昏瘧鏉＄洰'
      }
    >
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
          boxShadow: isTranslating ? undefined : '0 2px 8px rgba(139, 92, 246, 0.25)',
          fontWeight: 600,
        }}
      >
        {isTranslating ? '鍋滄缈昏瘧' : '鎵归噺缈昏瘧'}
      </ActionButton>
    </Tooltip>
  );
});

/**
 * 璇█閫夋嫨鍖哄煙 - 缁熶竴杈撳叆妗嗘牱寮?
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
        borderRadius: 'var(--radius-full)',
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
        placeholder={compact ? '鐩爣' : '鐩爣璇█'}
        disabled={isTranslating}
        style={{ width: compact ? 100 : 140 }}
      />
    </div>
  );
});

/**
 * 绯荤粺鎿嶄綔鎸夐挳缁勶紙涓婚銆佽缃€佽皟璇曪級
 */
const SystemActions = memo(function SystemActions({
  isDarkMode,
  onThemeToggle,
  onSettings,
  onDevTools,
}: SystemActionsProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-1)',
        padding: 'var(--space-1)',
        backgroundColor: CSS_COLORS.bgTertiary,
        border: `1px solid ${CSS_COLORS.borderSecondary}`,
        borderRadius: 'var(--radius-full)',
      }}
      role="group"
      aria-label="绯荤粺鎿嶄綔"
    >
      {onThemeToggle && (
        <Tooltip title={isDarkMode ? '切换到亮色模式' : '切换到暗色模式'}>
          <ActionButton
            variant="text"
            size="small"
            icon={isDarkMode ? <BulbFilled /> : <BulbOutlined />}
            onClick={onThemeToggle}
            data-testid="menu-theme-toggle"
            aria-label={isDarkMode ? '切换到亮色模式' : '切换到暗色模式'}
            aria-pressed={isDarkMode}
            style={{ color: CSS_COLORS.textSecondary }}
          />
        </Tooltip>
      )}

      <Tooltip title="璁剧疆">
        <ActionButton
          variant="text"
          size="small"
          icon={<SettingOutlined />}
          onClick={onSettings}
          data-testid="menu-settings-button"
          aria-label="鎵撳紑璁剧疆"
          style={{ color: CSS_COLORS.textSecondary }}
        />
      </Tooltip>

      {onDevTools && (
        <Tooltip title="璋冭瘯鏃ュ織">
          <ActionButton
            variant="text"
            size="small"
            icon={<BugOutlined />}
            onClick={onDevTools}
            aria-label="鎵撳紑璋冭瘯鏃ュ織"
            style={{ color: CSS_COLORS.textTertiary }}
          />
        </Tooltip>
      )}
    </div>
  );
});

/**
 * AI閰嶇疆鎻愮ず - 浣跨敤InfoCard缁勪欢
 */
const AIConfigPrompt = memo(function AIConfigPrompt({ isDarkMode }: { isDarkMode?: boolean }) {
  return (
    <div style={{ flexShrink: 0 }}>
      <InfoCard
        type="warning"
        icon={<BulbFilled />}
        description="璇峰厛閰嶇疆 AI 鏈嶅姟"
        style={{
          padding: 'var(--space-2) var(--space-3)',
          fontSize: 'var(--font-size-sm)',
          borderRadius: 'var(--radius-full)',
          backgroundColor: isDarkMode ? 'rgba(250, 173, 20, 0.12)' : 'rgba(250, 173, 20, 0.10)',
          border: `1px solid ${CSS_COLORS.statusNeedsReview}`,
        }}
      />
    </div>
  );
});

// ==================== Main Component ====================

// 鐢ㄤ簬鐩戝惉绐楀彛瀹藉害
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

  // 鍝嶅簲寮忔柇鐐?
  const isCompact = windowWidth < 1280;
  const isMinimal = windowWidth < 900;

  const containerStyles: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    padding: `0 ${MENU_PADDING_X}`,
    backgroundColor: CSS_COLORS.bgPrimary,
    borderBottom: `1px solid ${CSS_COLORS.borderSecondary}`,
    gap: MENU_GAP,
    height: MENU_HEIGHT,
    boxShadow: 'none',
    zIndex: 10,
  };

  // 绱у噾妯″紡涓嬬殑绠€鍖栧竷灞€
  if (isMinimal) {
    return (
      <nav style={containerStyles} aria-label="主菜单">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', minWidth: 0 }}>
          <LogoSection compact />
          <FileActions
            onOpenFile={onOpenFile}
            onSaveFile={onSaveFile}
            onSaveAsFile={onSaveAsFile}
            hasEntries={hasEntries}
            compact
          />
        </div>

        <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
          <TranslateAction
            onTranslateAll={onTranslateAll}
            isTranslating={isTranslating}
            hasEntries={hasEntries}
            hasAIConfig={!!activeAIConfig}
            onCancelTranslation={onCancelTranslation}
          />
        </div>

        <SystemActions
          isDarkMode={isDarkMode}
          onThemeToggle={onThemeToggle}
          onSettings={onSettings}
          onDevTools={undefined}
        />
      </nav>
    );
  }

  return (
    <nav style={containerStyles} aria-label="主菜单">
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', minWidth: 0 }}>
        <LogoSection compact={isCompact} />
        <FileActions
          onOpenFile={onOpenFile}
          onSaveFile={onSaveFile}
          onSaveAsFile={onSaveAsFile}
          hasEntries={hasEntries}
          compact={isCompact}
        />
      </div>

      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 'var(--space-3)',
          minWidth: 0,
        }}
      >
        <TranslateAction
          onTranslateAll={onTranslateAll}
          isTranslating={isTranslating}
          hasEntries={hasEntries}
          hasAIConfig={!!activeAIConfig}
          onCancelTranslation={onCancelTranslation}
        />

        <LanguageSelectorSection
          sourceLanguage={sourceLanguage}
          targetLanguage={targetLanguage}
          onTargetLanguageChange={onTargetLanguageChange}
          hasEntries={hasEntries}
          isTranslating={isTranslating}
          compact={isCompact}
        />
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 'var(--space-3)',
          minWidth: 0,
        }}
      >
        {!activeAIConfig && !isCompact && <AIConfigPrompt isDarkMode={isDarkMode} />}
        {!activeAIConfig && isCompact && (
          <Tooltip title="璇峰厛閰嶇疆 AI 鏈嶅姟">
            <BulbFilled style={{ color: CSS_COLORS.statusNeedsReview, fontSize: '16px' }} />
          </Tooltip>
        )}

        <SystemActions
          isDarkMode={isDarkMode}
          onThemeToggle={onThemeToggle}
          onSettings={onSettings}
          onDevTools={onDevTools}
        />
      </div>
    </nav>
  );
});

export default MenuBar;
