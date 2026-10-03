import React, { CSSProperties } from 'react';
import { CSS_COLORS } from '../../hooks/useCssColors';
import { useTranslation } from 'react-i18next';

interface StatusBarProps {
  lineNumber?: number;
  charCount: number;
  isTranslated: boolean;
}

/**
 * 底部状态栏组件
 */
export const StatusBar: React.FC<StatusBarProps> = ({ lineNumber, charCount, isTranslated }) => {
  const { t } = useTranslation();
  const containerStyles: CSSProperties = {
    padding: 'var(--space-2) var(--space-4)',
    borderTop: `1px solid ${CSS_COLORS.borderSecondary}`,
    backgroundColor: CSS_COLORS.bgTertiary,
    fontSize: 'var(--font-size-xs)',
    color: CSS_COLORS.textTertiary,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  };

  const leftSectionStyles: CSSProperties = {
    display: 'flex',
    gap: 'var(--space-4)',
  };

  const rightSectionStyles: CSSProperties = {
    display: 'flex',
    gap: 'var(--space-4)',
    alignItems: 'center',
  };

  const shortcutStyles: CSSProperties = {
    display: 'flex',
    gap: 'var(--space-3)',
  };

  const kbdStyles: CSSProperties = {
    backgroundColor: CSS_COLORS.bgPrimary,
    padding: '2px 6px',
    borderRadius: 'var(--radius-sm)',
    border: `1px solid ${CSS_COLORS.borderSecondary}`,
    fontFamily: 'var(--mono-font)',
    fontSize: 'var(--font-size-xs)',
    color: CSS_COLORS.textSecondary,
  };

  const statusStyles: CSSProperties = {
    color: isTranslated ? CSS_COLORS.statusTranslated : CSS_COLORS.statusUntranslated,
    fontWeight: 'var(--font-weight-medium)',
  };

  return (
    <div style={containerStyles}>
      <div style={leftSectionStyles}>
        {lineNumber !== undefined && (
          <span>{t('workspace.editor.lineNumber', { count: lineNumber })}</span>
        )}
        <span>{t('workspace.editor.charCount', { count: charCount })}</span>
        <span style={statusStyles}>
          {isTranslated
            ? `✓ ${t('workspace.editor.translated')}`
            : `○ ${t('workspace.editor.untranslated')}`}
        </span>
      </div>

      <div style={rightSectionStyles}>
        <div style={shortcutStyles}>
          <span>
            <kbd style={kbdStyles}>Ctrl</kbd> + <kbd style={kbdStyles}>Enter</kbd>{' '}
            {t('common.confirm')}
          </span>
          <span>
            <kbd style={kbdStyles}>Esc</kbd> {t('common.cancel')}
          </span>
          <span>
            <kbd style={kbdStyles}>Ctrl</kbd> + <kbd style={kbdStyles}>↑/↓</kbd>{' '}
            {t('workspace.editor.navigation')}
          </span>
        </div>
      </div>
    </div>
  );
};
