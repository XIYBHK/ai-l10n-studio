import React, { CSSProperties } from 'react';
import {
  CopyOutlined,
  SaveOutlined,
  UpOutlined,
  DownOutlined,
  CloseOutlined,
} from '@ant-design/icons';
import { Button, Badge } from 'antd';
import { useTranslation } from 'react-i18next';
import { CSS_COLORS } from '../../hooks/useCssColors';

interface EditorToolbarProps {
  saving?: boolean;
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
  saving = false,
  hasUnsavedChanges,
  onSave,
  onCancel,
  onCopyOriginal,
  onNavigatePrev,
  onNavigateNext,
  canNavigatePrev = false,
  canNavigateNext = false,
}) => {
  const { t } = useTranslation();
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
            {t('workspace.editor.unsavedChanges')}
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
        {t('workspace.editor.draftSynchronized')}
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
    <div style={toolbarStyles} role="toolbar" aria-label={t('workspace.editor.toolbar')}>
      <div style={leftSectionStyles}>{getStatusIndicator()}</div>

      <div style={rightSectionStyles}>
        {/* 导航按钮组 */}
        {(onNavigatePrev || onNavigateNext) && (
          <div
            style={navigationGroupStyles}
            role="group"
            aria-label={t('workspace.editor.navigation')}
          >
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
          aria-label={t('workspace.editor.copySource')}
        >
          {t('workspace.editor.copySourceShort')}
        </Button>

        {hasUnsavedChanges && (
          <Button
            size="small"
            icon={<CloseOutlined />}
            onMouseDown={(event) => {
              event.preventDefault();
            }}
            onClick={onCancel}
            aria-label={t('workspace.editor.cancelEdit')}
          >
            {t('common.cancel')}
          </Button>
        )}

        <Button
          size="small"
          type="primary"
          icon={<SaveOutlined />}
          onClick={onSave}
          loading={saving}
          disabled={!hasUnsavedChanges}
          aria-label={t('workspace.editor.confirmTranslation')}
          style={
            hasUnsavedChanges
              ? {
                  backgroundColor: CSS_COLORS.brandPrimary,
                  borderColor: CSS_COLORS.brandPrimary,
                }
              : undefined
          }
        >
          {t('workspace.editor.confirmTranslation')}
        </Button>
      </div>
    </div>
  );
};
