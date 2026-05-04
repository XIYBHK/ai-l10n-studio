import React, { CSSProperties, useMemo } from 'react';
import {
  FileTextOutlined,
  InboxOutlined,
  DatabaseOutlined,
  FileSearchOutlined,
  KeyOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { CSS_COLORS } from '../../hooks/useCssColors';

export type EmptyStateType = 'no-file' | 'no-entries' | 'column-empty' | 'default';

export interface ShortcutItem {
  key: string;
  description: string;
}

export interface EmptyStateProps {
  type?: EmptyStateType;
  icon?: React.ReactNode;
  title?: string;
  description?: string;
  action?: React.ReactNode;
  showShortcuts?: boolean;
  shortcuts?: ShortcutItem[];
  style?: CSSProperties;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  type = 'default',
  icon,
  title,
  description,
  action,
  showShortcuts = false,
  shortcuts,
  style,
}) => {
  const { t } = useTranslation();

  const config = useMemo<Record<EmptyStateType, { icon: React.ReactNode; title: string; description: string }>>(
    () => ({
      'no-file': {
        icon: <FileTextOutlined />,
        title: t('emptyState.title.noFile'),
        description: t('emptyState.description.noFile'),
      },
      'no-entries': {
        icon: <InboxOutlined />,
        title: t('emptyState.title.noEntries'),
        description: t('emptyState.description.noEntries'),
      },
      'column-empty': {
        icon: <DatabaseOutlined />,
        title: t('emptyState.title.columnEmpty'),
        description: t('emptyState.description.columnEmpty'),
      },
      default: {
        icon: <FileSearchOutlined />,
        title: t('emptyState.title.default'),
        description: t('emptyState.description.default'),
      },
    }),
    [t]
  );

  const defaultShortcuts = useMemo<ShortcutItem[]>(
    () => [
      { key: '↑/↓', description: t('emptyState.shortcuts.switchEntry') },
      { key: 'Enter', description: t('emptyState.shortcuts.confirmEdit') },
      { key: 'Tab', description: t('emptyState.shortcuts.nextField') },
      { key: 'Esc', description: t('emptyState.shortcuts.cancelEdit') },
    ],
    [t]
  );

  const current = config[type];
  const displayIcon = icon || current.icon;
  const displayTitle = title || current.title;
  const displayDescription = description || current.description;
  const displayShortcuts = shortcuts || defaultShortcuts;

  const containerStyles: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 'var(--space-8)',
    textAlign: 'center',
    ...style,
  };

  const iconStyles: CSSProperties = {
    fontSize: '64px',
    color: CSS_COLORS.textTertiary,
    marginBottom: 'var(--space-4)',
    opacity: 0.6,
  };

  const titleStyles: CSSProperties = {
    fontSize: 'var(--font-size-lg)',
    fontWeight: 600,
    color: CSS_COLORS.textPrimary,
    marginBottom: 'var(--space-2)',
  };

  const descriptionStyles: CSSProperties = {
    fontSize: 'var(--font-size-base)',
    color: CSS_COLORS.textSecondary,
    marginBottom: action ? 'var(--space-4)' : undefined,
    maxWidth: '400px',
    lineHeight: 1.6,
  };

  const shortcutsContainerStyles: CSSProperties = {
    marginTop: 'var(--space-6)',
    padding: 'var(--space-4)',
    backgroundColor: CSS_COLORS.bgSecondary,
    borderRadius: 'var(--radius-md)',
    border: `1px solid ${CSS_COLORS.borderSecondary}`,
    maxWidth: '320px',
  };

  const shortcutsHeaderStyles: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 'var(--space-2)',
    marginBottom: 'var(--space-3)',
    fontSize: 'var(--font-size-sm)',
    color: CSS_COLORS.textSecondary,
    fontWeight: 500,
  };

  const shortcutsListStyles: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'auto 1fr',
    gap: 'var(--space-2) var(--space-4)',
    alignItems: 'center',
  };

  const shortcutKeyStyles: CSSProperties = {
    padding: 'var(--space-1) var(--space-2)',
    backgroundColor: CSS_COLORS.bgPrimary,
    border: `1px solid ${CSS_COLORS.borderPrimary}`,
    borderRadius: 'var(--radius-sm)',
    fontSize: 'var(--font-size-xs)',
    fontFamily: 'monospace',
    fontWeight: 600,
    color: CSS_COLORS.textSecondary,
    textAlign: 'center',
  };

  const shortcutDescStyles: CSSProperties = {
    fontSize: 'var(--font-size-sm)',
    color: CSS_COLORS.textSecondary,
    textAlign: 'left',
  };

  return (
    <div style={containerStyles}>
      <div style={iconStyles}>{displayIcon}</div>
      <div style={titleStyles}>{displayTitle}</div>
      <div style={descriptionStyles}>{displayDescription}</div>
      {action && <div>{action}</div>}

      {showShortcuts && (
        <div style={shortcutsContainerStyles}>
          <div style={shortcutsHeaderStyles}>
            <KeyOutlined />
            <span>{t('emptyState.shortcuts.header')}</span>
          </div>
          <div style={shortcutsListStyles}>
            {displayShortcuts.map((shortcut, index) => (
              <React.Fragment key={index}>
                <span style={shortcutKeyStyles}>{shortcut.key}</span>
                <span style={shortcutDescStyles}>{shortcut.description}</span>
              </React.Fragment>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default EmptyState;
