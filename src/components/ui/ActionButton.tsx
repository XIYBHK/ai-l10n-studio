import React, { CSSProperties, useState } from 'react';
import { Button, ButtonProps } from 'antd';
import { CSS_COLORS } from '../../hooks/useCssColors';

export type ActionButtonSize = 'small' | 'medium' | 'large';
export type ActionButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'text';

export interface ActionButtonProps extends Omit<ButtonProps, 'size' | 'type' | 'variant'> {
  size?: ActionButtonSize;
  variant?: ActionButtonVariant;
  icon?: React.ReactNode;
  children?: React.ReactNode;
  style?: CSSProperties;
  hoverAnimation?: boolean;
}

export const ActionButton: React.FC<ActionButtonProps> = ({
  size = 'medium',
  variant = 'primary',
  icon,
  children,
  style,
  hoverAnimation = true,
  ...buttonProps
}) => {
  const [isPressed, setIsPressed] = useState(false);

  const sizeMap: Record<ActionButtonSize, { height: string; padding: string; fontSize: string }> = {
    small: {
      height: '30px',
      padding: '0 var(--space-3)',
      fontSize: 'var(--font-size-sm)',
    },
    medium: {
      height: '36px',
      padding: '0 var(--space-4)',
      fontSize: 'var(--font-size-base)',
    },
    large: {
      height: '42px',
      padding: '0 var(--space-5)',
      fontSize: 'var(--font-size-md)',
    },
  };

  const variantStyles: Record<ActionButtonVariant, CSSProperties> = {
    primary: {
      backgroundColor: CSS_COLORS.brandPrimary,
      borderColor: CSS_COLORS.brandPrimary,
      color: '#ffffff',
      boxShadow: '0 1px 2px rgba(0, 0, 0, 0.08)',
    },
    secondary: {
      backgroundColor: CSS_COLORS.bgTertiary,
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
      color: CSS_COLORS.textSecondary,
      boxShadow: 'none',
    },
  };

  const antdTypeMap: Record<ActionButtonVariant, ButtonProps['type']> = {
    primary: 'primary',
    secondary: 'default',
    ghost: 'default',
    danger: 'primary',
    text: 'text',
  };

  const sizeConfig = sizeMap[size];
  const variantConfig = variantStyles[variant];

  const buttonStyles: CSSProperties = {
    height: sizeConfig.height,
    padding: sizeConfig.padding,
    fontSize: sizeConfig.fontSize,
    borderRadius: 'var(--radius-md)',
    fontWeight: variant === 'primary' ? 600 : 500,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 'var(--space-1)',
    transition: hoverAnimation
      ? 'transform 0.18s ease, box-shadow 0.18s ease, background-color var(--theme-transition-duration) var(--theme-transition-timing), border-color var(--theme-transition-duration) var(--theme-transition-timing), color var(--theme-transition-duration) var(--theme-transition-timing)'
      : 'background-color var(--theme-transition-duration) var(--theme-transition-timing), border-color var(--theme-transition-duration) var(--theme-transition-timing), color var(--theme-transition-duration) var(--theme-transition-timing)',
    transform: isPressed ? 'scale(0.98)' : 'scale(1)',
    ...variantConfig,
    ...style,
  };

  return (
    <Button
      type={antdTypeMap[variant]}
      icon={icon}
      style={buttonStyles}
      className={hoverAnimation ? 'action-button-animated' : undefined}
      onMouseDownCapture={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      onMouseLeave={() => setIsPressed(false)}
      {...buttonProps}
    >
      {children}
    </Button>
  );
};

export default ActionButton;
