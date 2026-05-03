import React, { memo } from 'react';
import { BarChartOutlined } from '@ant-design/icons';
import { CSS_COLORS } from '../../hooks/useCssColors';
import { formatTokens, formatPercentage } from '../../utils/formatters';
import type { SessionStatsSectionProps } from './types';
import { StatCard } from './StatCard';
import { TokenCard } from './TokenCard';
import { CostBreakdown } from './CostBreakdown';
import { CacheInfo } from './CacheInfo';
import { EfficiencyTip } from './EfficiencyTip';

export const SESSION_CARD_DATA = [
  { key: 'tm_hits', label: '记忆库命中', color: 'statusTranslated', percentage: true },
  { key: 'deduplicated', label: '去重节省', color: 'statusUntranslated', percentage: true },
  { key: 'ai_translated', label: 'AI调用', color: 'textPrimary', percentage: true },
  { key: 'tm_learned', label: '记忆库新增', color: 'statusTranslated', percentage: false },
] as const;

// 本次会话统计区块
export const SessionStatsSection = memo(function SessionStatsSection({
  sessionStats,
  modelInfo,
  language,
}: SessionStatsSectionProps) {
  const hasData = (sessionStats.tm_hits ?? 0) > 0 || (sessionStats.ai_translated ?? 0) > 0;

  if (!hasData) {
    return (
      <div
        style={{
          padding: 'var(--space-3)',
          textAlign: 'center',
          color: CSS_COLORS.textTertiary,
          fontSize: 'var(--font-size-sm)',
        }}
      >
        暂无数据
      </div>
    );
  }

  const cost = sessionStats.token_stats?.cost ?? 0;
  const totalTokens = sessionStats.token_stats?.total_tokens ?? 0;
  const inputTokens = sessionStats.token_stats?.input_tokens ?? 0;
  const outputTokens = sessionStats.token_stats?.output_tokens ?? 0;
  const tmHits = sessionStats.tm_hits ?? 0;
  const deduplicated = sessionStats.deduplicated ?? 0;
  const aiTranslated = sessionStats.ai_translated ?? 0;
  const actualTotal = tmHits + deduplicated + aiTranslated;

  const getStatValue = (key: (typeof SESSION_CARD_DATA)[number]['key']) => {
    const value = sessionStats[key] ?? 0;
    if (key === 'tm_learned') return value;
    return actualTotal > 0 ? formatPercentage(value, actualTotal) : '0.0%';
  };

  const headerStyle: React.CSSProperties = {
    fontSize: 'var(--font-size-sm)',
    color: CSS_COLORS.textSecondary,
    fontWeight: 600,
    marginBottom: 'var(--space-3)',
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-2)',
  };

  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: 'var(--space-2)',
    marginBottom: 'var(--space-3)',
  };

  const tokenGridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 'var(--space-2)',
    marginBottom: 'var(--space-2)',
  };

  return (
    <div role="region" aria-label="本次会话统计">
      <div style={headerStyle}>
        <BarChartOutlined aria-hidden="true" />
        本次会话统计
      </div>

      {/* 效率指标 2x2网格 */}
      <div style={gridStyle}>
        {SESSION_CARD_DATA.map((item) => (
          <StatCard
            key={item.key}
            title={item.label}
            value={getStatValue(item.key)}
            color={item.color}
          />
        ))}
      </div>

      {/* Token消耗 */}
      <div style={tokenGridStyle}>
        <TokenCard label="输入" value={formatTokens(inputTokens)} />
        <TokenCard label="输出" value={formatTokens(outputTokens)} />
        <TokenCard label="总计" value={formatTokens(totalTokens)} />
      </div>

      {/* 成本 */}
      <CostBreakdown cost={cost} language={language} />

      {/* 缓存支持提示 */}
      {modelInfo && <CacheInfo modelInfo={modelInfo} />}

      {/* 效率提示 */}
      <EfficiencyTip saved={tmHits + deduplicated} />
    </div>
  );
});
