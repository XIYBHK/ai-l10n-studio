/**
 * 翻译工作区组件
 */

import { useState, useRef, useEffect } from 'react';
import { Layout } from 'antd';
import { POEntry, TranslationStats } from '../types/tauri';
import { useCssColors } from '../hooks/useCssColors';
import { EntryList } from './EntryList';
import { EditorPane } from './EditorPane';
import { AIWorkspace } from './AIWorkspace';
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
  const cssColors = useCssColors();

  // 布局状态
  const [leftWidth, setLeftWidth] = useState(35);
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = () => setIsResizing(true);

  useEffect(() => {
    if (!isResizing) return;

    let animationFrameId: number;

    const handleMouseMove = (e: MouseEvent) => {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = requestAnimationFrame(() => {
        const windowWidth = window.innerWidth;
        const newWidth = (e.clientX / windowWidth) * 100;

        if (newWidth >= 20 && newWidth <= 60) {
          if (sidebarRef.current) {
            sidebarRef.current.style.width = `${newWidth}%`;
          }
        }
      });
    };

    const handleMouseUp = (e: MouseEvent) => {
      cancelAnimationFrame(animationFrameId);
      setIsResizing(false);

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
      {/* 跳转到主要内容链接 - 无障碍支持 */}
      <a
        href="#main-editor"
        style={{
          position: 'absolute',
          top: '-40px',
          left: '0',
          background: cssColors.brandPrimary,
          color: '#ffffff',
          padding: '8px 16px',
          textDecoration: 'none',
          zIndex: 1000,
          borderRadius: '0 0 4px 0',
          fontSize: '14px',
          fontWeight: 500,
          transition: 'top 0.3s',
        }}
        onFocus={(e) => {
          e.currentTarget.style.top = '0';
        }}
        onBlur={(e) => {
          e.currentTarget.style.top = '-40px';
        }}
        onClick={(e) => {
          e.preventDefault();
          const target = document.getElementById('main-editor');
          if (target) {
            target.focus();
            target.setAttribute('tabIndex', '-1');
          }
        }}
      >
        跳转到主要内容
      </a>

      <Layout
        className="workspace-fade-in"
        style={{ height: 'calc(100vh - 48px - 28px)', position: 'relative' }}
        role="main"
        aria-label="翻译工作区"
      >
        <div
          ref={sidebarRef}
          style={{
            width: `${leftWidth}%`,
            height: '100%',
            backgroundColor: cssColors.bgPrimary,
            borderRight: `1px solid ${cssColors.borderPrimary}`,
            overflow: 'hidden',
            position: 'relative',
            minWidth: '320px',
            transition: isResizing
              ? 'none'
              : 'width 0.1s ease, background-color 0.3s cubic-bezier(0.645, 0.045, 0.355, 1), border-color 0.3s cubic-bezier(0.645, 0.045, 0.355, 1)',
            contain: 'layout style paint',
            willChange: isResizing ? 'width' : 'auto',
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
          <div
            onMouseDown={handleMouseDown}
            style={{
              position: 'absolute',
              right: 0,
              top: 0,
              bottom: 0,
              width: '5px',
              cursor: 'col-resize',
              background: isResizing ? cssColors.borderPrimary : 'transparent',
              zIndex: 10,
            }}
            onMouseEnter={(e) => {
              if (!isResizing) {
                e.currentTarget.style.background = `${cssColors.borderPrimary}80`;
              }
            }}
            onMouseLeave={(e) => {
              if (!isResizing) {
                e.currentTarget.style.background = 'transparent';
              }
            }}
          />
        </div>

        <Layout.Content
          style={{
            backgroundColor: cssColors.bgPrimary,
            overflow: 'hidden',
            flex: 1,
            contain: 'layout style',
          }}
        >
          <EditorPane entry={currentEntry} onEntryUpdate={onEntryUpdate} />
        </Layout.Content>

        <Layout.Sider
          width={320}
          style={{
            backgroundColor: cssColors.bgPrimary,
            borderLeft: `1px solid ${cssColors.borderPrimary}`,
            overflow: 'auto',
            contain: 'strict',
            willChange: 'scroll-position',
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

      <FileInfoBar filePath={currentFilePath} />
    </>
  );
}
