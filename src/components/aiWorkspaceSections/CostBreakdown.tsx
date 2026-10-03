import React, { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { DollarOutlined } from '@ant-design/icons';
import { CSS_COLORS } from '../../hooks/useCssColors';
import { formatCost } from '../../utils/formatters';
import type { CostBreakdownProps } from './types';

// 成本展示组件
export const CostBreakdown = memo(function CostBreakdown({
  cost,
  language,
  unpricedRequests = 0,
}: CostBreakdownProps) {
  const { t } = useTranslation();
  const estimate = cost === 0 && unpricedRequests > 0 ? null : cost;
  const containerStyle: React.CSSProperties = {
    padding: 'var(--space-2)',
    backgroundColor: CSS_COLORS.bgTertiary,
    borderRadius: 'var(--radius-sm)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: 'var(--font-size-sm)',
  };

  return (
    <div style={containerStyle}>
      <span
        style={{
          color: CSS_COLORS.textSecondary,
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-1)',
        }}
      >
        <DollarOutlined />
        {t('modelSettings.knownPriceEstimate')}
      </span>
      <span
        style={{
          fontWeight: 600,
          color: CSS_COLORS.statusTranslated,
          fontSize: 'var(--font-size-lg)',
          fontFamily: 'monospace',
        }}
      >
        {estimate === null ? t('modelSettings.costUnknown') : formatCost(estimate, language)}
        {unpricedRequests > 0 && (
          <small> · {t('modelSettings.unpricedRequests', { count: unpricedRequests })}</small>
        )}
      </span>
    </div>
  );
});
