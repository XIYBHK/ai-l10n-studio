import React, { useState, useEffect, useRef, memo, useCallback } from 'react';
import { Progress, Button, Badge } from 'antd';
import { CheckOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { List } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
import { POEntry } from '../types/tauri';
import { useSessionStore } from '../store';
import { useTheme } from '../hooks/useTheme';
import { createModuleLogger } from '../utils/logger';

// 💡 优化：使用 React.memo 避免不必要的重渲染
const log = createModuleLogger('EntryList');

interface EntryListProps {
  entries: POEntry[];
  currentEntry: POEntry | null;
  isTranslating: boolean;
  progress: number;
  onEntrySelect: (entry: POEntry) => void;
  onTranslateSelected?: (indices: number[]) => void;
  onContextualRefine?: (indices: number[]) => void; // Phase 7: 精翻选中的条目
}

// 列表项组件（react-window 2.x rowComponent）
// react-window 2.x 会自动传入 { index, style, ariaAttributes, ...rowProps }
const RowItem = (props: any) => {
  const { index, style, items, entries, selectedRowKeys, currentEntry, colors, columnType, onRowClick, onConfirm } = props;
  
  // 调试日志：查看 props
  if (index === 0) {
    log.info('🔍 RowItem props (index=0)', {
      hasItems: !!items,
      itemsLength: items?.length,
      index,
      hasStyle: !!style,
      allPropsKeys: Object.keys(props),
      items: items ? `Array(${items.length})` : 'undefined',
      entries: entries ? `Array(${entries.length})` : 'undefined',
      firstItem: items?.[0] ? {
        msgid: items[0].msgid?.substring(0, 50),
        msgstr: items[0].msgstr?.substring(0, 50)
      } : 'no item'
    });
  }
  
  if (!items || !items[index]) {
    log.warn(`⚠️ RowItem ${index}: items 为空或索引越界`);
    return <div style={style}>空条目</div>;
  }
  
  const entry = items[index];
  
  // 添加渲染日志
  if (index < 3) {
    log.info(`✅ 渲染条目 ${index}`, {
      msgid: entry.msgid?.substring(0, 30),
      msgstr: entry.msgstr?.substring(0, 30),
      hasStyle: !!style,
      styleHeight: style?.height,
    });
  }
  const globalIndex = entries.indexOf(entry);
  const isSelected = selectedRowKeys.includes(globalIndex);
  const isCurrent = currentEntry === entry;
  
  const getEntryStatus = (entry: POEntry) => {
    if (!entry.msgid) return 'empty';
    if (entry.msgstr && entry.needsReview) return 'needs-review';
    if (entry.msgstr) return 'translated';
    return 'untranslated';
  };
  
  const status = getEntryStatus(entry);

  return (
    <div
      style={{
        ...style,
        position: 'absolute',
        left: 0,
        right: 0,
        padding: '10px 12px',
        cursor: 'pointer',
        backgroundColor: isSelected
          ? colors.selectedBg
          : isCurrent
            ? colors.hoverBg
            : colors.bgPrimary,
        borderBottom: `1px solid ${colors.borderSecondary}`,
        borderLeft: isSelected
          ? `3px solid ${colors.selectedBorder}`
          : '3px solid transparent',
        transition: 'background-color 0.1s',
        userSelect: 'none',
        boxSizing: 'border-box',
      }}
      onClick={(event) => onRowClick(entry, globalIndex, event, columnType)}
      className={isSelected ? 'table-row-selected' : ''}
    >
      <div
        style={{
          fontSize: '12px',
          color: colors.textTertiary,
          marginBottom: 6,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          height: '20px'
        }}
      >
        <span style={{ fontFamily: 'monospace', opacity: 0.7 }}>#{globalIndex + 1}</span>
        {status === 'needs-review' && entry.translationSource && (
          <span
            style={{
              fontSize: '10px',
              padding: '1px 5px',
              borderRadius: '4px',
              whiteSpace: 'nowrap',
              fontWeight: 500,
              backgroundColor:
                entry.translationSource === 'tm'
                  ? 'rgba(82, 196, 26, 0.1)'
                  : entry.translationSource === 'dedup'
                    ? 'rgba(24, 144, 255, 0.1)'
                    : 'rgba(250, 173, 20, 0.1)',
              color:
                entry.translationSource === 'tm'
                  ? '#52c41a'
                  : entry.translationSource === 'dedup'
                    ? '#1890ff'
                    : '#faad14',
              display: 'flex',
              alignItems: 'center',
              gap: '3px',
              lineHeight: '1.2'
            }}
          >
            {entry.translationSource === 'tm'
              ? '记忆'
              : entry.translationSource === 'dedup'
                ? '去重'
                : 'AI'}
          </span>
        )}
      </div>
      <div
        style={{
          fontSize: '13px',
          lineHeight: '1.5',
          marginBottom: 6,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          color: colors.textPrimary,
          fontWeight: 500,
          height: '40px' // 固定高度以保持列表项高度一致
        }}
      >
        {entry.msgid || <span style={{ color: colors.textDisabled }}>(空)</span>}
      </div>
      {entry.msgstr && (
        <div
          style={{
            fontSize: '13px',
            color: colors.textSecondary,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            height: '20px'
          }}
        >
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {entry.msgstr}
          </span>
        </div>
      )}
      {entry.msgctxt && (
        <div
          style={{
            fontSize: '11px',
            color: colors.textTertiary,
            marginTop: 6,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            background: colors.bgSecondary,
            padding: '2px 6px',
            borderRadius: '4px',
            display: 'inline-block',
            maxWidth: '100%',
            height: '20px'
          }}
          title={`上下文信息: ${entry.msgctxt}`}
        >
          📌 {entry.msgctxt}
        </div>
      )}
      {status === 'needs-review' && (
        <div style={{ marginTop: 8, textAlign: 'right', height: '24px' }}>
          <Button
            type="primary"
            size="small"
            icon={<CheckOutlined />}
            onClick={(e) => onConfirm(globalIndex, e)}
            style={{ fontSize: '12px', height: '24px', padding: '0 10px' }}
          >
            确认
          </Button>
        </div>
      )}
    </div>
  );
};

const EntryList: React.FC<EntryListProps> = memo(({
  entries,
  currentEntry,
  isTranslating,
  progress,
  onEntrySelect,
  onTranslateSelected,
  onContextualRefine, // Phase 7
}) => {
  const { updateEntry } = useSessionStore();
  const { colors } = useTheme();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [lastClickedIndex, setLastClickedIndex] = useState<number | null>(null);
  const [lastClickedColumn, setLastClickedColumn] = useState<
    'untranslated' | 'needsReview' | 'translated' | null
  >(null); // 记录上次点击的列
  const containerRef = useRef<HTMLDivElement>(null);

  // ⚡ 性能优化：使用 ref 直接操作 DOM 避免拖拽时频繁重渲染
  const col1Ref = useRef<HTMLDivElement>(null);
  const col2Ref = useRef<HTMLDivElement>(null);
  const col3Ref = useRef<HTMLDivElement>(null);
  
  // 三列宽度状态
  const [columnWidths, setColumnWidths] = useState([33.33, 33.33, 33.34]); // 百分比
  const widthsRef = useRef(columnWidths); // 使用 ref 保持最新值，避免闭包问题
  const [resizingColumn, setResizingColumn] = useState<number | null>(null);

  // 同步 ref
  useEffect(() => {
    widthsRef.current = columnWidths;
  }, [columnWidths]);

  const getEntryStatus = useCallback((entry: POEntry) => {
    if (!entry.msgid) return 'empty';
    if (entry.msgstr && entry.needsReview) return 'needs-review';
    if (entry.msgstr) return 'translated';
    return 'untranslated';
  }, []);

  // 确认翻译
  const handleConfirm = useCallback((index: number, event: React.MouseEvent) => {
    event.stopPropagation(); // 阻止触发行选择
    updateEntry(index, { needsReview: false });
  }, [updateEntry]);

  // 确认所有待确认条目
  const handleConfirmAll = useCallback(() => {
    const needsReviewEntries = entries.filter((e) => getEntryStatus(e) === 'needs-review');
    needsReviewEntries.forEach((entry) => {
      const index = entries.indexOf(entry);
      updateEntry(index, { needsReview: false });
    });
  }, [entries, getEntryStatus, updateEntry]);

  // 确认已选中条目
  const handleConfirmSelected = useCallback(() => {
    selectedRowKeys.forEach((key) => {
      const index = key as number;
      const entry = entries[index];
      if (entry && getEntryStatus(entry) === 'needs-review') {
        updateEntry(index, { needsReview: false });
      }
    });
    setSelectedRowKeys([]);
  }, [selectedRowKeys, entries, getEntryStatus, updateEntry]);

  // 翻译已选中条目
  const handleTranslateSelected = useCallback(() => {
    if (onTranslateSelected) {
      const indices = selectedRowKeys.map((key) => key as number);
      onTranslateSelected(indices);
    }
  }, [onTranslateSelected, selectedRowKeys]);

  // Phase 7: 精翻已选中条目
  const handleContextualRefine = useCallback(() => {
    if (onContextualRefine) {
      const indices = selectedRowKeys.map((key) => key as number);
      onContextualRefine(indices);
    }
  }, [onContextualRefine, selectedRowKeys]);

  // 当前激活列（用于全选）
  const [activeColumn, setActiveColumn] = useState<
    'untranslated' | 'needsReview' | 'translated' | null
  >(null);

  // 按状态分组条目 - 使用 useMemo 优化
  const groupedEntries = React.useMemo(() => {
    const groups = {
      untranslated: entries.filter((e) => getEntryStatus(e) === 'untranslated'),
      needsReview: entries.filter((e) => getEntryStatus(e) === 'needs-review'),
      translated: entries.filter((e) => getEntryStatus(e) === 'translated'),
    };
    log.info('📊 条目分组', {
      total: entries.length,
      untranslated: groups.untranslated.length,
      needsReview: groups.needsReview.length,
      translated: groups.translated.length,
    });
    return groups;
  }, [entries, getEntryStatus]);

  // 列宽调整 - 🚀 性能优化版：直接操作 DOM
  useEffect(() => {
    if (resizingColumn === null) return;

    let animationFrameId: number;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;

      // 使用 requestAnimationFrame 节流 DOM 操作
      cancelAnimationFrame(animationFrameId);
      animationFrameId = requestAnimationFrame(() => {
        if (!containerRef.current) return;
        
        const containerRect = containerRef.current.getBoundingClientRect();
        const currentWidths = [...widthsRef.current]; // 基于 ref 中的最新值
        const mouseX = e.clientX - containerRect.left;
        const containerWidth = containerRect.width;
        const percentage = (mouseX / containerWidth) * 100;

        if (resizingColumn === 0) {
          // 调整第一列和第二列
          const minWidth = 15;
          const maxWidth = 100 - minWidth * 2;
          const newFirstWidth = Math.max(minWidth, Math.min(maxWidth, percentage));
          const diff = newFirstWidth - currentWidths[0];
          currentWidths[0] = newFirstWidth;
          currentWidths[1] = Math.max(minWidth, currentWidths[1] - diff);
        } else if (resizingColumn === 1) {
          // 调整第二列和第三列
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

        // ⚡ 直接修改 DOM 样式，不触发 React 重渲染
        if (col1Ref.current) col1Ref.current.style.width = `${currentWidths[0]}%`;
        if (col2Ref.current) col2Ref.current.style.width = `${currentWidths[1]}%`;
        if (col3Ref.current) col3Ref.current.style.width = `${currentWidths[2]}%`;
        
        // 更新 ref 以供下一次计算使用
        widthsRef.current = currentWidths;
      });
    };

    const handleMouseUp = () => {
      cancelAnimationFrame(animationFrameId);
      setResizingColumn(null);
      // 拖拽结束后，同步最终状态到 React，触发一次重渲染以保持一致性
      setColumnWidths(widthsRef.current);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none'; // 防止拖拽时选中文字

    return () => {
      cancelAnimationFrame(animationFrameId);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [resizingColumn]); // 依赖项只有 resizingColumn，拖拽过程中不重新绑定事件

  // 键盘事件处理
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl+A 或 Cmd+A 全选当前列
      if ((event.ctrlKey || event.metaKey) && event.key === 'a') {
        event.preventDefault();

        if (activeColumn) {
          const columnEntries = groupedEntries[activeColumn];
          const columnKeys = columnEntries.map((entry) => entries.indexOf(entry));
          setSelectedRowKeys(columnKeys);
        } else {
          // 如果没有激活列，全选所有
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
      // Phase 7: Ctrl+Shift+R 精翻选中的待确认条目
      else if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'R') {
        event.preventDefault();
        if (selectedRowKeys.length > 0 && !isTranslating) {
          // 检查是否有待确认条目
          const hasNeedsReview = selectedRowKeys.some((key) => {
            const entry = entries[key as number];
            return entry && getEntryStatus(entry) === 'needs-review';
          });

          if (hasNeedsReview) {
            handleContextualRefine();
            log.info('快捷键触发精翻', { count: selectedRowKeys.length });
          }
        }
      }
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('keydown', handleKeyDown);
      // 设置 tabIndex 使 div 可聚焦
      container.setAttribute('tabIndex', '0');
    }

    return () => {
      if (container) {
        container.removeEventListener('keydown', handleKeyDown);
      }
    };
  }, [entries, selectedRowKeys, activeColumn, groupedEntries, getEntryStatus, isTranslating, handleContextualRefine]);

  const handleRowClick = useCallback((
    record: POEntry,
    index: number,
    event: React.MouseEvent,
    columnType: 'untranslated' | 'needsReview' | 'translated'
  ) => {
    onEntrySelect(record);

    if (event.shiftKey && lastClickedIndex !== null && lastClickedColumn === columnType) {
      // 🔧 Shift + 点击：只在同一列内选择范围
      const columnEntries = groupedEntries[columnType];
      const columnIndices = columnEntries.map((entry) => entries.indexOf(entry));

      const lastIndexInColumn = columnIndices.indexOf(lastClickedIndex);
      const currentIndexInColumn = columnIndices.indexOf(index);

      if (lastIndexInColumn !== -1 && currentIndexInColumn !== -1) {
        const start = Math.min(lastIndexInColumn, currentIndexInColumn);
        const end = Math.max(lastIndexInColumn, currentIndexInColumn);
        const rangeKeys = columnIndices.slice(start, end + 1);
        setSelectedRowKeys(rangeKeys);
      }
    } else if (event.ctrlKey || event.metaKey) {
      // Ctrl/Cmd + 点击：切换选择状态
      if (selectedRowKeys.includes(index)) {
        setSelectedRowKeys(selectedRowKeys.filter((key) => key !== index));
      } else {
        setSelectedRowKeys([...selectedRowKeys, index]);
      }
    } else {
      // 普通点击：单选
      setSelectedRowKeys([index]);
      setLastClickedIndex(index);
      setLastClickedColumn(columnType); // 记录点击的列
    }
  }, [onEntrySelect, lastClickedIndex, lastClickedColumn, groupedEntries, entries, selectedRowKeys]);

  const renderColumn = (
    title: string,
    items: POEntry[],
    statusColor: string,
    columnType: 'untranslated' | 'needsReview' | 'translated'
  ) => {
    log.debug(`🎨 渲染列: ${title}`, {
      columnType,
      itemCount: items.length,
      hasItems: items.length > 0,
    });
    
    return (<div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        borderRight: columnType !== 'translated' ? `1px solid ${colors.borderSecondary}` : 'none',
        minWidth: 0,
        minHeight: 0,
        overflow: 'hidden',
        backgroundColor: colors.bgPrimary,
      }}
      onMouseEnter={() => setActiveColumn(columnType)}
      onMouseLeave={() => setActiveColumn(null)}
    >
      <div
        style={{
          padding: '10px 12px',
          background: colors.bgTertiary,
          borderBottom: `1px solid ${colors.borderSecondary}`,
          fontSize: '13px',
          fontWeight: 600,
          color: colors.textPrimary,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          height: '42px', // 固定表头高度
          flexShrink: 0
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Badge color={statusColor} />
          <span>{title}</span>
          <span style={{ 
            fontSize: '12px', 
            fontWeight: 'normal', 
            color: colors.textTertiary,
            backgroundColor: colors.bgSecondary,
            padding: '1px 6px',
            borderRadius: '10px'
          }}>
            {items.length}
          </span>
        </div>
        {columnType === 'needsReview' && items.length > 0 && (
          <Button
            type="link"
            size="small"
            onClick={handleConfirmAll}
            style={{ fontSize: '12px', padding: 0, height: 'auto' }}
          >
            确认所有
          </Button>
        )}
      </div>
      <div style={{ flex: 1, width: '100%', height: '100%', overflow: 'hidden', position: 'relative' }}>
        <AutoSizer>
          {({ height, width }) => {
            log.info(`📐 AutoSizer ${columnType}`, { 
              height, 
              itemCount: items.length,
              calculatedHeight: height || 'undefined'
            });
            
            if (items.length === 0) {
              log.warn(`⚠️ ${columnType} 列表为空，不渲染List`);
              return <div style={{ padding: 20, color: colors.textTertiary }}>暂无数据</div>;
            }
            
            log.info(`🚀 准备渲染 List ${columnType}`, {
              rowCount: items.length,
              rowHeight: 100,
              height,
              width,
              hasRowComponent: !!RowItem
            });
            
            log.info(`🚀 List渲染 ${columnType}`, {
              rowCount: items.length,
              rowHeight: 100,
              height,
              width,
            });
            
            return (
              <List
                defaultHeight={height}
                rowCount={items.length}
                rowHeight={100}
                rowProps={{
                  items,
                  entries,
                  selectedRowKeys,
                  currentEntry,
                  colors,
                  columnType,
                  onRowClick: handleRowClick,
                  onConfirm: handleConfirm
                }}
                rowComponent={RowItem}
                style={{
                  position: 'relative',
                  overflow: 'auto'
                }}
              />
            );
          }}
        </AutoSizer>
      </div>
    </div>
    );
  };

  return (
    <div
      ref={containerRef}
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        outline: 'none',
        background: colors.bgPrimary,
      }}
    >
      <div
        style={{
          padding: '8px 16px',
          borderBottom: `1px solid ${colors.borderSecondary}`,
          background: colors.bgTertiary,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0
        }}
      >
        <span style={{ fontSize: '13px', fontWeight: 500, color: colors.textPrimary }}>
          共 {entries.length} 条 {selectedRowKeys.length > 0 && `(已选 ${selectedRowKeys.length})`}
        </span>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {selectedRowKeys.length > 0 &&
            (() => {
              const hasNeedsReview = selectedRowKeys.some((key) => {
                const entry = entries[key as number];
                return entry && getEntryStatus(entry) === 'needs-review';
              });

              const hasUntranslated = selectedRowKeys.some((key) => {
                const entry = entries[key as number];
                return entry && getEntryStatus(entry) === 'untranslated';
              });

              return (
                <>
                  {hasNeedsReview && (
                    <>
                      <Button
                        type="primary"
                        size="small"
                        onClick={handleConfirmSelected}
                        icon={<CheckOutlined />}
                      >
                        确认已选中
                      </Button>
                      <Button
                        type="default"
                        size="small"
                        onClick={handleContextualRefine}
                        icon={<ThunderboltOutlined />}
                        disabled={isTranslating}
                        style={{ marginLeft: '8px' }}
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
                    >
                      翻译选中
                    </Button>
                  )}
                </>
              );
            })()}
          {selectedRowKeys.length > 0 && (
            <span style={{ fontSize: '12px', color: colors.textTertiary }}>
              Ctrl+A 全选 | Ctrl+C 复制 | Esc 取消
            </span>
          )}
        </div>
      </div>

      {isTranslating && (
        <div style={{ padding: '8px 16px', background: colors.bgPrimary, flexShrink: 0 }}>
          <Progress percent={Math.round(progress)} size="small" status="active" />
        </div>
      )}

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
        {/* 第一列 */}
        <div 
          ref={col1Ref}
          style={{ 
            width: `${columnWidths[0]}%`, 
            display: 'flex', 
            flexDirection: 'column', 
            position: 'relative', 
            minHeight: 0, 
            flex: 'none' 
          }}
        >
             {renderColumn(
                '未翻译',
                groupedEntries.untranslated,
                colors.statusUntranslated,
                'untranslated'
              )}
              <div
                onMouseDown={() => setResizingColumn(0)}
                style={{
                  position: 'absolute',
                  right: -3,
                  top: 0,
                  bottom: 0,
                  width: '6px',
                  cursor: 'col-resize',
                  backgroundColor: 'transparent',
                  zIndex: 10,
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.backgroundColor = colors.statusUntranslated)
                }
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              />
        </div>

        {/* 第二列 */}
        <div 
          ref={col2Ref}
          style={{ 
            width: `${columnWidths[1]}%`, 
            display: 'flex', 
            flexDirection: 'column', 
            position: 'relative', 
            minHeight: 0, 
            flex: 'none' 
          }}
        >
            {renderColumn(
                '待确认',
                groupedEntries.needsReview,
                colors.statusNeedsReview,
                'needsReview'
              )}
              <div
                onMouseDown={() => setResizingColumn(1)}
                style={{
                  position: 'absolute',
                  right: -3,
                  top: 0,
                  bottom: 0,
                  width: '6px',
                  cursor: 'col-resize',
                  backgroundColor: 'transparent',
                  zIndex: 10,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = colors.statusNeedsReview)}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              />
        </div>

        {/* 第三列 */}
        <div 
          ref={col3Ref}
          style={{ 
            width: `${columnWidths[2]}%`,
            display: 'flex', 
            flexDirection: 'column', 
            minHeight: 0,
            flex: 'none'
          }}
        >
            {renderColumn(
                '已翻译', 
                groupedEntries.translated, 
                colors.statusTranslated, 
                'translated'
            )}
        </div>
      </div>
    </div>
  );
});

export default EntryList;
