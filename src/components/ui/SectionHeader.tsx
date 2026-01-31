import React, { CSSProperties } from 'react';
import { CSS_COLORS } from '../hooks/useCssColors';

/**
 * SectionHeader 组件属性
 */
export interface SectionHeaderProps {
  /** 标题文本 */
  title: string;
  /** 图标 React 节点 */
  icon?: React.ReactNode;
  /** 操作按钮区域 */
  actions?: React.ReactNode;
  /** 副标题/描述 */
  subtitle?: string;
  /** 标题右侧额外内容（在标题和操作按钮之间） */
  extra?: React.ReactNode;
  /** 自定义样式 */
  style?: CSSProperties;
  /** 底部边框 */
  bordered?: boolean;
}

/**
 * 区块标题组件
 * 
 * 统一的区块标题样式，支持图标、标题、副标题和操作按钮。
 * 用于页面各个功能区块的标题展示。
 * 
 * @example
 * ```tsx
 * <SectionHeader
 *   title="翻译编辑器"
 *   icon={<EditOutlined />}
 *   subtitle="共 128 条待翻译条目"
 *   actions={<Button>保存</Button>}
 * />
 * ```
 */
export const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  icon,
  actions,
  subtitle,
  extra,
  style,
  bordered = true,
}) => {
  const containerStyles: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: bordered ? 'var(--space-3)' : undefined,
    marginBottom: bordered ? 'var(--space-4)' : undefined,
    borderBottom: bordered ? `1px solid ${CSS_COLORS.borderSecondary}` : undefined,
    ...style,
  };

  const leftSectionStyles: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-3)',
    flex: 1,
    minWidth: 0,
  };

  const iconStyles: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: CSS_COLORS.brandPrimary,
    fontSize: 'var(--font-size-lg)',
  };

  const titleGroupStyles: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-1)',
    minWidth: 0,
  };

  const titleRowStyles: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-2)',
  };

  const titleStyles: CSSProperties = {
    fontSize: 'var(--font-size-lg)',
    fontWeight: 600,
    color: CSS_COLORS.textPrimary,
    lineHeight: 1.4,
  };

  const subtitleStyles: CSSProperties = {
    fontSize: 'var(--font-size-sm)',
    color: CSS_COLORS.textSecondary,
    lineHeight: 1.4,
  };

  const extraStyles: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    marginLeft: 'var(--space-4)',
  };

  const actionsStyles: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-2)',
    marginLeft: 'var(--space-4)',
    flexShrink: 0,
  };

  return (
    <div style={containerStyles}>
      <div style={leftSectionStyles}>
        {icon && <div style={iconStyles}>{icon}</div>}
        <div style={titleGroupStyles}>
          <div style={titleRowStyles}>
            <h3 style={titleStyles}>{title}</h3>
          </div>
          {subtitle && <span style={subtitleStyles}>{subtitle}</span>}
        </div>
        {extra && <div style={extraStyles}>{extra}</div>}
      </div>
      {actions && <div style={actionsStyles}>{actions}</div>}
    </div>
  );
};

export default SectionHeader;
