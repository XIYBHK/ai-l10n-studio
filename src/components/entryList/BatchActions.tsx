import React, { memo } from 'react';
import { Button } from 'antd';
import { CheckOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { POEntry } from '../../types/tauri';
import { getBatchActionAriaLabel } from '../../utils/accessibility';
import styles from '../EntryList.module.css';

interface BatchActionsProps {
  selectedIndices: number[];
  entries: POEntry[];
  getEntryStatus: (entry: POEntry) => string;
  onConfirmSelected: () => void;
  onContextualRefine: () => void;
  onTranslateSelected: () => void;
  isTranslating: boolean;
}

export const BatchActions = memo(function BatchActions({
  selectedIndices,
  entries,
  getEntryStatus,
  onConfirmSelected,
  onContextualRefine,
  onTranslateSelected,
  isTranslating,
}: BatchActionsProps) {
  const hasNeedsReview = selectedIndices.some((index) => {
    const entry = entries[index];
    return entry && getEntryStatus(entry) === 'needs-review';
  });

  const hasUntranslated = selectedIndices.some((index) => {
    const entry = entries[index];
    return entry && getEntryStatus(entry) === 'untranslated';
  });

  if (selectedIndices.length === 0) return null;

  return (
    <div className={styles.selectionActions} role="group" aria-label="批量操作">
      {hasNeedsReview && (
        <>
          <Button
            type="primary"
            size="small"
            onClick={onConfirmSelected}
            icon={<CheckOutlined />}
            aria-label={getBatchActionAriaLabel('confirm', selectedIndices.length)}
          >
            确认已选中
          </Button>
          <Button
            type="default"
            size="small"
            onClick={onContextualRefine}
            icon={<ThunderboltOutlined />}
            disabled={isTranslating}
            aria-label={getBatchActionAriaLabel('refine', selectedIndices.length)}
          >
            精翻选中 (Ctrl+Shift+R)
          </Button>
        </>
      )}
      {hasUntranslated && (
        <Button
          type="primary"
          size="small"
          onClick={onTranslateSelected}
          disabled={isTranslating}
          aria-label={getBatchActionAriaLabel('translate', selectedIndices.length)}
        >
          翻译选中
        </Button>
      )}
    </div>
  );
});
