import React from 'react';
import {
  CopyOutlined,
  SaveOutlined,
  UpOutlined,
  DownOutlined,
  CloseOutlined,
} from '@ant-design/icons';
import { Button } from 'antd';
import { useTranslation } from 'react-i18next';
import { CSS_COLORS } from '../../hooks/useCssColors';
import styles from '../EditorPane.module.css';

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
        <span className={styles.unsavedIndicator}>{t('workspace.editor.unsavedChanges')}</span>
      );
    }

    return <span className={styles.savedIndicator}>{t('workspace.editor.draftSynchronized')}</span>;
  };

  return (
    <div className={styles.toolbar} role="toolbar" aria-label={t('workspace.editor.toolbar')}>
      <div className={styles.toolbarStatus}>{getStatusIndicator()}</div>

      <div className={styles.toolbarActions}>
        {/* 导航按钮组 */}
        {(onNavigatePrev || onNavigateNext) && (
          <div
            className={styles.navigationGroup}
            role="group"
            aria-label={t('workspace.editor.navigation')}
          >
            <Button
              size="small"
              icon={<UpOutlined />}
              onClick={onNavigatePrev}
              disabled={!canNavigatePrev}
              aria-label={t(
                canNavigatePrev ? 'workspace.editor.previous' : 'workspace.editor.noPrevious'
              )}
              title={t('workspace.editor.previous')}
            />
            <Button
              size="small"
              icon={<DownOutlined />}
              onClick={onNavigateNext}
              disabled={!canNavigateNext}
              aria-label={t(canNavigateNext ? 'workspace.editor.next' : 'workspace.editor.noNext')}
              title={t('workspace.editor.next')}
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
          title={t('workspace.editor.copySource')}
        >
          <span className={styles.copyButtonText}>{t('workspace.editor.copySourceShort')}</span>
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
          {t('common.confirm')}
        </Button>
      </div>
    </div>
  );
};
