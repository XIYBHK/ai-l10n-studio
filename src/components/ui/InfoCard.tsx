import React, { CSSProperties, useState } from 'react';
import {
  InfoCircleOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  CloseCircleOutlined,
  CloseOutlined,
} from '@ant-design/icons';
import { CSS_COLORS } from '../../hooks/useCssColors';

/**
 * InfoCard 类型
 */
export type InfoCardType = 'info' | 'warning' | 'success' | 'error';

/**
 * InfoCard 组件属性
 */
export interface InfoCardProps {
  /** 提示类型 */
  type?: InfoCardType;
  /** 标题 */
  title?: string;
  /** 描述内容 */
  description?: string;
  /** 自定义图标 */
  icon?: React.ReactNode;
  /** 是否可关闭 */
  closable?: boolean;
  /** 关闭回调 */
  onClose?: () => void;
  /** 自定义样式 */
  style?: CSSProperties;
  /** 子内容（覆盖默认布局） */
  children?: React.ReactNode;
}

/**
 * 信息提示卡片组件
 *
 * 用于展示各类提示信息，包括 info、warning、success、error 四种类型。
 * 支持图标、标题、描述文字，并可关闭。
 *
 * @example
 * ```tsx
 * <InfoCard
 *   type="warning"
 *   title="注意"
 *   description="有 3 条翻译需要审核"
 *   closable
 * />
 * ```
 */
export const InfoCard: React.FC<InfoCardProps> = ({
  type = 'info',
  title,
  description,
  icon,
  closable = false,
  onClose,
  style,
  children,
}) => {
  const [visible, setVisible] = useState(true);

  if (!visible) return null;

  // 类型配置
  const typeConfig: Record<
    InfoCardType,
    { icon: React.ReactNode; color: string; bgColor: string }
  > = {
    info: {
      icon: <InfoCircleOutlined />,
      color: '#1890ff',
      bgColor: '#e6f7ff',
    },
    warning: {
      icon: <ExclamationCircleOutlined />,
      color: '#faad14',
      bgColor: '#fffbe6',
    },
    success: {
      icon: <CheckCircleOutlined />,
      color: CSS_COLORS.statusTranslated,
      bgColor: '#f6ffed',
    },
    error: {
      icon: <CloseCircleOutlined />,
      color: '#ff4d4f',
      bgColor: '#fff2f0',
    },
  };

  const config = typeConfig[type];
  const displayIcon = icon || config.icon;

  const containerStyles: CSSProperties = {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 'var(--space-3)',
    padding: 'var(--space-3) var(--space-4)',
    borderRadius: 'var(--radius-md)',
    backgroundColor: config.bgColor,
    border: `1px solid ${config.color}30`,
    ...style,
  };

  const iconStyles: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: config.color,
    fontSize: 'var(--font-size-lg)',
    flexShrink: 0,
  };

  const contentStyles: CSSProperties = {
    flex: 1,
    minWidth: 0,
  };

  const titleStyles: CSSProperties = {
    fontSize: 'var(--font-size-base)',
    fontWeight: 600,
    color: CSS_COLORS.textPrimary,
    marginBottom: description ? 'var(--space-1)' : undefined,
  };

  const descriptionStyles: CSSProperties = {
    fontSize: 'var(--font-size-sm)',
    color: CSS_COLORS.textSecondary,
    lineHeight: 1.5,
  };

  const closeBtnStyles: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 'var(--space-1)',
    cursor: 'pointer',
    color: CSS_COLORS.textTertiary,
    fontSize: 'var(--font-size-sm)',
    borderRadius: 'var(--radius-sm)',
    transition: 'all var(--duration-fast) ease',
    flexShrink: 0,
  };

  const handleClose = () => {
    setVisible(false);
    onClose?.();
  };

  return (
    <div style={containerStyles}>
      <div style={iconStyles}>{displayIcon}</div>
      <div style={contentStyles}>
        {children || (
          <>
            {title && <div style={titleStyles}>{title}</div>}
            {description && <div style={descriptionStyles}>{description}</div>}
          </>
        )}
      </div>
      {closable && (
        <div style={closeBtnStyles} onClick={handleClose} className="info-card-close-btn">
          <CloseOutlined />
        </div>
      )}

      <style>{`
        .info-card-close-btn:hover {
          background-color: ${CSS_COLORS.hoverBg};
          color: ${CSS_COLORS.textSecondary};
        }
      `}</style>
    </div>
  );
};

export default InfoCard;
