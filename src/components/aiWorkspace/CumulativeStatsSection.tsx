import React, { memo } from 'react';
import { Button, Popconfirm } from 'antd';
import { BarChartOutlined, ReloadOutlined } from '@ant-design/icons';
import { CSS_COLORS } from '../../hooks/useCssColors';
import { formatTokens, formatCostByLocale } from '../../utils/formatters';
import type { CumulativeStatsSectionProps } from './types';
import { StatCard } from './StatCard';

export const CUMULATIVE_CARDS = [
  { key: 'total', label: '总计翻译', color: 'brandPrimary' },
  { key: 'ai_translated', label: 'AI调用', color: 'textPrimary' },
  { key: 'tm_hits', label: '记忆命中', color: 'statusTranslated' },
  { key: 'deduplicated', label: '去重命中', color: 'statusUntranslated' },
  { key: 'tm_learned', label: '记忆库新增', color: 'statusTranslated' },
] as const;

// 累计统计区块
export const CumulativeStatsSection = memo(function CumulativeStatsSection({
  cumulativeStats,
  language,
  onReset,
}: CumulativeStatsSectionProps) {
  if (cumulativeStats.total === 0) {
    return (
      <div
        style={{
          padding: 'var(--space-3)',
          textAlign: 'center',
          color: CSS_COLORS.textTertiary,
          fontSize: 'var(--font-size-sm)',
        }}
      >
        暂无累计数据
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
          累计统计
        </span>
        <Popconfirm
          title="确认重置累计统计数据？"
          onConfirm={onReset}
          okText="确认"
          cancelText="取消"
          aria-label="确认重置累计统计数据对话框"
        >
          <Button
            type="text"
            size="small"
            icon={<ReloadOutlined />}
            danger
            style={{ fontSize: 'var(--font-size-xs)', height: '22px' }}
            aria-label="重置累计统计数据"
          >
            重置
          </Button>
        </Popconfirm>
      </div>

      <div style={{ ...fullWidthGridStyle, marginBottom: 'var(--space-3)' }}>
        <StatCard
          title={CUMULATIVE_CARDS[0].label}
          value={cumulativeStats.total ?? 0}
          color={CUMULATIVE_CARDS[0].color}
          size="large"
        />
      </div>
      <div style={gridStyle}>
        {CUMULATIVE_CARDS.slice(1, 3).map((item) => (
          <StatCard
            key={item.key}
            title={item.label}
            value={cumulativeStats[item.key] ?? 0}
            color={item.color}
          />
        ))}
      </div>
      <div style={gridStyle}>
        {CUMULATIVE_CARDS.slice(3, 5).map((item) => (
          <StatCard
            key={item.key}
            title={item.label}
            value={cumulativeStats[item.key] ?? 0}
            color={item.color}
          />
        ))}
      </div>

      <div style={costContainerStyle}>
        <span style={{ color: CSS_COLORS.textSecondary }}>Token: {formatTokens(totalTokens)}</span>
        <span
          style={{ fontWeight: 600, color: CSS_COLORS.statusTranslated, fontFamily: 'monospace' }}
        >
          {formatCostByLocale(cost, language)}
        </span>
      </div>
    </div>
  );
});
