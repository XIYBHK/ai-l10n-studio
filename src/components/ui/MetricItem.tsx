import React, { CSSProperties } from 'react';
import { ArrowUpOutlined, ArrowDownOutlined, MinusOutlined } from '@ant-design/icons';
import { CSS_COLORS } from '../hooks/useCssColors';

/**
 * 趋势类型
 */
export type TrendType = 'up' | 'down' | 'neutral';

/**
 * MetricItem 组件属性
 */
export interface MetricItemProps {
  /** 指标标签 */
  label: string;
  /** 指标数值 */
  value: string | number;
  /** 趋势类型 */
  trend?: TrendType;
  /** 趋势数值（如 +5%, -10%） */
  trendValue?: string;
  /** 颜色编码 */
  color?: 'default' | 'success' | 'warning' | 'error' | 'primary' | string;
  /** 自定义样式 */
  style?: CSSProperties;
  /** 点击回调 */
  onClick?: () => void;
}

/**
 * 指标项组件
 *
 * 用于列表中展示单个指标，支持标签、数值、趋势指示和颜色编码。
 * 常用于统计面板、数据列表等场景。
 *
 * @example
 * ```tsx
 * <MetricItem
 *   label="翻译进度"
 *   value="85%"
 *   trend="up"
 *   trendValue="+12%"
 *   color="success"
 * />
 * ```
 */
export const MetricItem: React.FC<MetricItemProps> = ({
  label,
  value,
  trend,
  trendValue,
  color = 'default',
  style,
  onClick,
}) => {
  // 颜色映射
  const colorMap: Record<string, string> = {
    default: CSS_COLORS.textPrimary,
    primary: CSS_COLORS.brandPrimary,
    success: CSS_COLORS.statusTranslated,
    warning: CSS_COLORS.statusNeedsReview,
    error: '#ff4d4f',
  };

  const valueColor = colorMap[color] || color;

  // 趋势颜色映射
  const trendColorMap: Record<TrendType, string> = {
    up: CSS_COLORS.statusTranslated,
    down: '#ff4d4f',
    neutral: CSS_COLORS.textTertiary,
  };

  // 趋势图标映射
  const trendIconMap: Record<TrendType, React.ReactNode> = {
    up: <ArrowUpOutlined />,
    down: <ArrowDownOutlined />,
    neutral: <MinusOutlined />,
  };

  const containerStyles: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 'var(--space-2) 0',
    cursor: onClick ? 'pointer' : 'default',
    transition: 'background-color var(--duration-fast) ease',
    borderRadius: 'var(--radius-sm)',
    ...style,
  };

  const labelStyles: CSSProperties = {
    fontSize: 'var(--font-size-sm)',
    color: CSS_COLORS.textSecondary,
  };

  const valueSectionStyles: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-2)',
  };

  const valueStyles: CSSProperties = {
    fontSize: 'var(--font-size-base)',
    fontWeight: 600,
    color: valueColor,
  };

  const trendStyles: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-1)',
    fontSize: 'var(--font-size-xs)',
    color: trend ? trendColorMap[trend] : CSS_COLORS.textTertiary,
    fontWeight: 500,
  };

  return (
    <div style={containerStyles} onClick={onClick} className="metric-item-hover">
      <span style={labelStyles}>{label}</span>
      <div style={valueSectionStyles}>
        <span style={valueStyles}>{value}</span>
        {trend && (
          <span style={trendStyles}>
            {trendIconMap[trend]}
            {trendValue}
          </span>
        )}
      </div>

      <style>{`
        .metric-item-hover:hover {
          background-color: ${CSS_COLORS.hoverBg};
        }
      `}</style>
    </div>
  );
};

export default MetricItem;
