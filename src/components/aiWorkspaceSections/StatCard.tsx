import React, { memo } from 'react';
import { CSS_COLORS } from '../../hooks/useCssColors';
import type { StatCardProps } from './types';

export const StatCard = memo(function StatCard({
  title,
  value,
  suffix,
  icon,
  color,
  size = 'normal',
}: StatCardProps) {
  const isLarge = size === 'large';

  const containerStyle: React.CSSProperties = {
    textAlign: 'center',
    padding: isLarge ? 'var(--space-4)' : 'var(--space-2)',
    backgroundColor: CSS_COLORS.bgTertiary,
    borderRadius: isLarge ? 'var(--radius-md)' : 'var(--radius-sm)',
    border: `1px solid ${CSS_COLORS.borderSecondary}`,
  };

  const titleStyle: React.CSSProperties = {
    color: CSS_COLORS.textTertiary,
    fontSize: isLarge ? 'var(--font-size-sm)' : 'var(--font-size-xs)',
    marginBottom: isLarge ? 'var(--space-2)' : 'var(--space-1)',
    fontWeight: isLarge ? 'var(--font-weight-medium)' : undefined,
    letterSpacing: isLarge ? '0.02em' : undefined,
  };

  const valueStyle: React.CSSProperties = {
    fontSize: isLarge ? 'var(--font-size-2xl)' : 'var(--font-size-lg)',
    fontWeight: isLarge ? 700 : 600,
    color: color ? CSS_COLORS[color as keyof typeof CSS_COLORS] : CSS_COLORS.textPrimary,
    fontVariantNumeric: 'tabular-nums',
    lineHeight: isLarge ? 1.15 : 1.2,
  };

  const suffixStyle: React.CSSProperties = {
    fontSize: isLarge ? 'var(--font-size-base)' : 'var(--font-size-sm)',
    marginLeft: 'var(--space-1)',
    fontWeight: isLarge ? 600 : undefined,
    color: CSS_COLORS.textTertiary,
  };

  return (
    <div style={containerStyle}>
      {icon && (
        <div style={{ marginBottom: 'var(--space-1)', color: CSS_COLORS.textTertiary }}>{icon}</div>
      )}
      <div style={titleStyle}>{title}</div>
      <div style={valueStyle}>
        {value}
        {suffix && <span style={suffixStyle}>{suffix}</span>}
      </div>
    </div>
  );
});
