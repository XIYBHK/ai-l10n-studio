import React, { CSSProperties } from 'react';
import { CSS_COLORS } from '../hooks/useCssColors';

interface StatusBarProps {
  lineNumber?: number;
  charCount: number;
  isTranslated: boolean;
}

/**
 * 底部状态栏组件
 */
export const StatusBar: React.FC<StatusBarProps> = ({
  lineNumber,
  charCount,
  isTranslated,
}) => {
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
          <span>行: {lineNumber}</span>
        )}
        <span>字符: {charCount}</span>
        <span style={statusStyles}>
          {isTranslated ? '✓ 已翻译' : '○ 未翻译'}
        </span>
      </div>

      <div style={rightSectionStyles}>
        <div style={shortcutStyles}>
          <span>
            <kbd style={kbdStyles}>Ctrl</kbd> + <kbd style={kbdStyles}>Enter</kbd> 保存
          </span>
          <span>
            <kbd style={kbdStyles}>Esc</kbd> 取消
          </span>
          <span>
            <kbd style={kbdStyles}>Ctrl</kbd> + <kbd style={kbdStyles}>↑/↓</kbd> 导航
          </span>
        </div>
      </div>
    </div>
  );
};
