import { memo, useCallback, useEffect, useState } from 'react';
import { Dropdown, Tooltip, Typography } from 'antd';
import type { MenuProps } from 'antd';
import {
  ArrowRightOutlined,
  BugOutlined,
  BulbFilled,
  BulbOutlined,
  FileAddOutlined,
  GlobalOutlined,
  MoreOutlined,
  SaveOutlined,
  SettingOutlined,
  StopOutlined,
  TranslationOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useActiveAIConfig } from '../hooks/useConfig';
import { useSupportedLanguages } from '../hooks/useLanguage';
import { useTheme } from '../hooks/useTheme';
import { useSourceLanguage, useTargetLanguage } from '../store';
import type { LanguageInfo } from '../types/generated/LanguageInfo';
import { createModuleLogger } from '../utils/logger';
import { ActionButton } from './ui';
import { LanguageSelector } from './LanguageSelector';
import styles from './MenuBar.module.css';
const { Text } = Typography;
const log = createModuleLogger('MenuBar');
interface MenuBarProps {
  onOpenFile: () => void;
  onSaveFile: () => void;
  onSaveAsFile: () => void;
  onTranslateAll: () => void;
  onSettings: () => void;
  onDevTools?: () => void;
  isTranslating: boolean;
  hasEntries: boolean;
  onCancelTranslation?: () => void;
  onTargetLanguageChange: (language: string) => Promise<void>;
}
function useWindowWidth() {
  const [width, setWidth] = useState(() =>
    typeof window === 'undefined' ? 1440 : window.innerWidth
  );
  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
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
  onCancelTranslation,
  onTargetLanguageChange,
}: MenuBarProps) {
  const { t } = useTranslation();
  const { activeAIConfig } = useActiveAIConfig();
  const { isDark: isDarkMode, toggleTheme } = useTheme();
  const { languages } = useSupportedLanguages();
  const sourceLanguage = useSourceLanguage();
  const targetLanguage = useTargetLanguage();
  const isCompact = useWindowWidth() < 1100;
  const sourceName = languages.find((language) => language.code === sourceLanguage)?.display_name;
  const handleTargetLanguageChange = useCallback(
    (langCode: string, langInfo: LanguageInfo | undefined) => {
      void onTargetLanguageChange(langCode);
      if (langInfo) log.info('target language changed', { code: langInfo.code });
    },
    [onTargetLanguageChange]
  );
  const fileMenu: MenuProps['items'] = [
    { key: 'open', icon: <FileAddOutlined />, label: t('menu.import'), onClick: onOpenFile },
    { type: 'divider' },
    {
      key: 'save',
      icon: <SaveOutlined />,
      label: t('menu.save'),
      disabled: !hasEntries,
      onClick: onSaveFile,
    },
    {
      key: 'saveAs',
      icon: <SaveOutlined />,
      label: t('menu.saveAs'),
      disabled: !hasEntries,
      onClick: onSaveAsFile,
    },
  ];
  const themeLabel = isDarkMode ? t('theme.light') : t('theme.dark');
  return (
    <nav className={styles.toolbar} aria-label={t('menu.mainMenu')}>
      <div className={styles.brand}>
        <span className={styles.brandMark} aria-hidden="true">
          <GlobalOutlined />
        </span>
        <span className={styles.brandName}>{isCompact ? t('app.nameShort') : t('app.name')}</span>
      </div>
      {hasEntries && (
        <div className={styles.language}>
          <Text className={styles.source}>
            {sourceName || sourceLanguage || t('menu.autoDetect')}
          </Text>
          <ArrowRightOutlined className={styles.arrow} aria-hidden="true" />
          <LanguageSelector
            value={targetLanguage}
            onChange={handleTargetLanguageChange}
            placeholder={t('menu.targetLanguage')}
            disabled={isTranslating}
            style={{ width: isCompact ? 150 : 192 }}
          />
        </div>
      )}
      <div className={styles.spacer} />
      {!activeAIConfig && (
        <Tooltip title={t('menu.configureAI')}>
          <BulbFilled className={styles.warning} aria-label={t('menu.configureAI')} />
        </Tooltip>
      )}
      <Tooltip title={isTranslating ? t('menu.stopTranslation') : t('menu.batchTranslate')}>
        <ActionButton
          className={styles.translate}
          variant={isTranslating ? 'danger' : 'primary'}
          size="small"
          icon={isTranslating ? <StopOutlined /> : <TranslationOutlined />}
          onClick={isTranslating ? onCancelTranslation : onTranslateAll}
          disabled={!activeAIConfig || !hasEntries}
          aria-busy={isTranslating}
          aria-label={isTranslating ? t('menu.stopTranslation') : t('menu.batchTranslate')}
        >
          {isCompact ? null : isTranslating ? t('menu.translating') : t('menu.batchTranslate')}
        </ActionButton>
      </Tooltip>
      <Dropdown menu={{ items: fileMenu }} trigger={['click']} placement="bottomRight">
        <ActionButton
          variant="ghost"
          size="small"
          icon={isCompact ? <MoreOutlined /> : <SaveOutlined />}
          aria-label={t('menu.fileActions')}
        >
          {isCompact ? null : t('menu.file')}
        </ActionButton>
      </Dropdown>
      <div className={styles.actions}>
        <Tooltip title={themeLabel}>
          <ActionButton
            variant="text"
            size="small"
            icon={isDarkMode ? <BulbFilled /> : <BulbOutlined />}
            onClick={toggleTheme}
            data-testid="menu-theme-toggle"
            aria-label={themeLabel}
          />
        </Tooltip>
        <Tooltip title={t('menu.settings')}>
          <ActionButton
            variant="text"
            size="small"
            icon={<SettingOutlined />}
            onClick={onSettings}
            data-testid="menu-settings-button"
            aria-label={t('menu.settings')}
          />
        </Tooltip>
        {onDevTools && (
          <Tooltip title={t('menu.devTools')}>
            <ActionButton
              variant="text"
              size="small"
              icon={<BugOutlined />}
              onClick={onDevTools}
              aria-label={t('menu.devTools')}
            />
          </Tooltip>
        )}
      </div>
    </nav>
  );
});
export default MenuBar;
