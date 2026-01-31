import React, { CSSProperties } from 'react';
import { CSS_COLORS } from '../hooks/useCssColors';

/**
 * StatCard 组件属性
 */
export interface StatCardProps {
  /** 卡片标题 */
  title: string;
  /** 数值 */
  value: string | number;
  /** 数值后缀（如 %, entries 等） */
  suffix?: string;
  /** 主题颜色 */
  color?: 'primary' | 'success' | 'warning' | 'error' | 'info' | string;
  /** 图标 React 节点 */
  icon?: React.ReactNode;
  /** 底部内容 */
  footer?: React.ReactNode;
  /** 自定义样式 */
  style?: CSSProperties;
  /** 点击回调 */
  onClick?: () => void;
}

/**
 * 统计卡片组件
 * 
 * 用于展示关键统计数据，支持多种主题色、图标和底部内容。
 * 悬停时有轻微上浮效果。
 * 
 * @example
 * ```tsx
 * <StatCard
 *   title="翻译完成率"
 *   value="85"
 *   suffix="%"
 *   color="success"
 *   icon={<CheckCircleOutlined />}
 * />
 * ```
 */
export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  suffix,
  color = 'primary',
  icon,
  footer,
  style,
  onClick,
}) => {
  // 预设颜色映射
  const colorMap: Record<string, string> = {
    primary: CSS_COLORS.brandPrimary,
    success: CSS_COLORS.statusTranslated,
    warning: CSS_COLORS.statusNeedsReview,
    error: '#ff4d4f',
    info: '#1890ff',
  };

  const themeColor = colorMap[color] || color;

  const cardStyles: CSSProperties = {
    backgroundColor: CSS_COLORS.bgPrimary,
    border: `1px solid ${CSS_COLORS.borderSecondary}`,
    borderRadius: 'var(--radius-md)',
    padding: 'var(--space-4)',
    cursor: onClick ? 'pointer' : 'default',
    transition: 'all var(--duration-base) ease',
    ...style,
  };

  const headerStyles: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 'var(--space-3)',
  };

  const titleStyles: CSSProperties = {
    fontSize: 'var(--font-size-sm)',
    color: CSS_COLORS.textSecondary,
    fontWeight: 500,
  };

  const iconStyles: CSSProperties = {
    width: '32px',
    height: '32px',
    borderRadius: 'var(--radius-sm)',
    backgroundColor: `${themeColor}15`,
    color: themeColor,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 'var(--font-size-lg)',
  };

  const valueContainerStyles: CSSProperties = {
    display: 'flex',
    alignItems: 'baseline',
    gap: 'var(--space-1)',
  };

  const valueStyles: CSSProperties = {
    fontSize: 'var(--font-size-2xl)',
    fontWeight: 600,
    color: CSS_COLORS.textPrimary,
    lineHeight: 1.2,
  };

  const suffixStyles: CSSProperties = {
    fontSize: 'var(--font-size-sm)',
    color: CSS_COLORS.textSecondary,
  };

  const footerStyles: CSSProperties = {
    marginTop: 'var(--space-3)',
    paddingTop: 'var(--space-3)',
    borderTop: `1px solid ${CSS_COLORS.borderSecondary}`,
  };

  return (
    <div
      style={cardStyles}
      onClick={onClick}
      className="stat-card-hover"
    >
      <div style={headerStyles}>
        <span style={titleStyles}>{title}</span>
        {icon && <div style={iconStyles}>{icon}</div>}
      </div>
      
      <div style={valueContainerStyles}>
        <span style={valueStyles}>{value}</span>
        {suffix && <span style={suffixStyles}>{suffix}</span>}
      </div>
      
      {footer && <div style={footerStyles}>{footer}</div>}

      <style>{`
        .stat-card-hover:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
          border-color: ${CSS_COLORS.borderPrimary};
        }
      `}</style>
    </div>
  );
};

export default StatCard;
