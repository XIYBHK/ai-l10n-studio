import React, { CSSProperties } from 'react';
import { Button, ButtonProps } from 'antd';
import { CSS_COLORS } from '../hooks/useCssColors';

/**
 * ActionButton 尺寸类型
 */
export type ActionButtonSize = 'small' | 'medium' | 'large';

/**
 * ActionButton 变体类型
 */
export type ActionButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'text';

/**
 * ActionButton 组件属性
 */
export interface ActionButtonProps extends Omit<ButtonProps, 'size' | 'type'> {
  /** 按钮尺寸 */
  size?: ActionButtonSize;
  /** 按钮变体 */
  variant?: ActionButtonVariant;
  /** 左侧图标 */
  icon?: React.ReactNode;
  /** 按钮文本 */
  children?: React.ReactNode;
  /** 自定义样式 */
  style?: CSSProperties;
}

/**
 * 统一的操作按钮组件
 *
 * 基于 Ant Design Button 封装，提供统一的尺寸、圆角和悬停效果。
 * 支持多种变体样式，适用于各种操作场景。
 *
 * @example
 * ```tsx
 * <ActionButton variant="primary" size="medium" icon={<SaveOutlined />}>
 *   保存
 * </ActionButton>
 * ```
 */
export const ActionButton: React.FC<ActionButtonProps> = ({
  size = 'medium',
  variant = 'primary',
  icon,
  children,
  style,
  ...buttonProps
}) => {
  // 尺寸映射
  const sizeMap: Record<ActionButtonSize, { height: string; padding: string; fontSize: string }> = {
    small: {
      height: '28px',
      padding: '0 var(--space-3)',
      fontSize: 'var(--font-size-xs)',
    },
    medium: {
      height: '32px',
      padding: '0 var(--space-4)',
      fontSize: 'var(--font-size-sm)',
    },
    large: {
      height: '40px',
      padding: '0 var(--space-5)',
      fontSize: 'var(--font-size-base)',
    },
  };

  const sizeConfig = sizeMap[size];

  // 变体样式映射
  const variantStyles: Record<ActionButtonVariant, CSSProperties> = {
    primary: {
      backgroundColor: CSS_COLORS.brandPrimary,
      borderColor: CSS_COLORS.brandPrimary,
      color: '#ffffff',
    },
    secondary: {
      backgroundColor: CSS_COLORS.bgSecondary,
      borderColor: CSS_COLORS.borderPrimary,
      color: CSS_COLORS.textPrimary,
    },
    ghost: {
      backgroundColor: 'transparent',
      borderColor: CSS_COLORS.borderPrimary,
      color: CSS_COLORS.textSecondary,
    },
    danger: {
      backgroundColor: '#ff4d4f',
      borderColor: '#ff4d4f',
      color: '#ffffff',
    },
    text: {
      backgroundColor: 'transparent',
      borderColor: 'transparent',
      color: CSS_COLORS.brandPrimary,
    },
  };

  const variantConfig = variantStyles[variant];

  // Ant Design Button 类型映射
  const antdTypeMap: Record<ActionButtonVariant, ButtonProps['type']> = {
    primary: 'primary',
    secondary: 'default',
    ghost: 'default',
    danger: 'primary',
    text: 'text',
  };

  const buttonStyles: CSSProperties = {
    height: sizeConfig.height,
    padding: sizeConfig.padding,
    fontSize: sizeConfig.fontSize,
    borderRadius: 'var(--radius-md)',
    fontWeight: 500,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 'var(--space-1)',
    transition: 'all var(--duration-base) ease',
    ...variantConfig,
    ...style,
  };

  return (
    <Button
      type={antdTypeMap[variant]}
      icon={icon}
      style={buttonStyles}
      className={`action-button-${variant}`}
      {...buttonProps}
    >
      {children}
    </Button>
  );
};

export default ActionButton;
