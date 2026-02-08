import React, { CSSProperties, MouseEvent, useRef, useState } from 'react';
import { Button, ButtonProps } from 'antd';
import { CSS_COLORS } from '../../hooks/useCssColors';

/**
 * ActionButton 尺寸类型
 */
export type ActionButtonSize = 'small' | 'medium' | 'large';

/**
 * ActionButton 变体类型
 */
export type ActionButtonVariant =
  | 'primary'
  | 'secondary'
  | 'ghost'
  | 'danger'
  | 'text'
  | 'gradient'; // 🆕 渐变背景变体

/**
 * 波纹效果状态
 */
interface Ripple {
  x: number;
  y: number;
  size: number;
  key: number;
}

/**
 * ActionButton 组件属性
 */
export interface ActionButtonProps extends Omit<ButtonProps, 'size' | 'type' | 'variant'> {
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
  /** 是否启用波纹效果（默认启用） */
  ripple?: boolean;
  /** 是否启用悬停动画（默认启用） */
  hoverAnimation?: boolean;
}

/**
 * 统一的操作按钮组件
 *
 * 基于 Ant Design Button 封装，提供统一的尺寸、圆角和悬停效果。
 * 支持多种变体样式，包括渐变背景，适用于各种操作场景。
 *
 * 🆕 特性：
 * - 渐变背景变体
 * - 悬停时的 transform 和 box-shadow 动画
 * - 点击时的缩放反馈
 * - 可选的波纹效果
 * - 平滑过渡效果
 *
 * @example
 * ```tsx
 * <ActionButton variant="primary" size="medium" icon={<SaveOutlined />}>
 *   保存
 * </ActionButton>
 *
 * <ActionButton variant="gradient" size="large" ripple>
 *   渐变按钮
 * </ActionButton>
 * ```
 */
export const ActionButton: React.FC<ActionButtonProps> = ({
  size = 'medium',
  variant = 'primary',
  icon,
  children,
  style,
  ripple = true,
  hoverAnimation = true,
  ...buttonProps
}) => {
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const [isPressed, setIsPressed] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

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
    // 🆕 渐变背景变体
    gradient: {
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      borderColor: 'transparent',
      color: '#ffffff',
      boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)',
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
    gradient: 'primary',
  };

  // 🆕 波纹效果处理
  const handleMouseDown = (event: MouseEvent<HTMLButtonElement>) => {
    if (!ripple || !buttonRef.current) return;

    const button = buttonRef.current;
    const rect = button.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = event.clientX - rect.left - size / 2;
    const y = event.clientY - rect.top - size / 2;

    const newRipple: Ripple = {
      x,
      y,
      size,
      key: Date.now(),
    };

    setRipples((prev) => [...prev, newRipple]);

    // 移除波纹
    setTimeout(() => {
      setRipples((prev) => prev.filter((r) => r.key !== newRipple.key));
    }, 600);
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
    // 🆕 平滑过渡效果
    transition: hoverAnimation
      ? 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
      : 'background-color 0.3s ease',
    // 🆕 悬停动画 - 点击时缩放
    transform: isPressed ? 'scale(0.95)' : 'scale(1)',
    position: 'relative',
    overflow: 'hidden',
    ...variantConfig,
    ...style,
  };

  return (
    <Button
      ref={buttonRef}
      type={antdTypeMap[variant]}
      icon={icon}
      style={buttonStyles}
      className={`action-button action-button-${variant} ${
        hoverAnimation ? 'action-button-animated' : ''
      }`}
      onMouseDown={handleMouseDown}
      onMouseDownCapture={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      onMouseLeave={() => setIsPressed(false)}
      {...buttonProps}
    >
      {children}
      {/* 🆕 波纹效果 */}
      {ripple && (
        <span className="action-button-ripple-container">
          {ripples.map((r) => (
            <span
              key={r.key}
              className="action-button-ripple"
              style={{
                left: `${r.x}px`,
                top: `${r.y}px`,
                width: `${r.size}px`,
                height: `${r.size}px`,
              }}
            />
          ))}
        </span>
      )}
    </Button>
  );
};

export default ActionButton;
