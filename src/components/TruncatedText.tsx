import { memo } from 'react';
import { Tooltip } from 'antd';
import { useTheme } from '@/hooks/useTheme';

interface TruncatedTextProps {
  text: string;
  maxWidth?: number | string;
  style?: React.CSSProperties;
  className?: string;
  showTooltip?: boolean;
}

/**
 * TruncatedText - 可复用的文本截断组件
 *
 * 功能:
 * - 自动截断过长文本并显示省略号
 * - 鼠标悬停时显示完整文本 (可选)
 * - 支持主题集成和自定义样式
 *
 * 用法示例:
 * <TruncatedText text="Very long text that needs truncation" maxWidth={200} />
 */
export const TruncatedText = memo(function TruncatedText({
  text,
  maxWidth = 200,
  style = {},
  className = '',
  showTooltip = true,
}: TruncatedTextProps) {
  const truncatedStyle: React.CSSProperties = {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: typeof maxWidth === 'number' ? `${maxWidth}px` : maxWidth,
    display: 'block',
    color: 'var(--color-textPrimary)',
    ...style,
  };

  const content = (
    <div style={truncatedStyle} className={className}>
      {text}
    </div>
  );

  // 如果启用 Tooltip 且文本不为空，则包装 Tooltip
  if (showTooltip && text) {
    return (
      <Tooltip title={text} placement="top">
        {content}
      </Tooltip>
    );
  }

  return content;
});

TruncatedText.displayName = 'TruncatedText';
