import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { ConfigProvider, App as AntApp } from 'antd';
import { useTheme } from './hooks/useTheme';
import { useAIConfigs } from './hooks/useConfig';
import { useTranslationFlow } from './hooks/useTranslationFlow';
import { openDevToolsWindow } from './utils/devToolsWindow';
import { createModuleLogger } from './utils/logger';
import { MenuBarSkeleton, TranslationWorkspaceSkeleton } from './components/skeletons';
import './i18n/config';
import './App.css';

const log = createModuleLogger('AppShell');
const MenuBar = lazy(() =>
  import('./components/MenuBar').then((module) => ({ default: module.MenuBar }))
);
const TranslationWorkspace = lazy(() =>
  import('./components/TranslationWorkspace').then((module) => ({
    default: module.TranslationWorkspace,
  }))
);
const SettingsModal = lazy(() =>
  import('./components/SettingsModal').then((module) => ({ default: module.SettingsModal }))
);

interface AppShellProps {
  initError?: string | null;
}

export default function AppShell({ initError = null }: AppShellProps) {
  const { message: msg } = AntApp.useApp();

  const [settingsVisible, setSettingsVisible] = useState(false);
  const hasCheckedAIConfig = useRef(false);
  const openFileRef = useRef<() => Promise<void> | void>(() => undefined);
  const saveFileRef = useRef<() => Promise<void> | void>(() => undefined);

  const {
    entries,
    currentEntry,
    currentFilePath,
    isTranslating,
    progress,
    translationStats,
    sourceLanguage,
    targetLanguage,
    openFile,
    saveFile,
    saveAsFile,
    translateAll,
    handleTranslateSelected,
    handleContextualRefine,
    handleEntrySelect,
    handleEntryUpdate,
    handleTargetLanguageChange,
    cancelTranslation,
    resetTranslationStats,
  } = useTranslationFlow();

  const themeData = useTheme();

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--theme-transition-duration', '0.3s');
    root.style.setProperty('--theme-transition-timing', 'cubic-bezier(0.645, 0.045, 0.355, 1)');
  }, [themeData.appliedTheme]);

  const { active, loading: aiConfigLoading } = useAIConfigs();

  useEffect(() => {
    if (aiConfigLoading) return;

    if (!hasCheckedAIConfig.current && !active) {
      hasCheckedAIConfig.current = true;
      setSettingsVisible(true);
      log.info('No AI config found, opening settings');
    }

    if (active) {
      hasCheckedAIConfig.current = true;
    }
  }, [active, aiConfigLoading]);

  useEffect(() => {
    openFileRef.current = openFile;
    saveFileRef.current = saveFile;
  }, [openFile, saveFile]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'o') {
        event.preventDefault();
        openFileRef.current();
      } else if ((event.ctrlKey || event.metaKey) && event.key === 's') {
        event.preventDefault();
        saveFileRef.current();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const checkAIConfig = (): boolean => {
    if (!active) {
      setSettingsVisible(true);
      msg.warning('请先在设置中配置并启用 AI 服务');
      return false;
    }

    return true;
  };

  const handleTranslateAll = async () => {
    if (isTranslating) {
      log.warn('Translation already in progress');
      return;
    }

    if (!checkAIConfig()) return;
    await translateAll();
  };

  const handleTranslateSelectedWrapper = async (indices: number[]) => {
    if (!checkAIConfig()) return;
    await handleTranslateSelected(indices);
  };

  const handleContextualRefineWrapper = async (indices: number[]) => {
    if (!checkAIConfig()) return;
    await handleContextualRefine(indices);
  };

  return (
    <ConfigProvider theme={themeData.themeConfig}>
      <AntApp>
        <div data-theme={themeData.isDark ? 'dark' : 'light'} style={{ height: '100vh' }}>
          {initError && (
            <div
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                background: '#ff4d4f',
                color: 'white',
                padding: '16px',
                zIndex: 9999,
                textAlign: 'center',
              }}
            >
              ⚠️ {initError}
              <button onClick={() => window.location.reload()} style={{ marginLeft: '16px' }}>
                重新加载
              </button>
            </div>
          )}

          <Suspense fallback={<MenuBarSkeleton />}>
            <MenuBar
              onOpenFile={openFile}
              onSaveFile={saveFile}
              onSaveAsFile={saveAsFile}
              onTranslateAll={handleTranslateAll}
              onSettings={() => setSettingsVisible(true)}
              onDevTools={async () => {
                try {
                  await openDevToolsWindow();
                } catch (error) {
                  console.error('[AppShell] 打开开发者工具失败:', error);
                }
              }}
              isTranslating={isTranslating}
              hasEntries={entries.length > 0}
              isDarkMode={themeData.isDark}
              onThemeToggle={themeData.toggleTheme}
              sourceLanguage={sourceLanguage}
              targetLanguage={targetLanguage}
              onTargetLanguageChange={handleTargetLanguageChange}
              onCancelTranslation={async () => {
                try {
                  await cancelTranslation();
                } catch (error) {
                  console.error('[AppShell] 取消翻译失败:', error);
                }
              }}
            />
          </Suspense>

          <Suspense fallback={<TranslationWorkspaceSkeleton />}>
            <TranslationWorkspace
              entries={entries}
              currentEntry={currentEntry}
              isTranslating={isTranslating}
              progress={progress}
              translationStats={translationStats}
              currentFilePath={currentFilePath}
              onEntrySelect={handleEntrySelect}
              onEntryUpdate={handleEntryUpdate}
              onTranslateSelected={handleTranslateSelectedWrapper}
              onContextualRefine={handleContextualRefineWrapper}
              onResetStats={resetTranslationStats}
            />
          </Suspense>

          {settingsVisible ? (
            <Suspense fallback={null}>
              <SettingsModal visible={settingsVisible} onClose={() => setSettingsVisible(false)} />
            </Suspense>
          ) : null}
        </div>
      </AntApp>
    </ConfigProvider>
  );
}
