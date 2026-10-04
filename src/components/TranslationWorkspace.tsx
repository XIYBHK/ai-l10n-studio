import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { Button } from 'antd';
import { FileTextOutlined, RobotOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { POEntry } from '../types/tauri';
import { EntryList } from './EntryList';
import { EditorPane } from './EditorPane';
import { FileInfoBar } from './FileInfoBar';
import { WelcomeState } from './WelcomeState';
import styles from './TranslationWorkspace.module.css';
import { useTranslationStore, selectDocumentDirty } from '../store/useTranslationStore';

const AIWorkspace = lazy(() =>
  import('./AIWorkspace').then((module) => ({ default: module.AIWorkspace }))
);

interface TranslationWorkspaceProps {
  entries: POEntry[];
  currentEntry: POEntry | null;
  isTranslating: boolean;
  progress: number;
  currentFilePath: string | null;
  onEntrySelect: (entry: POEntry) => void;
  onConfirmEntries: (indices: number[]) => Promise<void>;
  onTranslateSelected: (indices: number[]) => void;
  onContextualRefine: (indices: number[]) => void;
  onResetStats: () => void;
  onOpenFile?: () => void;
}

export function TranslationWorkspace({
  entries,
  currentEntry,
  isTranslating,
  progress,
  currentFilePath,
  onEntrySelect,
  onConfirmEntries,
  onTranslateSelected,
  onContextualRefine,
  onResetStats,
  onOpenFile,
}: TranslationWorkspaceProps) {
  const { t } = useTranslation();
  const dirty = useTranslationStore(selectDocumentDirty);
  const currentIndex = useTranslationStore((state) => state.currentIndex);
  const previousEntry = useTranslationStore((state) => state.previousEntry);
  const nextEntry = useTranslationStore((state) => state.nextEntry);
  const [leftWidth, setLeftWidth] = useState(320);
  const [isResizing, setIsResizing] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [compactAssistant, setCompactAssistant] = useState(() => window.innerWidth <= 1180);
  const panelsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 1180px)');
    setCompactAssistant(media.matches);
    const update = (event: MediaQueryListEvent) => setCompactAssistant(event.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (!isResizing) return;
    const move = (event: MouseEvent) => {
      const bounds = panelsRef.current?.getBoundingClientRect();
      if (bounds)
        setLeftWidth(
          Math.max(260, Math.min(440, bounds.width * 0.45, event.clientX - bounds.left))
        );
    };
    const up = () => setIsResizing(false);
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    return () => {
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing]);

  if (!entries.length && !currentFilePath) return <WelcomeState onOpenFile={onOpenFile} />;

  return (
    <section className={styles.workspace} aria-label={t('workspace.title')}>
      <a href="#main-editor" className="skip-to-content">
        {t('workspace.skipToEditor')}
      </a>
      <header className={styles.heading}>
        <div className={styles.fileHeading}>
          <FileTextOutlined aria-hidden="true" />
          <h2 title={currentFilePath ?? undefined}>
            {currentFilePath?.split(/[/\\]/).pop() || t('workspace.title')}
          </h2>
          <span className={styles.fileBadge}>PO</span>
          {dirty && <span role="status">{t('document.unsaved')}</span>}
        </div>
        <span className={styles.headingHint}>{t('workspace.editorHint')}</span>
        <Button
          className={styles.assistantToggle}
          size="small"
          icon={<RobotOutlined />}
          onClick={() => setAssistantOpen((value) => !value)}
          aria-expanded={compactAssistant && assistantOpen}
          aria-controls="workspace-assistant"
        >
          {t('aiWorkspace.title')}
        </Button>
      </header>
      <div className={styles.panels} ref={panelsRef}>
        <div className={styles.entries} style={{ width: leftWidth }}>
          <EntryList
            entries={entries}
            currentEntry={currentEntry}
            isTranslating={isTranslating}
            progress={progress}
            onEntrySelect={onEntrySelect}
            onTranslateSelected={onTranslateSelected}
            onContextualRefine={onContextualRefine}
            onConfirmEntries={onConfirmEntries}
          />
          <div
            className={`${styles.resizeHandle} ${isResizing ? styles.resizing : ''}`}
            role="separator"
            aria-orientation="vertical"
            aria-label={t('workspace.resizeList')}
            aria-valuemin={260}
            aria-valuemax={440}
            aria-valuenow={Math.round(leftWidth)}
            tabIndex={0}
            onMouseDown={() => setIsResizing(true)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
                event.preventDefault();
                setLeftWidth((value) =>
                  Math.max(260, Math.min(440, value + (event.key === 'ArrowLeft' ? -16 : 16)))
                );
              }
            }}
          />
        </div>
        <main className={styles.editor}>
          <EditorPane
            entry={currentEntry}
            onConfirmEntries={onConfirmEntries}
            onNavigatePrev={previousEntry}
            onNavigateNext={nextEntry}
            canNavigatePrev={entries.some(
              (entry, index) => index < currentIndex && !entry.obsolete && !!entry.msgid
            )}
            canNavigateNext={entries.some(
              (entry, index) => index > currentIndex && !entry.obsolete && !!entry.msgid
            )}
          />
        </main>
        <aside className={styles.assistant}>
          <Suspense fallback={null}>
            <AIWorkspace
              isTranslating={isTranslating}
              onResetStats={onResetStats}
              compact={compactAssistant}
              open={assistantOpen}
              onClose={() => setAssistantOpen(false)}
            />
          </Suspense>
        </aside>
      </div>
      <FileInfoBar filePath={currentFilePath} />
    </section>
  );
}
