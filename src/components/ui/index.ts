/**
 * UI 组件库统一导出
 *
 * 包含以下组件：
 * - StatCard: 统计卡片
 * - SectionHeader: 区块标题
 * - InfoCard: 信息提示卡片
 * - MetricItem: 指标项
 * - ActionButton: 操作按钮
 * - EmptyState: 空状态
 * - Ripple: 波纹效果组件 🆕
 */

// StatCard 组件
export { StatCard, type StatCardProps } from './StatCard';

// SectionHeader 组件
export { SectionHeader, type SectionHeaderProps } from './SectionHeader';

// InfoCard 组件
export { InfoCard, type InfoCardProps, type InfoCardType } from './InfoCard';

// MetricItem 组件
export { MetricItem, type MetricItemProps, type TrendType } from './MetricItem';

// ActionButton 组件
export {
  ActionButton,
  type ActionButtonProps,
  type ActionButtonSize,
  type ActionButtonVariant,
} from './ActionButton';

// EmptyState 组件
export {
  EmptyState,
  type EmptyStateProps,
  type EmptyStateType,
  type ShortcutItem,
} from './EmptyState';

// Ripple 组件 🆕
export { Ripple, type RippleProps } from './Ripple';
