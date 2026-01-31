import React, { useState, useEffect, useRef, memo, useCallback, useMemo } from 'react';
import { Progress, Button, Badge } from 'antd';
import { CheckOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { useVirtualizer } from '@tanstack/react-virtual';
import { POEntry } from '../types/tauri';
import { useUpdateEntry } from '../store';
import { CSS_COLORS } from '../hooks/useCssColors';
import { createModuleLogger } from '../utils/logger';
import {
  announceToScreenReader,
  getBatchActionAriaLabel,
  getEntryStatusDescription,
} from '../utils/accessibility';
import { TruncatedText } from './TruncatedText';
import { EmptyState } from './EmptyState';
import styles from './EntryList.module.css';

const log = createModuleLogger('EntryList');

type ColumnType = 'untranslated' | 'needsReview' | 'translated';
type IndexedEntry = { entry: POEntry; index: number };

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

// 获取条目状态CSS类名
function getStatusClassName(entry: POEntry): string {
  if (!entry.msgid) return '';
  if (entry.msgstr && entry.needsReview) return styles.needsReview;
  if (entry.msgstr) return styles.translated;
  return styles.untranslated;
}

// 获取条目背景色（用于内联样式）
function getEntryBackground(isSelected: boolean, isCurrent: boolean): string {
  if (isSelected) return CSS_COLORS.selectedBg;
  if (isCurrent) return CSS_COLORS.hoverBg;
  return CSS_COLORS.bgPrimary;
}

interface EntryListProps {
  entries: POEntry[];
  currentEntry: POEntry | null;
  isTranslating: boolean;
  progress: number;
  onEntrySelect: (entry: POEntry) => void;
  onTranslateSelected?: (indices: number[]) => void;
  onContextualRefine?: (indices: number[]) => void;
}

// 渲染单个列表项
const renderVirtualItem = (
  entry: POEntry,
  globalIndex: number,
  virtualItem: { size: number; start: number },
  selectedRowKeys: React.Key[],
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
  const isSelected = selectedRowKeys.includes(globalIndex);
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

interface VirtualColumnProps {
  title: string;
  items: IndexedEntry[];
  statusColor: string;
  columnType: ColumnType;
  selectedRowKeys: React.Key[];
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

const VirtualColumn = memo(function VirtualColumn({
  title,
  items,
  statusColor,
  columnType,
  selectedRowKeys,
  currentEntry,
  onRowClick,
  onConfirm,
  getEntryStatus,
  onConfirmAll,
  onRemoveAll,
  setActiveColumn,
}: VirtualColumnProps) {
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
          <EmptyState type="column-empty" columnType={columnType} />
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
                selectedRowKeys,
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

export const EntryList = memo(function EntryList({
  entries,
  currentEntry,
  isTranslating,
  progress,
  onEntrySelect,
  onTranslateSelected,
  onContextualRefine,
}: EntryListProps) {
  const updateEntry = useUpdateEntry();

  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [lastClickedIndex, setLastClickedIndex] = useState<number | null>(null);
  const [lastClickedColumn, setLastClickedColumn] = useState<
    'untranslated' | 'needsReview' | 'translated' | null
  >(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const col1Ref = useRef<HTMLDivElement>(null);
  const col2Ref = useRef<HTMLDivElement>(null);
  const col3Ref = useRef<HTMLDivElement>(null);

  const [columnWidths, setColumnWidths] = useState([33.33, 33.33, 33.34]);
  const widthsRef = useRef(columnWidths);
  const [resizingColumn, setResizingColumn] = useState<number | null>(null);

  useEffect(() => {
    widthsRef.current = columnWidths;
  }, [columnWidths]);

  const getEntryStatus = useCallback((entry: POEntry) => {
    if (!entry.msgid) return 'empty';
    if (entry.msgstr && entry.needsReview) return 'needs-review';
    if (entry.msgstr) return 'translated';
    return 'untranslated';
  }, []);

  // 按状态分组条目
  const groupedEntries = useMemo(() => {
    const groups: Record<ColumnType, IndexedEntry[]> = {
      untranslated: [],
      needsReview: [],
      translated: [],
    };

    entries.forEach((entry, index) => {
      const status = getEntryStatus(entry);
      if (status === 'untranslated') groups.untranslated.push({ entry, index });
      if (status === 'needs-review') groups.needsReview.push({ entry, index });
      if (status === 'translated') groups.translated.push({ entry, index });
    });

    log.info('📊 条目分组', {
      total: entries.length,
      untranslated: groups.untranslated.length,
      needsReview: groups.needsReview.length,
      translated: groups.translated.length,
    });

    return groups;
  }, [entries, getEntryStatus]);

  // 确认翻译
  const handleConfirm = useCallback(
    (index: number, event: React.MouseEvent) => {
      event.stopPropagation();
      updateEntry(index, { needsReview: false });
    },
    [updateEntry]
  );

  // 确认所有待确认条目
  const handleConfirmAll = useCallback(() => {
    groupedEntries.needsReview.forEach(({ index }) => {
      updateEntry(index, { needsReview: false });
    });
  }, [groupedEntries.needsReview, updateEntry]);

  // 确认已选中条目
  const handleConfirmSelected = () => {
    selectedRowKeys.forEach((key) => {
      const index = key as number;
      const entry = entries[index];
      if (entry && getEntryStatus(entry) === 'needs-review') {
        updateEntry(index, { needsReview: false });
      }
    });
    setSelectedRowKeys([]);
  };

  // 翻译已选中条目
  const handleTranslateSelected = () => {
    if (onTranslateSelected && selectedRowKeys.length > 0) {
      const indices = selectedRowKeys.map((key) => key as number);
      onTranslateSelected(indices);
    }
  };

  // 精翻已选中条目
  const handleContextualRefine = () => {
    if (onContextualRefine && selectedRowKeys.length > 0) {
      const indices = selectedRowKeys.map((key) => key as number);
      onContextualRefine(indices);
    }
  };

  // 当前激活列
  const [activeColumn, setActiveColumn] = useState<
    'untranslated' | 'needsReview' | 'translated' | null
  >(null);

  // 移除指定列的所有翻译
  const handleRemoveAll = useCallback(
    (columnType: 'needsReview' | 'translated') => {
      const targetEntries = groupedEntries[columnType];
      targetEntries.forEach(({ index }) => {
        updateEntry(index, { msgstr: '', needsReview: false, translationSource: undefined });
      });
      setSelectedRowKeys([]);
    },
    [groupedEntries, updateEntry]
  );

  // 列宽调整
  useEffect(() => {
    if (resizingColumn === null) return;

    let animationFrameId: number;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;

      cancelAnimationFrame(animationFrameId);
      animationFrameId = requestAnimationFrame(() => {
        if (!containerRef.current) return;

        const containerRect = containerRef.current.getBoundingClientRect();
        const currentWidths = [...widthsRef.current];
        const mouseX = e.clientX - containerRect.left;
        const containerWidth = containerRect.width;
        const percentage = (mouseX / containerWidth) * 100;

        if (resizingColumn === 0) {
          const minWidth = 15;
          const maxWidth = 100 - minWidth * 2;
          const newFirstWidth = Math.max(minWidth, Math.min(maxWidth, percentage));
          const diff = newFirstWidth - currentWidths[0];
          currentWidths[0] = newFirstWidth;
          currentWidths[1] = Math.max(minWidth, currentWidths[1] - diff);
        } else if (resizingColumn === 1) {
          const minWidth = 15;
          const firstWidth = currentWidths[0];
          const newSecondWidth = Math.max(
            minWidth,
            Math.min(100 - firstWidth - minWidth, percentage - firstWidth)
          );
          const diff = newSecondWidth - currentWidths[1];
          currentWidths[1] = newSecondWidth;
          currentWidths[2] = Math.max(minWidth, currentWidths[2] - diff);
        }

        if (col1Ref.current) col1Ref.current.style.width = `${currentWidths[0]}%`;
        if (col2Ref.current) col2Ref.current.style.width = `${currentWidths[1]}%`;
        if (col3Ref.current) col3Ref.current.style.width = `${currentWidths[2]}%`;

        widthsRef.current = currentWidths;
      });
    };

    const handleMouseUp = () => {
      cancelAnimationFrame(animationFrameId);
      setResizingColumn(null);
      setColumnWidths(widthsRef.current);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    return () => {
      cancelAnimationFrame(animationFrameId);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [resizingColumn]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl+A 或 Cmd+A 全选当前列
      if ((event.ctrlKey || event.metaKey) && event.key === 'a') {
        event.preventDefault();

        if (activeColumn) {
          const columnEntries = groupedEntries[activeColumn];
          const columnKeys = columnEntries.map(({ index }) => index);
          setSelectedRowKeys(columnKeys);
        } else {
          const allKeys = entries.map((_, index) => index);
          setSelectedRowKeys(allKeys);
        }
      }
      // Ctrl+C 或 Cmd+C 复制选中内容
      else if ((event.ctrlKey || event.metaKey) && event.key === 'c') {
        if (selectedRowKeys.length > 0) {
          event.preventDefault();
          const selectedTexts = selectedRowKeys
            .map((key) => {
              const index = key as number;
              const entry = entries[index];
              return `${entry.msgid || ''}\t${entry.msgstr || ''}`;
            })
            .join('\n');

          navigator.clipboard.writeText(selectedTexts).then(() => {
            log.info(`已复制条目到剪贴板`, { count: selectedRowKeys.length });
            announceToScreenReader(`已复制 ${selectedRowKeys.length} 条翻译条目到剪贴板`, 'polite');
          });
        }
      }
      // Escape 取消选择
      else if (event.key === 'Escape') {
        setSelectedRowKeys([]);
      }
      // Ctrl+D 或 Cmd+D 取消选择
      else if ((event.ctrlKey || event.metaKey) && event.key === 'd') {
        event.preventDefault();
        setSelectedRowKeys([]);
      }
      // Ctrl+Shift+R 精翻选中的待确认条目
      else if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'R') {
        event.preventDefault();
        if (selectedRowKeys.length > 0 && !isTranslating) {
          const hasNeedsReview = selectedRowKeys.some((key) => {
            const entry = entries[key as number];
            return entry && getEntryStatus(entry) === 'needs-review';
          });

          if (hasNeedsReview) {
            handleContextualRefine();
            log.info('快捷键触发精翻', { count: selectedRowKeys.length });
            announceToScreenReader(`正在精翻 ${selectedRowKeys.length} 条翻译`, 'polite');
          }
        }
      }
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('keydown', handleKeyDown);
      container.setAttribute('tabIndex', '0');
    }

    return () => {
      if (container) {
        container.removeEventListener('keydown', handleKeyDown);
      }
    };
  }, [
    entries,
    selectedRowKeys,
    activeColumn,
    groupedEntries,
    getEntryStatus,
    isTranslating,
    handleContextualRefine,
  ]);

  const handleRowClick = useCallback(
    (record: POEntry, index: number, event: React.MouseEvent, columnType: ColumnType) => {
      onEntrySelect(record);

      if (event.shiftKey && lastClickedIndex !== null && lastClickedColumn === columnType) {
        const columnEntries = groupedEntries[columnType];
        const columnIndices = columnEntries.map(({ index: entryIndex }) => entryIndex);

        const lastIndexInColumn = columnIndices.indexOf(lastClickedIndex);
        const currentIndexInColumn = columnIndices.indexOf(index);

        if (lastIndexInColumn !== -1 && currentIndexInColumn !== -1) {
          const start = Math.min(lastIndexInColumn, currentIndexInColumn);
          const end = Math.max(lastIndexInColumn, currentIndexInColumn);
          const rangeKeys = columnIndices.slice(start, end + 1);
          setSelectedRowKeys(rangeKeys);
        }
      } else if (event.ctrlKey || event.metaKey) {
        if (selectedRowKeys.includes(index)) {
          setSelectedRowKeys(selectedRowKeys.filter((key) => key !== index));
        } else {
          setSelectedRowKeys([...selectedRowKeys, index]);
        }
      } else {
        setSelectedRowKeys([index]);
        setLastClickedIndex(index);
        setLastClickedColumn(columnType);
      }
    },
    [onEntrySelect, lastClickedIndex, lastClickedColumn, groupedEntries, entries, selectedRowKeys]
  );

  // 选中行操作按钮
  const SelectionActions = memo(function SelectionActions() {
    const hasNeedsReview = selectedRowKeys.some((key) => {
      const entry = entries[key as number];
      return entry && getEntryStatus(entry) === 'needs-review';
    });

    const hasUntranslated = selectedRowKeys.some((key) => {
      const entry = entries[key as number];
      return entry && getEntryStatus(entry) === 'untranslated';
    });

    return (
      <div className={styles.selectionActions} role="group" aria-label="批量操作">
        {hasNeedsReview && (
          <>
            <Button
              type="primary"
              size="small"
              onClick={handleConfirmSelected}
              icon={<CheckOutlined />}
              aria-label={getBatchActionAriaLabel('confirm', selectedRowKeys.length)}
            >
              确认已选中
            </Button>
            <Button
              type="default"
              size="small"
              onClick={handleContextualRefine}
              icon={<ThunderboltOutlined />}
              disabled={isTranslating}
              aria-label={getBatchActionAriaLabel('refine', selectedRowKeys.length)}
            >
              精翻选中 (Ctrl+Shift+R)
            </Button>
          </>
        )}
        {hasUntranslated && (
          <Button
            type="primary"
            size="small"
            onClick={handleTranslateSelected}
            disabled={isTranslating}
            aria-label={getBatchActionAriaLabel('translate', selectedRowKeys.length)}
          >
            翻译选中
          </Button>
        )}
      </div>
    );
  });

  return (
    <div
      ref={containerRef}
      className={styles.container}
      role="main"
      aria-label="翻译条目列表"
      tabIndex={0}
    >
      <div className={styles.header} role="banner">
        <span className={styles.headerText} aria-live="polite" aria-atomic="true">
          共 {entries.length} 条 {selectedRowKeys.length > 0 && `(已选 ${selectedRowKeys.length})`}
        </span>
        <div className={styles.headerActions}>
          {selectedRowKeys.length > 0 && (
            <>
              <SelectionActions />
              <span className={styles.shortcutHint} aria-label="键盘快捷键">
                Ctrl+A 全选 | Ctrl+C 复制 | Esc 取消
              </span>
            </>
          )}
        </div>
      </div>

      {isTranslating && (
        <div
          className={styles.progressContainer}
          role="progressbar"
          aria-valuenow={Math.round(progress)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="翻译进度"
        >
          <Progress percent={Math.round(progress)} size="small" status="active" />
        </div>
      )}

      <div className={styles.columnsContainer}>
        {/* 第一列 - 未翻译 */}
        <div ref={col1Ref} className={styles.column} style={{ width: `${columnWidths[0]}%` }}>
          <VirtualColumn
            title="未翻译"
            items={groupedEntries.untranslated}
            statusColor={CSS_COLORS.statusUntranslated}
            columnType="untranslated"
            selectedRowKeys={selectedRowKeys}
            currentEntry={currentEntry}
            onRowClick={handleRowClick}
            onConfirm={handleConfirm}
            getEntryStatus={getEntryStatus}
            onConfirmAll={handleConfirmAll}
            onRemoveAll={handleRemoveAll}
            setActiveColumn={setActiveColumn}
          />
          <div
            onMouseDown={() => setResizingColumn(0)}
            className={styles.resizeHandle}
            onMouseEnter={(e) =>
              (e.currentTarget.style.backgroundColor = CSS_COLORS.statusUntranslated)
            }
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          />
        </div>

        {/* 第二列 - 待确认 */}
        <div ref={col2Ref} className={styles.column} style={{ width: `${columnWidths[1]}%` }}>
          <VirtualColumn
            title="待确认"
            items={groupedEntries.needsReview}
            statusColor={CSS_COLORS.statusNeedsReview}
            columnType="needsReview"
            selectedRowKeys={selectedRowKeys}
            currentEntry={currentEntry}
            onRowClick={handleRowClick}
            onConfirm={handleConfirm}
            getEntryStatus={getEntryStatus}
            onConfirmAll={handleConfirmAll}
            onRemoveAll={handleRemoveAll}
            setActiveColumn={setActiveColumn}
          />
          <div
            onMouseDown={() => setResizingColumn(1)}
            className={styles.resizeHandle}
            onMouseEnter={(e) =>
              (e.currentTarget.style.backgroundColor = CSS_COLORS.statusNeedsReview)
            }
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          />
        </div>

        {/* 第三列 - 已翻译 */}
        <div ref={col3Ref} className={styles.column} style={{ width: `${columnWidths[2]}%` }}>
          <VirtualColumn
            title="已翻译"
            items={groupedEntries.translated}
            statusColor={CSS_COLORS.statusTranslated}
            columnType="translated"
            selectedRowKeys={selectedRowKeys}
            currentEntry={currentEntry}
            onRowClick={handleRowClick}
            onConfirm={handleConfirm}
            getEntryStatus={getEntryStatus}
            onConfirmAll={handleConfirmAll}
            onRemoveAll={handleRemoveAll}
            setActiveColumn={setActiveColumn}
          />
        </div>
      </div>
    </div>
  );
});
