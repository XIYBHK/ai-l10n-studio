/**
 * 翻译工作区组件
 * 包含条目列表、编辑器、AI 工作区的布局和交互逻辑
 */

import { useState, useRef, useEffect } from 'react';
import { Layout } from 'antd';
import { POEntry, TranslationStats } from '../types/tauri';
import { useTheme } from '../hooks/useTheme';
import EntryList from './EntryList';
import EditorPane from './EditorPane';
import AIWorkspace from './AIWorkspace';
import { FileInfoBar } from './FileInfoBar';

interface TranslationWorkspaceProps {
  // 数据
  entries: POEntry[];
  currentEntry: POEntry | null;
  isTranslating: boolean;
  progress: number;
  translationStats: TranslationStats | null;
  currentFilePath: string | null;

  // 回调
  onEntrySelect: (entry: POEntry) => void;
  onEntryUpdate: (index: number, updates: Partial<POEntry>) => void;
  onTranslateSelected: (indices: number[]) => void;
  onContextualRefine: (indices: number[]) => void;
  onResetStats: () => void;
}

export function TranslationWorkspace({
  entries,
  currentEntry,
  isTranslating,
  progress,
  translationStats,
  currentFilePath,
  onEntrySelect,
  onEntryUpdate,
  onTranslateSelected,
  onContextualRefine,
  onResetStats,
}: TranslationWorkspaceProps) {
  const themeData = useTheme();

  // 布局状态
  const [leftWidth, setLeftWidth] = useState(35);
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  // 拖拽调整列宽
  const handleMouseDown = () => setIsResizing(true);

  useEffect(() => {
    if (!isResizing) return;

    let animationFrameId: number;

    const handleMouseMove = (e: MouseEvent) => {
      // 使用 requestAnimationFrame 节流 DOM 操作
      cancelAnimationFrame(animationFrameId);
      animationFrameId = requestAnimationFrame(() => {
        const windowWidth = window.innerWidth;
        const newWidth = (e.clientX / windowWidth) * 100;

        if (newWidth >= 20 && newWidth <= 60) {
          // 直接操作 DOM，不触发 React 重渲染
          if (sidebarRef.current) {
            sidebarRef.current.style.width = `${newWidth}%`;
          }
        }
      });
    };

    const handleMouseUp = (e: MouseEvent) => {
      cancelAnimationFrame(animationFrameId);
      setIsResizing(false);

      // 拖拽结束，同步最终状态
      const windowWidth = window.innerWidth;
      const newWidth = (e.clientX / windowWidth) * 100;
      if (newWidth >= 20 && newWidth <= 60) {
        setLeftWidth(newWidth);
      }

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
  }, [isResizing]);

  return (
    <>
      {/* 主布局：三列 */}
      <Layout style={{ height: 'calc(100vh - 48px - 28px)', position: 'relative' }}>
        {/* 左侧：条目列表 */}
        <div
          ref={sidebarRef}
          style={{
            width: `${leftWidth}%`,
            height: '100%',
            background: themeData.colors.bgPrimary,
            borderRight: `1px solid ${themeData.colors.borderPrimary}`,
            overflow: 'hidden',
            position: 'relative',
            minWidth: '300px',
            transition: isResizing ? 'none' : 'width 0.1s ease', // 拖拽时禁用过渡动画
          }}
        >
          <EntryList
            entries={entries}
            currentEntry={currentEntry}
            isTranslating={isTranslating}
            progress={progress}
            onEntrySelect={onEntrySelect}
            onTranslateSelected={onTranslateSelected}
            onContextualRefine={onContextualRefine}
          />
          {/* 拖拽分隔条 */}
          <div
            onMouseDown={handleMouseDown}
            style={{
              position: 'absolute',
              right: 0,
              top: 0,
              bottom: 0,
              width: '5px',
              cursor: 'col-resize',
              background: isResizing ? themeData.colors.borderPrimary : 'transparent',
              zIndex: 10,
            }}
            onMouseEnter={(e) => {
              if (!isResizing) {
                e.currentTarget.style.background = `${themeData.colors.borderPrimary}80`;
              }
            }}
            onMouseLeave={(e) => {
              if (!isResizing) {
                e.currentTarget.style.background = 'transparent';
              }
            }}
          />
        </div>

        {/* 中间：编辑器 */}
        <Layout.Content
          style={{
            background: themeData.colors.bgPrimary,
            overflow: 'hidden',
            flex: 1,
          }}
        >
          <EditorPane entry={currentEntry} onEntryUpdate={onEntryUpdate} />
        </Layout.Content>

        {/* 右侧：AI 工作区 */}
        <Layout.Sider
          width={320}
          style={{
            background: themeData.colors.bgPrimary,
            borderLeft: `1px solid ${themeData.colors.borderPrimary}`,
            overflow: 'auto',
          }}
          collapsible={false}
        >
          <AIWorkspace
            stats={translationStats}
            isTranslating={isTranslating}
            onResetStats={onResetStats}
          />
        </Layout.Sider>
      </Layout>

      {/* 底部文件信息栏 */}
      <FileInfoBar filePath={currentFilePath} />
    </>
  );
}
