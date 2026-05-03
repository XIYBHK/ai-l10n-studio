import { useState, useCallback, useMemo } from 'react';
import { POEntry } from '../types/tauri';

type ColumnType = 'untranslated' | 'needsReview' | 'translated';
type IndexedEntry = { entry: POEntry; index: number };

interface UseEntrySelectionProps {
  entries: POEntry[];
  groupedEntries: Record<ColumnType, IndexedEntry[]>;
  activeColumn: ColumnType | null;
  onEntrySelect: (entry: POEntry) => void;
}

export function useEntrySelection({
  entries,
  groupedEntries,
  activeColumn,
  onEntrySelect,
}: UseEntrySelectionProps) {
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [lastClickedIndex, setLastClickedIndex] = useState<number | null>(null);
  const [lastClickedColumn, setLastClickedColumn] = useState<ColumnType | null>(null);

  const clearSelection = useCallback(() => {
    setSelectedIndices([]);
  }, []);

  const selectAll = useCallback(() => {
    if (activeColumn) {
      const columnEntries = groupedEntries[activeColumn];
      const columnKeys = columnEntries.map(({ index }) => index);
      setSelectedIndices(columnKeys);
    } else {
      const allKeys = entries.map((_, index) => index);
      setSelectedIndices(allKeys);
    }
  }, [activeColumn, groupedEntries, entries]);

  const toggleSelection = useCallback((index: number) => {
    setSelectedIndices((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
    );
  }, []);

  const selectRange = useCallback(
    (index: number, columnType: ColumnType) => {
      if (lastClickedIndex !== null && lastClickedColumn === columnType) {
        const columnEntries = groupedEntries[columnType];
        const columnIndices = columnEntries.map(({ index: entryIndex }) => entryIndex);

        const lastIndexInColumn = columnIndices.indexOf(lastClickedIndex);
        const currentIndexInColumn = columnIndices.indexOf(index);

        if (lastIndexInColumn !== -1 && currentIndexInColumn !== -1) {
          const start = Math.min(lastIndexInColumn, currentIndexInColumn);
          const end = Math.max(lastIndexInColumn, currentIndexInColumn);
          const rangeKeys = columnIndices.slice(start, end + 1);
          setSelectedIndices(rangeKeys);
        }
      }
    },
    [lastClickedIndex, lastClickedColumn, groupedEntries]
  );

  const handleRowClick = useCallback(
    (record: POEntry, index: number, event: React.MouseEvent, columnType: ColumnType) => {
      onEntrySelect(record);

      if (event.shiftKey) {
        selectRange(index, columnType);
      } else if (event.ctrlKey || event.metaKey) {
        toggleSelection(index);
      } else {
        setSelectedIndices([index]);
        setLastClickedIndex(index);
        setLastClickedColumn(columnType);
      }
    },
    [onEntrySelect, selectRange, toggleSelection]
  );

  const isSelected = useCallback(
    (index: number) => selectedIndices.includes(index),
    [selectedIndices]
  );

  return {
    selectedIndices,
    setSelectedIndices,
    toggleSelection,
    clearSelection,
    selectAll,
    selectRange,
    isSelected,
    handleRowClick,
  };
}
