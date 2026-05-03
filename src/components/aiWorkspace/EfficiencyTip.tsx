import React, { memo } from 'react';
import { ThunderboltOutlined } from '@ant-design/icons';
import { CSS_COLORS } from '../../hooks/useCssColors';

// 效率提示组件
export const EfficiencyTip = memo(function EfficiencyTip({ saved }: { saved: number }) {
  if (saved <= 0) return null;

  const containerStyle: React.CSSProperties = {
    marginTop: 'var(--space-2)',
    padding: 'var(--space-2)',
    backgroundColor: CSS_COLORS.bgTertiary,
    borderRadius: 'var(--radius-sm)',
    fontSize: 'var(--font-size-xs)',
    color: CSS_COLORS.statusTranslated,
    textAlign: 'center',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 'var(--space-1)',
  };

  return (
    <div style={containerStyle}>
      <ThunderboltOutlined />
      节省了 {saved} 次 API 调用
    </div>
  );
});
