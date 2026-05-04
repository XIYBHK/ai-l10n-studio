import React, { memo } from 'react';
import { InfoCircleOutlined } from '@ant-design/icons';
import { CSS_COLORS } from '../../hooks/useCssColors';
import type { ModelInfo } from '../../types/generated/ModelInfo';

// 缓存提示组件
export const CacheInfo = memo(function CacheInfo({ modelInfo }: { modelInfo: ModelInfo }) {
  if (!modelInfo.supports_cache || !modelInfo.cache_reads_price) return null;

  const savings = (
    ((modelInfo.input_price - modelInfo.cache_reads_price) / modelInfo.input_price) *
    100
  ).toFixed(0);

  const containerStyle: React.CSSProperties = {
    marginTop: 'var(--space-2)',
    padding: 'var(--space-2) var(--space-3)',
    backgroundColor: CSS_COLORS.bgTertiary,
    border: `1px solid ${CSS_COLORS.borderPrimary}`,
    borderRadius: 'var(--radius-sm)',
    fontSize: 'var(--font-size-xs)',
    color: CSS_COLORS.textSecondary,
    lineHeight: '1.5',
    display: 'flex',
    alignItems: 'flex-start',
    gap: 'var(--space-1)',
  };

  return (
    <div style={containerStyle}>
      <InfoCircleOutlined style={{ marginTop: '2px', flexShrink: 0 }} />
      <span>当前模型支持缓存功能，重复请求可节省约 {savings}% 输入成本</span>
    </div>
  );
});
