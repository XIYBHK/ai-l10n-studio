import React, { CSSProperties } from 'react';
import {
  CopyOutlined,
  SaveOutlined,
  UpOutlined,
  DownOutlined,
  CloseOutlined,
} from '@ant-design/icons';
import { Button, Badge } from 'antd';
import { CSS_COLORS } from '../hooks/useCssColors';
import { SectionHeader } from '../ui/SectionHeader';

interface EditorToolbarProps {
  hasUnsavedChanges: boolean;
  onSave: () => void;
  onCancel: () => void;
  onCopyOriginal: () => void;
  onNavigatePrev?: () => void;
  onNavigateNext?: () => void;
  canNavigatePrev?: boolean;
  canNavigateNext?: boolean;
}

/**
 * 编辑器工具栏组件
 */
export const EditorToolbar: React.FC<EditorToolbarProps> = ({
  hasUnsavedChanges,
  onSave,
  onCancel,
  onCopyOriginal,
  onNavigatePrev,
  onNavigateNext,
  canNavigatePrev = false,
  canNavigateNext = false,
}) => {
  const getStatusIndicator = () => {
    if (hasUnsavedChanges) {
      return (
        <Badge
          dot
          color={CSS_COLORS.statusUntranslated}
          style={{
            animation: 'pulse-dot 2s ease-in-out infinite',
          }}
        >
          <span
            style={{
              color: CSS_COLORS.statusUntranslated,
              fontSize: 'var(--font-size-sm)',
              fontWeight: 'var(--font-weight-medium)',
              marginLeft: 'var(--space-2)',
            }}
          >
            有未保存的修改
          </span>
        </Badge>
      );
    }

    return (
      <span
        style={{
          color: CSS_COLORS.statusTranslated,
          fontSize: 'var(--font-size-sm)',
          fontWeight: 'var(--font-weight-medium)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-1)',
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            backgroundColor: CSS_COLORS.statusTranslated,
          }}
        />
        已保存
      </span>
    );
  };

  const toolbarStyles: CSSProperties = {
    padding: 'var(--space-3) var(--space-4)',
    backgroundColor: CSS_COLORS.bgTertiary,
    borderBottom: `1px solid ${CSS_COLORS.borderSecondary}`,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 'var(--space-3)',
  };

  const leftSectionStyles: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-3)',
  };

  const rightSectionStyles: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-2)',
  };

  const navigationGroupStyles: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-1)',
    paddingRight: 'var(--space-3)',
    borderRight: `1px solid ${CSS_COLORS.borderSecondary}`,
    marginRight: 'var(--space-2)',
  };

  return (
    <div style={toolbarStyles} role="toolbar" aria-label="编辑器工具栏">
      <div style={leftSectionStyles}>{getStatusIndicator()}</div>

      <div style={rightSectionStyles}>
        {/* 导航按钮组 */}
        {(onNavigatePrev || onNavigateNext) && (
          <div style={navigationGroupStyles} role="group" aria-label="导航">
            <Button
              size="small"
              icon={<UpOutlined />}
              onClick={onNavigatePrev}
              disabled={!canNavigatePrev}
              aria-label={canNavigatePrev ? '上一项 (Ctrl+上箭头)' : '没有上一项了'}
              title="上一项 (Ctrl+↑)"
            />
            <Button
              size="small"
              icon={<DownOutlined />}
              onClick={onNavigateNext}
              disabled={!canNavigateNext}
              aria-label={canNavigateNext ? '下一项 (Ctrl+下箭头)' : '没有下一项了'}
              title="下一项 (Ctrl+↓)"
            />
          </div>
        )}

        {/* 操作按钮 */}
        <Button
          size="small"
          icon={<CopyOutlined />}
          onClick={onCopyOriginal}
          disabled={hasUnsavedChanges}
          aria-label="复制原文到剪贴板"
        >
          复制原文
        </Button>

        {hasUnsavedChanges && (
          <Button
            size="small"
            icon={<CloseOutlined />}
            onClick={onCancel}
            aria-label="取消修改 (Esc)"
          >
            取消
          </Button>
        )}

        <Button
          size="small"
          type="primary"
          icon={<SaveOutlined />}
          onClick={onSave}
          disabled={!hasUnsavedChanges}
          aria-label="保存译文 (Ctrl+Enter)"
          style={
            hasUnsavedChanges
              ? {
                  backgroundColor: CSS_COLORS.brandPrimary,
                  borderColor: CSS_COLORS.brandPrimary,
                }
              : undefined
          }
        >
          保存 (Ctrl+Enter)
        </Button>
      </div>
    </div>
  );
};
