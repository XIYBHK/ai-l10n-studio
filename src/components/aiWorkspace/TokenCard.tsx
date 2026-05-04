import React, { memo } from 'react';
import { CSS_COLORS } from '../../hooks/useCssColors';

// Token统计卡片组件
export const TokenCard = memo(function TokenCard({ label, value }: { label: string; value: string }) {
  const containerStyle: React.CSSProperties = {
    textAlign: 'center',
    padding: 'var(--space-2)',
    backgroundColor: CSS_COLORS.bgTertiary,
    borderRadius: 'var(--radius-sm)',
  };

  return (
    <div style={containerStyle}>
      <div style={{ color: CSS_COLORS.textTertiary, fontSize: 'var(--font-size-xs)' }}>{label}</div>
      <div
        style={{
          fontSize: 'var(--font-size-base)',
          fontWeight: 600,
          color: CSS_COLORS.textPrimary,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </div>
    </div>
  );
});
