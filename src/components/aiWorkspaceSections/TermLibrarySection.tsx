import React, { memo } from 'react';
import { Button } from 'antd';
import { BookOutlined } from '@ant-design/icons';
import { CSS_COLORS } from '../../hooks/useCssColors';
import { formatDateTime } from '../../utils/formatters';
import { useTermLibrary } from '../../hooks/useTermLibrary';
import type { TermLibrarySectionProps } from './types';

// 术语库区块
export const TermLibrarySection = memo(function TermLibrarySection({
  onManageClick,
  language,
}: TermLibrarySectionProps) {
  const { termLibrary } = useTermLibrary({ enabled: true });

  if (!termLibrary || termLibrary.metadata.total_terms === 0) return null;

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 'var(--space-3)',
  };

  const titleStyle: React.CSSProperties = {
    fontSize: 'var(--font-size-sm)',
    color: CSS_COLORS.textSecondary,
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-2)',
  };

  const styleCardStyle: React.CSSProperties = {
    padding: 'var(--space-2) var(--space-3)',
    backgroundColor: CSS_COLORS.bgTertiary,
    borderRadius: 'var(--radius-sm)',
    fontSize: 'var(--font-size-sm)',
    lineHeight: '1.6',
    color: CSS_COLORS.textSecondary,
  };

  const styleTitleStyle: React.CSSProperties = {
    fontWeight: 600,
    marginBottom: 'var(--space-1)',
    color: CSS_COLORS.textPrimary,
  };

  const styleMetaStyle: React.CSSProperties = {
    marginTop: 'var(--space-2)',
    fontSize: 'var(--font-size-xs)',
    color: CSS_COLORS.textTertiary,
  };

  return (
    <div style={{ marginBottom: 'var(--space-3)' }}>
      <div style={headerStyle}>
        <span style={titleStyle}>
          <BookOutlined />
          术语库 ({termLibrary.metadata.total_terms}条)
        </span>
        <Button
          type="link"
          size="small"
          onClick={onManageClick}
          style={{ fontSize: 'var(--font-size-xs)', height: '22px' }}
        >
          管理
        </Button>
      </div>

      {termLibrary.style_summary && (
        <div style={styleCardStyle}>
          <div style={styleTitleStyle}>
            翻译风格提示 ({termLibrary.style_summary.based_on_terms}条术语)
          </div>
          <div style={{ whiteSpace: 'pre-line' }}>{termLibrary.style_summary.prompt}</div>
          <div style={styleMetaStyle}>
            v{termLibrary.style_summary.version} ·{' '}
            {formatDateTime(termLibrary.style_summary.generated_at, language)}
          </div>
        </div>
      )}
    </div>
  );
});
