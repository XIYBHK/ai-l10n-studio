import React, { useState, memo } from 'react';
import { Card, Tag, Divider, Button, Popconfirm } from 'antd';
import {
  RobotOutlined,
  SettingOutlined,
  ReloadOutlined,
  BookOutlined,
  DollarOutlined,
  ThunderboltOutlined,
  BarChartOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import type { TranslationStats } from '../types/tauri';
import { MemoryManager } from './MemoryManager';
import { TermLibraryManager } from './TermLibraryManager';
import { CSS_COLORS } from '../hooks/useCssColors';
import { useCumulativeStats, useResetCumulativeStatsAction, useSessionStats } from '../store';
import { createModuleLogger } from '../utils/logger';
import { useTermLibrary } from '../hooks/useTermLibrary';
import { formatTokens, formatPercentage, formatCostByLocale } from '../utils/formatters';
import { useAppStore } from '../store/useAppStore';
import { useAppData } from '../hooks/useConfig';
import { aiModelCommands } from '../services/commands';
import type { ModelInfo } from '../types/generated/ModelInfo';

const log = createModuleLogger('AIWorkspace');

interface AIWorkspaceProps {
  stats: TranslationStats | null;
  isTranslating: boolean;
  onResetStats?: () => void;
}

interface StatCardProps {
  title: string;
  value: string | number;
  suffix?: string;
  icon?: React.ReactNode;
  color?: string;
}

interface SessionStatsSectionProps {
  sessionStats: TranslationStats;
  modelInfo: ModelInfo | null;
  language: string;
}

interface CumulativeStatsSectionProps {
  cumulativeStats: TranslationStats;
  language: string;
  onReset: () => void;
}

interface TermLibrarySectionProps {
  onManageClick: () => void;
}

interface CostBreakdownProps {
  cost: number;
  language: string;
}

const SESSION_CARD_DATA = [
  { key: 'tm_hits', label: '记忆库命中', color: 'statusTranslated', percentage: true },
  { key: 'deduplicated', label: '去重节省', color: 'statusUntranslated', percentage: true },
  { key: 'ai_translated', label: 'AI调用', color: 'textPrimary', percentage: true },
  { key: 'tm_learned', label: '记忆库新增', color: 'statusTranslated', percentage: false },
] as const;

const TOKEN_DATA = [
  { key: 'input_tokens', label: '输入' },
  { key: 'output_tokens', label: '输出' },
  { key: 'total_tokens', label: '总计' },
] as const;

const CUMULATIVE_CARDS = [
  { key: 'total', label: '总计翻译', color: 'textPrimary' },
  { key: 'ai_translated', label: 'AI调用', color: 'textPrimary' },
  { key: 'tm_hits', label: '记忆命中', color: 'statusTranslated' },
  { key: 'deduplicated', label: '去重命中', color: 'statusUntranslated' },
  { key: 'tm_learned', label: '记忆库新增', color: 'statusTranslated' },
] as const;

// 通用统计卡片组件
const StatCard = memo(function StatCard({ title, value, suffix, icon, color }: StatCardProps) {
  const containerStyle: React.CSSProperties = {
    textAlign: 'center',
    padding: 'var(--space-2)',
    backgroundColor: CSS_COLORS.bgTertiary,
    borderRadius: 'var(--radius-sm)',
    transition: 'transform 0.2s, box-shadow 0.2s',
    cursor: 'default',
  };

  const handleMouseEnter = (e: React.MouseEvent<HTMLDivElement>) => {
    e.currentTarget.style.transform = 'translateY(-2px)';
    e.currentTarget.style.boxShadow = `0 2px 8px ${CSS_COLORS.overlayBg}`;
  };

  const handleMouseLeave = (e: React.MouseEvent<HTMLDivElement>) => {
    e.currentTarget.style.transform = 'translateY(0)';
    e.currentTarget.style.boxShadow = 'none';
  };

  return (
    <div style={containerStyle} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      {icon && (
        <div style={{ marginBottom: 'var(--space-1)', color: CSS_COLORS.textTertiary }}>{icon}</div>
      )}
      <div
        style={{
          color: CSS_COLORS.textTertiary,
          fontSize: 'var(--font-size-xs)',
          marginBottom: 'var(--space-1)',
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontSize: 'var(--font-size-lg)',
          fontWeight: 600,
          color: color ? CSS_COLORS[color as keyof typeof CSS_COLORS] : CSS_COLORS.textPrimary,
        }}
      >
        {value}
        {suffix && (
          <span style={{ fontSize: 'var(--font-size-sm)', marginLeft: 'var(--space-1)' }}>
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
});

// Token统计卡片组件
const TokenCard = memo(function TokenCard({ label, value }: { label: string; value: string }) {
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
        }}
      >
        {value}
      </div>
    </div>
  );
});

// 成本展示组件
const CostBreakdown = memo(function CostBreakdown({ cost, language }: CostBreakdownProps) {
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
        预估成本
      </span>
      <span
        style={{
          fontWeight: 600,
          color: CSS_COLORS.statusTranslated,
          fontSize: 'var(--font-size-lg)',
          fontFamily: 'monospace',
        }}
      >
        {formatCostByLocale(cost, language)}
      </span>
    </div>
  );
});

