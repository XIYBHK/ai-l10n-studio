import React, { memo, useRef } from 'react';
import { Badge, Button } from 'antd';
import { useTranslation } from 'react-i18next';
import { CheckOutlined } from '@ant-design/icons';
import { useVirtualizer } from '@tanstack/react-virtual';
import { POEntry } from '../../types/tauri';
import { CSS_COLORS } from '../../hooks/useCssColors';
import { getEntryStatusDescription } from '../../utils/accessibility';
import { TruncatedText } from '../TruncatedText';
import { EmptyState } from '../ui/EmptyState';
import styles from '../EntryList.module.css';

export type ColumnType = 'untranslated' | 'needsReview' | 'translated';
export type IndexedEntry = { entry: POEntry; index: number };

// 获取翻译来源样式
function getSourceStyle(
  source: 'tm' | 'dedup' | 'ai' | undefined,
  labels: { tm: string; dedup: string; ai: string },
  colors: {
    sourceTmBg: string;
    sourceTmColor: string;
    sourceDedupBg: string;
    sourceDedupColor: string;
    sourceAiBg: string;
    sourceAiColor: string;
  }
) {
  const styles = {
    tm: { bg: colors.sourceTmBg, color: colors.sourceTmColor, label: labels.tm },
    dedup: { bg: colors.sourceDedupBg, color: colors.sourceDedupColor, label: labels.dedup },
    ai: { bg: colors.sourceAiBg, color: colors.sourceAiColor, label: labels.ai },
  };
  return styles[source || 'ai'];
}

// 获取条目状态CSS类名
export function getStatusClassName(entry: POEntry): string {
  if (!entry.msgid) return '';
  if (entry.msgstr && entry.needsReview) return styles.needsReview;
  if (entry.msgstr) return styles.translated;
  return styles.untranslated;
}

// 渲染单个列表项
const renderVirtualItem = (
  entry: POEntry,
  globalIndex: number,
  virtualItem: { size: number; start: number },
  selectedIndices: number[],
  currentEntry: POEntry | null,
  columnType: ColumnType,
  onRowClick: (
    entry: POEntry,
    index: number,
    event: React.MouseEvent,
    columnType: ColumnType
  ) => void,
  onConfirm: (index: number, event: React.MouseEvent) => void,
  getEntryStatus: (entry: POEntry) => string,
  labels: {
    tm: string;
    dedup: string;
    ai: string;
    empty: string;
    confirm: string;
    confirmItem: string;
    itemLabel: string;
  }
) => {
  const isSelected = selectedIndices.includes(globalIndex);
  const isCurrent = currentEntry === entry;
  const status = getEntryStatus(entry) as 'untranslated' | 'needs-review' | 'translated' | 'empty';
  const statusClass = getStatusClassName(entry);

  return (
    <div
      key={`${columnType}-${globalIndex}`}
      role="listitem"
      aria-selected={isSelected}
      aria-label={labels.itemLabel
        .replace('{{index}}', String(globalIndex + 1))
        .replace('{{status}}', getEntryStatusDescription(status, isSelected))}
      tabIndex={0}
      className={`
        ${styles.virtualItem}
        ${isSelected ? styles.selected : ''}
        ${isCurrent ? styles.current : ''}
        ${statusClass}
      `}
      style={{
        height: `${virtualItem.size}px`,
        transform: `translateY(${virtualItem.start}px)`,
      }}
      onClick={(event) => onRowClick(entry, globalIndex, event, columnType)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onRowClick(entry, globalIndex, e as unknown as React.MouseEvent, columnType);
        }
      }}
    >
      <div className={styles.virtualItemMeta}>
        <span className={styles.indexLabel}>#{globalIndex + 1}</span>
        {status === 'needs-review' && entry.translationSource && (
          <span
            className={styles.sourceBadge}
            style={{
              backgroundColor: getSourceStyle(entry.translationSource, labels, CSS_COLORS).bg,
              color: getSourceStyle(entry.translationSource, labels, CSS_COLORS).color,
            }}
          >
            {getSourceStyle(entry.translationSource, labels, CSS_COLORS).label}
          </span>
        )}
      </div>
      <TruncatedText
        text={entry.msgid || labels.empty}
        maxWidth="100%"
        className={styles.msgidText}
        style={{
          color: entry.msgid ? CSS_COLORS.textPrimary : CSS_COLORS.textDisabled,
        }}
      />
      {entry.msgstr && (
        <TruncatedText
          text={entry.msgstr}
          maxWidth="100%"
          className={styles.msgstrText}
          style={{ color: CSS_COLORS.textSecondary }}
        />
      )}
      {status === 'needs-review' && isSelected && (
        <div className={styles.confirmButtonWrapper}>
          <Button
            type="primary"
            size="small"
            icon={<CheckOutlined />}
            onClick={(e) => onConfirm(globalIndex, e)}
            aria-label={labels.confirmItem.replace('{{index}}', String(globalIndex + 1))}
            style={{
              fontSize: 'var(--font-size-xs)',
              height: '20px',
              padding: '0 6px',
            }}
          >
            {labels.confirm}
          </Button>
        </div>
      )}
    </div>
  );
};

