import React, { useEffect, useState, memo } from 'react';
import { Segmented } from 'antd';
import { useTranslation } from 'react-i18next';
import type { POEntry } from '../../types/tauri';
import { CSS_COLORS } from '../../hooks/useCssColors';
import styles from '../EntryList.module.css';
import { VirtualizedColumn, type ColumnType, type IndexedEntry } from './VirtualizedColumn';

export interface StatusColumnsProps {
  groupedEntries: Record<ColumnType, IndexedEntry[]>;
  currentEntry: POEntry | null;
  selectedIndices: number[];
  getEntryStatus: (entry: POEntry) => string;
  onRowClick: (
    entry: POEntry,
    index: number,
    event: React.MouseEvent,
    columnType: ColumnType
  ) => void;
  onConfirm: (index: number, event: React.MouseEvent) => void;
  onConfirmAll: () => void;
  onRemoveAll: (columnType: 'needsReview' | 'translated') => void;
  setActiveColumn: React.Dispatch<React.SetStateAction<ColumnType | null>>;
}

const statusColors = {
  untranslated: CSS_COLORS.statusUntranslated,
  needsReview: CSS_COLORS.statusNeedsReview,
  translated: CSS_COLORS.statusTranslated,
};
const columns: ColumnType[] = ['untranslated', 'needsReview', 'translated'];

export const StatusColumns = memo(function StatusColumns({
  groupedEntries,
  currentEntry,
  selectedIndices,
  getEntryStatus,
  onRowClick,
  onConfirm,
  onConfirmAll,
  onRemoveAll,
  setActiveColumn,
}: StatusColumnsProps) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState<ColumnType>('untranslated');
  useEffect(() => {
    if (!currentEntry) return;
    const status = getEntryStatus(currentEntry);
    setVisible(
      status === 'needs-review'
        ? 'needsReview'
        : status === 'translated'
          ? 'translated'
          : 'untranslated'
    );
  }, [currentEntry, getEntryStatus]);
  useEffect(() => {
    setActiveColumn(visible);
  }, [visible, setActiveColumn]);

  return (
    <div className={styles.columnsContainer}>
      <div className={styles.statusFilters}>
        <Segmented<ColumnType>
          block
          value={visible}
          onChange={setVisible}
          aria-label={t('entryList.filterStatus')}
          options={columns.map((column) => ({
            value: column,
            title: `${t(`entryList.${column}`)}: ${groupedEntries[column].length}`,
            label: (
              <span
                className={styles.filterLabel}
                aria-label={`${t(`entryList.${column}`)}: ${groupedEntries[column].length}`}
              >
                <span className={styles.filterText}>{t(`entryList.compact.${column}`)}</span>
                <span className={styles.filterCount} aria-hidden="true">
                  {groupedEntries[column].length}
                </span>
              </span>
            ),
          }))}
        />
      </div>
      <VirtualizedColumn
        key={visible}
        title={t(`entryList.${visible}`)}
        items={groupedEntries[visible]}
        statusColor={statusColors[visible]}
        columnType={visible}
        selectedIndices={selectedIndices}
        currentEntry={currentEntry}
        onRowClick={onRowClick}
        onConfirm={onConfirm}
        getEntryStatus={getEntryStatus}
        onConfirmAll={onConfirmAll}
        onRemoveAll={onRemoveAll}
        setActiveColumn={setActiveColumn}
      />
    </div>
  );
});