// 缓存提示组件
const CacheInfo = memo(function CacheInfo({ modelInfo }: { modelInfo: ModelInfo }) {
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

// 效率提示组件
const EfficiencyTip = memo(function EfficiencyTip({ saved }: { saved: number }) {
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

// 本次会话统计区块
const SessionStatsSection = memo(function SessionStatsSection({
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
  const tmLearned = sessionStats.tm_learned ?? 0;
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

// 累计统计区块
const CumulativeStatsSection = memo(function CumulativeStatsSection({
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

      {/* 统计卡片网格 */}
      <div style={gridStyle}>
        {CUMULATIVE_CARDS.slice(0, 2).map((item) => (
          <StatCard
            key={item.key}
            title={item.label}
            value={cumulativeStats[item.key] ?? 0}
            color={item.color}
          />
        ))}
      </div>
      <div style={gridStyle}>
        {CUMULATIVE_CARDS.slice(2, 4).map((item) => (
          <StatCard
            key={item.key}
            title={item.label}
            value={cumulativeStats[item.key] ?? 0}
            color={item.color}
          />
        ))}
      </div>
      <div style={fullWidthGridStyle}>
        <StatCard
          title={CUMULATIVE_CARDS[4].label}
          value={cumulativeStats.tm_learned ?? 0}
          color={CUMULATIVE_CARDS[4].color}
        />
      </div>

      {/* Token和费用 */}
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

// 术语库区块
const TermLibrarySection = memo(function TermLibrarySection({
  onManageClick,
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
            {new Date(termLibrary.style_summary.generated_at).toLocaleString('zh-CN')}
          </div>
        </div>
      )}
    </div>
  );
});

export const AIWorkspace = memo(function AIWorkspace({
  isTranslating,
  onResetStats,
}: AIWorkspaceProps) {
  const [memoryManagerVisible, setMemoryManagerVisible] = useState(false);
  const [termLibraryVisible, setTermLibraryVisible] = useState(false);

  const cumulativeStats = useCumulativeStats();
  const resetCumulativeStats = useResetCumulativeStatsAction();
  const sessionStats = useSessionStats();
  const language = useAppStore((state) => state.language);
  const { activeAIConfig } = useAppData();
  const [modelInfo, setModelInfo] = useState<ModelInfo | null>(null);

  React.useEffect(() => {
    if (activeAIConfig?.providerId && activeAIConfig?.model) {
      aiModelCommands
        .getModelInfo(activeAIConfig.providerId, activeAIConfig.model)
        .then((info) => {
          setModelInfo(info);
          if (info?.supports_cache) {
            log.debug('当前模型支持缓存', {
              model: info.name,
              cache_savings: info.cache_reads_price
                ? `${(((info.input_price - info.cache_reads_price) / info.input_price) * 100).toFixed(0)}%`
                : 'N/A',
            });
          }
        })
        .catch((err) => {
          log.error('获取模型信息失败:', err);
          setModelInfo(null);
        });
    } else {
      setModelInfo(null);
    }
  }, [activeAIConfig?.providerId, activeAIConfig?.model]);

  const handleReset = () => {
    resetCumulativeStats();
    onResetStats?.();
  };

  const cardTitleStyle: React.CSSProperties = {
    fontSize: 'var(--font-size-base)',
    fontWeight: 600,
  };

  const cardStyles = {
    header: {
      backgroundColor: CSS_COLORS.bgSecondary,
      borderBottom: `1px solid ${CSS_COLORS.borderSecondary}`,
      minHeight: '46px',
    },
    body: {
      padding: 'var(--space-3)',
      backgroundColor: CSS_COLORS.bgSecondary,
    },
  };

  return (
    <>
      <Card
        variant="borderless"
        title={
          <span style={cardTitleStyle}>
            <RobotOutlined
              style={{ marginRight: 'var(--space-2)', color: CSS_COLORS.statusUntranslated }}
              aria-hidden="true"
            />
            AI 工作区
            {isTranslating && (
              <Tag
                color="processing"
                style={{ marginLeft: 'var(--space-2)', border: 'none' }}
                aria-label="翻译进行中"
              >
                翻译中...
              </Tag>
            )}
          </span>
        }
        extra={
          <Button
            type="text"
            size="small"
            icon={<SettingOutlined />}
            onClick={() => setMemoryManagerVisible(true)}
            style={{ color: CSS_COLORS.textSecondary }}
            aria-label="打开记忆库管理"
          >
            记忆库
          </Button>
        }
        size="small"
        style={{
          height: '100%',
          overflowY: 'auto',
          backgroundColor: CSS_COLORS.bgSecondary,
          borderRadius: 0,
        }}
        // @ts-ignore - Ant Design 5.5+ styles 属性类型定义问题
        styles={cardStyles}
        role="complementary"
        aria-label="AI工作区统计信息"
      >
        {/* 累计统计 */}
        <CumulativeStatsSection
          cumulativeStats={cumulativeStats}
          language={language}
          onReset={handleReset}
        />

        <Divider style={{ margin: 'var(--space-3) 0' }} />

        {/* 本次会话统计 */}
        <SessionStatsSection
          sessionStats={sessionStats}
          modelInfo={modelInfo}
          language={language}
        />

        <Divider style={{ margin: 'var(--space-3) 0' }} />

        {/* 术语库 */}
        <TermLibrarySection onManageClick={() => setTermLibraryVisible(true)} />
      </Card>

      <MemoryManager
        visible={memoryManagerVisible}
        onClose={() => setMemoryManagerVisible(false)}
      />
      <TermLibraryManager
        visible={termLibraryVisible}
        onClose={() => setTermLibraryVisible(false)}
      />
    </>
  );
});
