import React, { CSSProperties } from 'react';
import {
  FileTextOutlined,
  InboxOutlined,
  DatabaseOutlined,
  FileSearchOutlined,
  KeyOutlined,
} from '@ant-design/icons';
import { CSS_COLORS } from '../../hooks/useCssColors';

/**
 * 空状态类型
 */
export type EmptyStateType = 'no-file' | 'no-entries' | 'column-empty' | 'default';

/**
 * 快捷键项
 */
export interface ShortcutItem {
  /** 快捷键 */
  key: string;
  /** 功能描述 */
  description: string;
}

/**
 * EmptyState 组件属性
 */
export interface EmptyStateProps {
  /** 空状态类型 */
  type?: EmptyStateType;
  /** 自定义图标 */
  icon?: React.ReactNode;
  /** 标题 */
  title?: string;
  /** 描述 */
  description?: string;
  /** 操作按钮 */
  action?: React.ReactNode;
  /** 显示快捷键指南 */
  showShortcuts?: boolean;
  /** 快捷键列表 */
  shortcuts?: ShortcutItem[];
  /** 自定义样式 */
  style?: CSSProperties;
}

/**
 * 默认快捷键列表
 */
const defaultShortcuts: ShortcutItem[] = [
  { key: '↑/↓', description: '切换条目' },
  { key: 'Enter', description: '确认编辑' },
  { key: 'Tab', description: '下一个字段' },
  { key: 'Esc', description: '取消编辑' },
];

/**
 * 预定义的空状态配置
 */
const emptyStateConfig: Record<
  EmptyStateType,
  { icon: React.ReactNode; title: string; description: string }
> = {
  'no-file': {
    icon: <FileTextOutlined />,
    title: '未选择文件',
    description: '请在左侧文件列表中选择一个本地化文件开始编辑',
  },
  'no-entries': {
    icon: <InboxOutlined />,
    title: '暂无条目',
    description: '当前文件没有可显示的翻译条目',
  },
  'column-empty': {
    icon: <DatabaseOutlined />,
    title: '该列暂无数据',
    description: '选择其他列或添加新的翻译内容',
  },
  default: {
    icon: <FileSearchOutlined />,
    title: '暂无数据',
    description: '当前没有可显示的内容',
  },
};

/**
 * 空状态组件（增强版）
 *
 * 用于展示空状态界面，支持多种预设类型、自定义图标、标题、描述和操作按钮。
 * 可选显示快捷键指南面板。
 *
 * @example
 * ```tsx
 * <EmptyState
 *   type="no-file"
 *   action={<Button>打开文件</Button>}
 *   showShortcuts
 * />
 * ```
 */
export const EmptyState: React.FC<EmptyStateProps> = ({
  type = 'default',
  icon,
  title,
  description,
  action,
  showShortcuts = false,
  shortcuts = defaultShortcuts,
  style,
}) => {
  const config = emptyStateConfig[type];
  const displayIcon = icon || config.icon;
  const displayTitle = title || config.title;
  const displayDescription = description || config.description;

  const containerStyles: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 'var(--space-8)',
    textAlign: 'center',
    ...style,
  };

  const iconStyles: CSSProperties = {
    fontSize: '64px',
    color: CSS_COLORS.textTertiary,
    marginBottom: 'var(--space-4)',
    opacity: 0.6,
  };

  const titleStyles: CSSProperties = {
    fontSize: 'var(--font-size-lg)',
    fontWeight: 600,
    color: CSS_COLORS.textPrimary,
    marginBottom: 'var(--space-2)',
  };

  const descriptionStyles: CSSProperties = {
    fontSize: 'var(--font-size-base)',
    color: CSS_COLORS.textSecondary,
    marginBottom: action ? 'var(--space-4)' : undefined,
    maxWidth: '400px',
    lineHeight: 1.6,
  };

  const shortcutsContainerStyles: CSSProperties = {
    marginTop: 'var(--space-6)',
    padding: 'var(--space-4)',
    backgroundColor: CSS_COLORS.bgSecondary,
    borderRadius: 'var(--radius-md)',
    border: `1px solid ${CSS_COLORS.borderSecondary}`,
    maxWidth: '320px',
  };

  const shortcutsHeaderStyles: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 'var(--space-2)',
    marginBottom: 'var(--space-3)',
    fontSize: 'var(--font-size-sm)',
    color: CSS_COLORS.textSecondary,
    fontWeight: 500,
  };

  const shortcutsListStyles: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'auto 1fr',
    gap: 'var(--space-2) var(--space-4)',
    alignItems: 'center',
  };

  const shortcutKeyStyles: CSSProperties = {
    padding: 'var(--space-1) var(--space-2)',
    backgroundColor: CSS_COLORS.bgPrimary,
    border: `1px solid ${CSS_COLORS.borderPrimary}`,
    borderRadius: 'var(--radius-sm)',
    fontSize: 'var(--font-size-xs)',
    fontFamily: 'monospace',
    fontWeight: 600,
    color: CSS_COLORS.textSecondary,
    textAlign: 'center',
  };

  const shortcutDescStyles: CSSProperties = {
    fontSize: 'var(--font-size-sm)',
    color: CSS_COLORS.textSecondary,
    textAlign: 'left',
  };

  return (
    <div style={containerStyles}>
      <div style={iconStyles}>{displayIcon}</div>
      <div style={titleStyles}>{displayTitle}</div>
      <div style={descriptionStyles}>{displayDescription}</div>
      {action && <div>{action}</div>}

      {showShortcuts && (
        <div style={shortcutsContainerStyles}>
          <div style={shortcutsHeaderStyles}>
            <KeyOutlined />
            <span>快捷键指南</span>
          </div>
          <div style={shortcutsListStyles}>
            {shortcuts.map((shortcut, index) => (
              <React.Fragment key={index}>
                <span style={shortcutKeyStyles}>{shortcut.key}</span>
                <span style={shortcutDescStyles}>{shortcut.description}</span>
              </React.Fragment>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default EmptyState;
