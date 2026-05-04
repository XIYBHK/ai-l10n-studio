import React, { useState, useEffect, useRef, memo } from 'react';
import { POEntry } from '../../types/tauri';
import { CSS_COLORS } from '../../hooks/useCssColors';
import styles from '../EntryList.module.css';
import { VirtualizedColumn, ColumnType, IndexedEntry } from './VirtualizedColumn';

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

  return (
    <div ref={containerRef} className={styles.columnsContainer}>
      {/* 第一列 - 未翻译 */}
      <div ref={col1Ref} className={styles.column} style={{ width: `${columnWidths[0]}%` }}>
        <VirtualizedColumn
          title="未翻译"
          items={groupedEntries.untranslated}
          statusColor={CSS_COLORS.statusUntranslated}
          columnType="untranslated"
          selectedIndices={selectedIndices}
          currentEntry={currentEntry}
          onRowClick={onRowClick}
          onConfirm={onConfirm}
          getEntryStatus={getEntryStatus}
          onConfirmAll={onConfirmAll}
          onRemoveAll={onRemoveAll}
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
        <VirtualizedColumn
          title="待确认"
          items={groupedEntries.needsReview}
          statusColor={CSS_COLORS.statusNeedsReview}
          columnType="needsReview"
          selectedIndices={selectedIndices}
          currentEntry={currentEntry}
          onRowClick={onRowClick}
          onConfirm={onConfirm}
          getEntryStatus={getEntryStatus}
          onConfirmAll={onConfirmAll}
          onRemoveAll={onRemoveAll}
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
        <VirtualizedColumn
          title="已翻译"
          items={groupedEntries.translated}
          statusColor={CSS_COLORS.statusTranslated}
          columnType="translated"
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
    </div>
  );
});
