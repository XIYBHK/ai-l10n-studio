import React from 'react';

interface SkeletonBaseProps {
  variant?: 'text' | 'circle' | 'rect';
  width?: number | string;
  height?: number | string;
  className?: string;
  style?: React.CSSProperties;
}

const SkeletonBase: React.FC<SkeletonBaseProps> = ({
  variant = 'rect',
  width = '100%',
  height = 16,
  className = '',
  style = {},
}) => {
  const getBorderRadius = () => {
    switch (variant) {
      case 'circle':
        return '50%';
      case 'text':
        return 'var(--radius-sm, 4px)';
      case 'rect':
      default:
        return 'var(--radius-lg, 12px)';
    }
  };

  const skeletonStyle: React.CSSProperties = {
    width: typeof width === 'number' ? `${width}px` : width,
    height: typeof height === 'number' ? `${height}px` : height,
    backgroundColor: 'var(--color-bgTertiary, #f0f0f0)',
    borderRadius: getBorderRadius(),
    animation: 'skeleton-pulse 2s ease-in-out infinite',
    ...style,
  };

  return <div className={`skeleton-base ${variant} ${className}`} style={skeletonStyle} />;
};

export default SkeletonBase;