export interface VirtualizedColumnProps {
  title: string;
  items: IndexedEntry[];
  statusColor: string;
  columnType: ColumnType;
  selectedIndices: number[];
  currentEntry: POEntry | null;
  onRowClick: (
    entry: POEntry,
    index: number,
    event: React.MouseEvent,
    columnType: ColumnType
  ) => void;
  onConfirm: (index: number, event: React.MouseEvent) => void;
  getEntryStatus: (entry: POEntry) => string;
  onConfirmAll: () => void;
  onRemoveAll: (columnType: 'needsReview' | 'translated') => void;
  setActiveColumn: React.Dispatch<React.SetStateAction<ColumnType | null>>;
}

export const VirtualizedColumn = memo(function VirtualizedColumn({
  title,
  items,
  statusColor,
  columnType,
  selectedIndices,
  currentEntry,
  onRowClick,
  onConfirm,
  getEntryStatus,
  onConfirmAll,
  onRemoveAll,
  setActiveColumn,
}: VirtualizedColumnProps) {
  const { t } = useTranslation();
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 88,
    overscan: 5,
  });

  return (
    <div
      className={styles.virtualColumnContainer}
      role="region"
      aria-label={t('workspace.list.region', { title, count: items.length })}
      onMouseEnter={() => setActiveColumn(columnType)}
    >
      <div className={styles.columnHeader}>
        <div className={styles.columnHeaderLeft}>
          <Badge color={statusColor} />
          <span style={{ flexShrink: 0 }}>{title}</span>
          <span
            className={styles.countBadge}
            aria-label={t('workspace.list.count', { count: items.length })}
          >
            {items.length}
          </span>
        </div>

        {columnType === 'needsReview' && items.length > 0 && (
          <div className={styles.columnActions}>
            <Button
              type="link"
              size="small"
              onClick={onConfirmAll}
              className={styles.actionButton}
              aria-label={t('workspace.list.confirmAll', { title, count: items.length })}
              style={{ color: CSS_COLORS.brandPrimary }}
            >
              {t('entryList.confirmAll')}
            </Button>
            <Button
              type="link"
              size="small"
              danger
              onClick={() => onRemoveAll('needsReview')}
              className={styles.actionButton}
              aria-label={t('workspace.list.removeAll', { title })}
            >
              {t('workspace.list.remove')}
            </Button>
          </div>
        )}

        {columnType === 'translated' && items.length > 0 && (
          <Button
            type="link"
            size="small"
            danger
            onClick={() => onRemoveAll('translated')}
            className={styles.actionButton}
            aria-label={t('workspace.list.removeAll', { title })}
          >
            {t('workspace.list.remove')}
          </Button>
        )}
      </div>

      <div
        ref={parentRef}
        className={`${styles.scrollContainer} virtual-scroll-optimized`}
        role="list"
        aria-label={t('workspace.list.items', { title })}
      >
        {items.length === 0 ? (
          <EmptyState type="column-empty" />
        ) : (
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {virtualizer.getVirtualItems().map((virtualItem) => {
              const { entry, index } = items[virtualItem.index];
              return renderVirtualItem(
                entry,
                index,
                virtualItem,
                selectedIndices,
                currentEntry,
                columnType,
                onRowClick,
                onConfirm,
                getEntryStatus,
                {
                  tm: t('workspace.editor.sourceMemory'),
                  dedup: t('workspace.editor.sourceDedup'),
                  ai: t('workspace.list.sourceAI'),
                  empty: t('workspace.editor.empty'),
                  confirm: t('entryList.confirm'),
                  confirmItem: t('workspace.list.confirmItem'),
                  itemLabel: t('workspace.list.itemLabel'),
                }
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
});
