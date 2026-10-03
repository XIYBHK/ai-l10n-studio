import React, { memo } from 'react';
import { Button, Popconfirm } from 'antd';
import { BarChartOutlined, ReloadOutlined } from '@ant-design/icons';
import { CSS_COLORS } from '../../hooks/useCssColors';
import { formatTokens } from '../../utils/formatters';
import { CostBreakdown } from './CostBreakdown';
import type { CumulativeStatsSectionProps } from './types';
import { StatCard } from './StatCard';
import { useTranslation } from 'react-i18next';

export const CUMULATIVE_CARDS = [
  { key: 'total', label: 'total', color: 'brandPrimary' },
  { key: 'ai_translated', label: 'aiTranslated', color: 'textPrimary' },
  { key: 'tm_hits', label: 'memoryHits', color: 'statusTranslated' },
  { key: 'deduplicated', label: 'deduplication', color: 'statusUntranslated' },
  { key: 'tm_learned', label: 'tmLearned', color: 'statusTranslated' },
] as const;

// 累计统计区块
export const CumulativeStatsSection = memo(function CumulativeStatsSection({
  cumulativeStats,
  language,
  onReset,
}: CumulativeStatsSectionProps) {
  const { t } = useTranslation();
  if (cumulativeStats.total === 0 && cumulativeStats.tm_learned === 0) {
    return (
      <div
        style={{
          padding: 'var(--space-3)',
          textAlign: 'center',
          color: CSS_COLORS.textTertiary,
          fontSize: 'var(--font-size-sm)',
        }}
      >
        {t('aiWorkspace.noStats')}
      </div>
    );
  }

  const cost = cumulativeStats.token_stats?.cost ?? 0;
  const totalTokens = cumulativeStats.token_stats?.total_tokens ?? 0;

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
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

  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: 'var(--space-2)',
    marginBottom: 'var(--space-2)',
  };

  const fullWidthGridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: 'var(--space-2)',
  };

  const costContainerStyle: React.CSSProperties = {
    marginTop: 'var(--space-2)',
    padding: 'var(--space-2) var(--space-3)',
    backgroundColor: CSS_COLORS.bgTertiary,
    borderRadius: 'var(--radius-sm)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: 'var(--font-size-xs)',
  };

  return (
    <div>
      <div style={headerStyle}>
        <span style={titleStyle}>
          <BarChartOutlined aria-hidden="true" />
          {t('aiWorkspace.cumulative')}
        </span>
        <Popconfirm
          title={t('aiWorkspace.resetConfirm')}
          onConfirm={onReset}
          okText={t('common.confirm')}
          cancelText={t('common.cancel')}
          aria-label={t('aiWorkspace.resetConfirm')}
        >
          <Button
            type="text"
            size="small"
            icon={<ReloadOutlined />}
            danger
            style={{ fontSize: 'var(--font-size-xs)', height: '22px' }}
            aria-label={t('aiWorkspace.resetConfirm')}
          >
            {t('aiWorkspace.reset')}
          </Button>
        </Popconfirm>
      </div>

      <div style={{ ...fullWidthGridStyle, marginBottom: 'var(--space-3)' }}>
        <StatCard
          title={t(`aiWorkspace.${CUMULATIVE_CARDS[0].label}`)}
          value={cumulativeStats.total ?? 0}
          color={CUMULATIVE_CARDS[0].color}
          size="large"
        />
      </div>
      <div style={gridStyle}>
        {CUMULATIVE_CARDS.slice(1, 3).map((item) => (
          <StatCard
            key={item.key}
            title={t(`aiWorkspace.${item.label}`)}
            value={cumulativeStats[item.key] ?? 0}
            color={item.color}
          />
        ))}
      </div>
      <div style={gridStyle}>
        {CUMULATIVE_CARDS.slice(3, 5).map((item) => (
          <StatCard
            key={item.key}
            title={t(`aiWorkspace.${item.label}`)}
            value={cumulativeStats[item.key] ?? 0}
            color={item.color}
          />
        ))}
      </div>

      <div style={costContainerStyle}>
        <span style={{ color: CSS_COLORS.textSecondary }}>Token: {formatTokens(totalTokens)}</span>
      </div>
      <CostBreakdown
        cost={cost}
        language={language}
        unpricedRequests={cumulativeStats.token_stats.unpriced_requests}
      />
    </div>
  );
});
