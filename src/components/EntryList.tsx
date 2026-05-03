import React, { useState, useEffect, useRef, memo, useCallback, useMemo } from 'react';
import { Progress } from 'antd';
import { POEntry } from '../types/tauri';
import { useUpdateEntry } from '../store';
import { CSS_COLORS } from '../hooks/useCssColors';
import { createModuleLogger } from '../utils/logger';
import { announceToScreenReader } from '../utils/accessibility';
import styles from './EntryList.module.css';

import { useEntrySelection } from '../hooks/useEntrySelection';
import { StatusColumns, BatchActions, ColumnType, IndexedEntry } from './entryList';

const log = createModuleLogger('EntryList');

interface EntryListProps {
  entries: POEntry[];
  currentEntry: POEntry | null;
  isTranslating: boolean;
  progress: number;
  onEntrySelect: (entry: POEntry) => void;
  onTranslateSelected?: (indices: number[]) => void;
  onContextualRefine?: (indices: number[]) => void;
}

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

  const containerRef = useRef<HTMLDivElement>(null);

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

    log.info('条目分组', {
      total: entries.length,
      untranslated: groups.untranslated.length,
      needsReview: groups.needsReview.length,
      translated: groups.translated.length,
    });

    return groups;
  }, [entries, getEntryStatus]);

  // 当前激活列
  const [activeColumn, setActiveColumn] = useState<ColumnType | null>(null);

  const {
    selectedIndices,
    setSelectedIndices,
    clearSelection,
    handleRowClick,
  } = useEntrySelection({
    entries,
    groupedEntries,
    activeColumn,
    onEntrySelect,
  });

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
    selectedIndices.forEach((index) => {
      const entry = entries[index];
      if (entry && getEntryStatus(entry) === 'needs-review') {
        updateEntry(index, { needsReview: false });
      }
    });
    clearSelection();
  };

  // 翻译已选中条目
  const handleTranslateSelected = () => {
    if (onTranslateSelected && selectedIndices.length > 0) {
      onTranslateSelected(selectedIndices);
    }
  };

  // 精翻已选中条目
  const handleContextualRefine = useCallback(() => {
    if (onContextualRefine && selectedIndices.length > 0) {
      onContextualRefine(selectedIndices);
    }
  }, [onContextualRefine, selectedIndices]);

  // 移除指定列的所有翻译
  const handleRemoveAll = useCallback(
    (columnType: 'needsReview' | 'translated') => {
      const targetEntries = groupedEntries[columnType];
      targetEntries.forEach(({ index }) => {
        updateEntry(index, { msgstr: '', needsReview: false, translationSource: undefined });
      });
      clearSelection();
    },
    [groupedEntries, updateEntry, clearSelection]
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl+A 或 Cmd+A 全选当前列
      if ((event.ctrlKey || event.metaKey) && event.key === 'a') {
        event.preventDefault();

        if (activeColumn) {
          const columnEntries = groupedEntries[activeColumn];
          const columnKeys = columnEntries.map(({ index }) => index);
          setSelectedIndices(columnKeys);
        } else {
          const allKeys = entries.map((_, index) => index);
          setSelectedIndices(allKeys);
        }
      }
      // Ctrl+C 或 Cmd+C 复制选中内容
      else if ((event.ctrlKey || event.metaKey) && event.key === 'c') {
        if (selectedIndices.length > 0) {
          event.preventDefault();
          const selectedTexts = selectedIndices
            .map((index) => {
              const entry = entries[index];
              return `${entry.msgid || ''}\t${entry.msgstr || ''}`;
            })
            .join('\n');

          navigator.clipboard.writeText(selectedTexts).then(() => {
            log.info(`已复制条目到剪贴板`, { count: selectedIndices.length });
            announceToScreenReader(`已复制 ${selectedIndices.length} 条翻译条目到剪贴板`, 'polite');
          });
        }
      }
      // Escape 取消选择
      else if (event.key === 'Escape') {
        clearSelection();
      }
      // Ctrl+D 或 Cmd+D 取消选择
      else if ((event.ctrlKey || event.metaKey) && event.key === 'd') {
        event.preventDefault();
        clearSelection();
      }
      // Ctrl+Shift+R 精翻选中的待确认条目
      else if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'R') {
        event.preventDefault();
        if (selectedIndices.length > 0 && !isTranslating) {
          const hasNeedsReview = selectedIndices.some((index) => {
            const entry = entries[index];
            return entry && getEntryStatus(entry) === 'needs-review';
          });

          if (hasNeedsReview) {
            handleContextualRefine();
            log.info('快捷键触发精翻', { count: selectedIndices.length });
            announceToScreenReader(`正在精翻 ${selectedIndices.length} 条翻译`, 'polite');
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
    selectedIndices,
    activeColumn,
    groupedEntries,
    getEntryStatus,
    isTranslating,
    handleContextualRefine,
    setSelectedIndices,
    clearSelection,
  ]);

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
          共 {entries.length} 条 {selectedIndices.length > 0 && `(已选 ${selectedIndices.length})`}
        </span>
        <div className={styles.headerActions}>
          {selectedIndices.length > 0 && (
            <>
              <BatchActions
                selectedIndices={selectedIndices}
                entries={entries}
                getEntryStatus={getEntryStatus}
                onConfirmSelected={handleConfirmSelected}
                onContextualRefine={handleContextualRefine}
                onTranslateSelected={handleTranslateSelected}
                isTranslating={isTranslating}
              />
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

      <StatusColumns
        groupedEntries={groupedEntries}
        currentEntry={currentEntry}
        selectedIndices={selectedIndices}
        getEntryStatus={getEntryStatus}
        onRowClick={handleRowClick}
        onConfirm={handleConfirm}
        onConfirmAll={handleConfirmAll}
        onRemoveAll={handleRemoveAll}
        setActiveColumn={setActiveColumn}
      />
    </div>
  );
});
