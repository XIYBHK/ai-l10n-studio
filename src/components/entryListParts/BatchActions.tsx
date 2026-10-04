import { memo } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
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
    <div className={styles.selectionActions} role="group" aria-label={t('entryList.batchActions')}>
      {hasNeedsReview && (
        <>
          <Button
            type="primary"
            size="small"
            onClick={onConfirmSelected}
            icon={<CheckOutlined />}
            aria-label={getBatchActionAriaLabel('confirm', selectedIndices.length)}
          >
            {t('entryList.confirmSelected')}
          </Button>
          <Button
            type="default"
            size="small"
            onClick={onContextualRefine}
            icon={<ThunderboltOutlined />}
            disabled={isTranslating}
            aria-label={getBatchActionAriaLabel('refine', selectedIndices.length)}
          >
            {t('entryList.refineSelected')}
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
          {t('entryList.translateSelected')}
        </Button>
      )}
    </div>
  );
});
