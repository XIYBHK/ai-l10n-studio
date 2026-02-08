import React, { MouseEvent, useState, useRef, ReactNode } from 'react';

/**
 * 波纹效果接口
 */
interface Ripple {
  x: number;
  y: number;
  size: number;
  key: number;
}

/**
 * Ripple 组件属性
 */
export interface RippleProps {
  /** 子元素 */
  children: ReactNode;
  /** 是否启用波纹效果（默认启用） */
  enabled?: boolean;
  /** 波纹颜色（默认 rgba(255, 255, 255, 0.5)） */
  color?: string;
  /** 波纹持续时间（默认 600ms） */
  duration?: number;
  /** 额外的类名 */
  className?: string;
  /** 点击事件回调 */
  onClick?: (event: MouseEvent<HTMLElement>) => void;
}

/**
 * Ripple 波纹效果组件
 *
 * 为任何可点击元素添加 Material Design 风格的波纹效果。
 *
 * @example
 * ```tsx
 * <Ripple>
 *   <button>点击我</button>
 * </Ripple>
 *
 * <Ripple color="rgba(102, 126, 234, 0.3)" duration={800}>
 *   <div className="card">卡片内容</div>
 * </Ripple>
 * ```
 */
export const Ripple: React.FC<RippleProps> = ({
  children,
  enabled = true,
  color = 'rgba(255, 255, 255, 0.5)',
  duration = 600,
  className = '',
  onClick,
}) => {
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (event: MouseEvent<HTMLElement>) => {
    if (!enabled || !containerRef.current) return;

    // 调用原始点击事件
    if (onClick) {
      onClick(event);
    }

    const container = containerRef.current;
    const rect = container.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height) * 2;
    const x = event.clientX - rect.left - size / 2;
    const y = event.clientY - rect.top - size / 2;

    const newRipple: Ripple = {
      x,
      y,
      size,
      key: Date.now() + Math.random(),
    };

    setRipples((prev) => [...prev, newRipple]);

    // 自动清理波纹
    setTimeout(() => {
      setRipples((prev) => prev.filter((r) => r.key !== newRipple.key));
    }, duration);
  };

  return (
    <div
      ref={containerRef}
      className={`ripple-container ${className}`}
      onMouseDown={handleMouseDown}
      style={{
        position: 'relative',
        overflow: 'hidden',
        display: 'contents',
      }}
    >
      {children}
      {enabled && (
        <span
          className="ripple-effects"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            borderRadius: 'inherit',
          }}
        >
          {ripples.map((r) => (
            <span
              key={r.key}
              className="ripple-effect"
              style={{
                position: 'absolute',
                left: `${r.x}px`,
                top: `${r.y}px`,
                width: `${r.size}px`,
                height: `${r.size}px`,
                borderRadius: '50%',
                background: color,
                transform: 'scale(0)',
                animation: `ripple-animation ${duration}ms ease-out`,
                pointerEvents: 'none',
              }}
            />
          ))}
        </span>
      )}
    </div>
  );
};

export default Ripple;
