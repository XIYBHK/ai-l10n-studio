import React, { memo, useRef } from 'react';
import { Badge, Button } from 'antd';
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
    tm: { bg: colors.sourceTmBg, color: colors.sourceTmColor, label: '记忆' },
    dedup: { bg: colors.sourceDedupBg, color: colors.sourceDedupColor, label: '去重' },
    ai: { bg: colors.sourceAiBg, color: colors.sourceAiColor, label: 'AI' },
  };
  return styles[source || 'ai'];
}

// 获取条目背景色（用于内联样式）
function getEntryBackground(isSelected: boolean, isCurrent: boolean): string {
  if (isSelected) return CSS_COLORS.selectedBg;
  if (isCurrent) return CSS_COLORS.hoverBg;
  return CSS_COLORS.bgPrimary;
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
  getEntryStatus: (entry: POEntry) => string
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
      aria-label={getEntryStatusDescription(status, globalIndex, isSelected)}
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
        backgroundColor: getEntryBackground(isSelected, isCurrent),
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
              backgroundColor: getSourceStyle(entry.translationSource, CSS_COLORS).bg,
              color: getSourceStyle(entry.translationSource, CSS_COLORS).color,
            }}
          >
            {getSourceStyle(entry.translationSource, CSS_COLORS).label}
          </span>
        )}
      </div>
      <TruncatedText
        text={entry.msgid || '(空)'}
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
            aria-label={`确认第 ${globalIndex + 1} 条翻译`}
            style={{
              fontSize: 'var(--font-size-xs)',
              height: '20px',
              padding: '0 6px',
            }}
          >
            确认
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
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 80,
    overscan: 5,
  });

  return (
    <div
      className={styles.virtualColumnContainer}
      role="region"
      aria-label={`${title}列表 (${items.length}项)`}
      style={{
        borderRight:
          columnType !== 'translated' ? `1px solid ${CSS_COLORS.borderSecondary}` : 'none',
      }}
      onMouseEnter={() => setActiveColumn(columnType)}
      onMouseLeave={() => setActiveColumn(null)}
    >
      <div className={styles.columnHeader}>
        <div className={styles.columnHeaderLeft}>
          <Badge color={statusColor} />
          <span style={{ flexShrink: 0 }}>{title}</span>
          <span className={styles.countBadge} aria-label={`${items.length}项`}>
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
              aria-label={`确认所有${title} (${items.length}项)`}
              style={{ color: CSS_COLORS.brandPrimary }}
            >
              确认所有
            </Button>
            <Button
              type="link"
              size="small"
              danger
              onClick={() => onRemoveAll('needsReview')}
              className={styles.actionButton}
              aria-label={`移除所有${title}`}
            >
              移除
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
            aria-label={`移除所有${title}`}
          >
            移除
          </Button>
        )}
      </div>

      <div
        ref={parentRef}
        className={`${styles.scrollContainer} virtual-scroll-optimized`}
        role="list"
        aria-label={`${title}条目`}
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
                getEntryStatus
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
});
