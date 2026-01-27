import { useState, useEffect, useRef } from 'react';
import { ConfigProvider, App as AntApp } from 'antd';
import { useTheme } from './hooks/useTheme';
import { initializeStores } from './store';
import { useAIConfigs } from './hooks/useConfig';
import { useTranslationFlow } from './hooks/useTranslationFlow';
import { MenuBar } from './components/MenuBar';
import { TranslationWorkspace } from './components/TranslationWorkspace';
import { SettingsModal } from './components/SettingsModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { openDevToolsWindow } from './utils/devToolsWindow';
import { createModuleLogger } from './utils/logger';
import './i18n/config';
import './App.css';

const log = createModuleLogger('App');

export default function App() {
  const { message: msg } = AntApp.useApp();

  const [settingsVisible, setSettingsVisible] = useState(false);
  const hasCheckedAIConfig = useRef(false);

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
    initializeStores()
      .then(() => log.info('Store 初始化完成'))
      .catch((error) => log.error('Store 初始化失败', error));
  }, []);

  useEffect(() => {
    if (aiConfigLoading) return;
    if (!hasCheckedAIConfig.current && !active) {
      hasCheckedAIConfig.current = true;
      setSettingsVisible(true);
      log.info('未检测到AI配置，已自动打开设置窗口');
    }
    if (active) {
      hasCheckedAIConfig.current = true;
    }
  }, [active, aiConfigLoading]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'o') {
        event.preventDefault();
        openFile();
      } else if ((event.ctrlKey || event.metaKey) && event.key === 's') {
        event.preventDefault();
        saveFile();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentFilePath, entries, openFile, saveFile]);

  const checkAIConfig = (): boolean => {
    if (!active) {
      setSettingsVisible(true);
      msg.warning('请先在设置中配置并启用 AI 服务！');
      return false;
    }
    return true;
  };

  const handleTranslateAll = async () => {
    if (isTranslating) {
      log.warn('翻译正在进行中，忽略重复请求');
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
    <ErrorBoundary>
      <ConfigProvider
        theme={{
          ...themeData.themeConfig,
          algorithm: themeData.algorithm,
        }}
      >
        <AntApp>
          <div data-theme={themeData.isDark ? 'dark' : 'light'} style={{ height: '100vh' }}>
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
                  console.error('[App] 打开开发者工具失败:', error);
                }
              }}
              isTranslating={isTranslating}
              hasEntries={entries.length > 0}
              isDarkMode={themeData.isDark}
              onThemeToggle={themeData.toggleTheme}
              sourceLanguage={sourceLanguage}
              targetLanguage={targetLanguage}
              onTargetLanguageChange={handleTargetLanguageChange}
            />

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

            <SettingsModal visible={settingsVisible} onClose={() => setSettingsVisible(false)} />
          </div>
        </AntApp>
      </ConfigProvider>
    </ErrorBoundary>
  );
}
