import { useState, useEffect, useLayoutEffect, useRef, lazy, Suspense } from 'react';
import { Alert, Button, ConfigProvider, App as AntApp } from 'antd';
import { useTranslation } from 'react-i18next';
import { useThemeRuntime } from './hooks/useTheme';
import { useModelConfiguration } from './hooks/useConfig';
import { useTranslationFlow } from './hooks/useTranslationFlow';
import { openDevToolsWindow } from './utils/devToolsWindow';
import { createModuleLogger } from './utils/logger';
import { useLanguage, useResetSessionStats } from './store';
import { getStyleCsp } from './utils/styleCsp';
import { LazyModalFallback } from './components/ui/LazyModalFallback';
import { emit } from '@tauri-apps/api/event';
import { bindUiFeedback } from './services/uiFeedback';
import { shouldIgnoreBackgroundShortcut } from './utils/accessibility';
import zhCN from 'antd/locale/zh_CN';
import enUS from 'antd/locale/en_US';

import i18n from './i18n/config';
import './App.css';
import './styles/accessibility.css';

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
  const themeData = useThemeRuntime();
  const language = useLanguage();
  return (
    <ConfigProvider
      theme={themeData.themeConfig}
      csp={getStyleCsp()}
      locale={language === 'en-US' ? enUS : zhCN}
    >
      <AntApp>
        <AppShellContent initError={initError} themeData={themeData} />
      </AntApp>
    </ConfigProvider>
  );
}

function AppShellContent({
  initError,
  themeData,
}: AppShellProps & { themeData: ReturnType<typeof useThemeRuntime> }) {
  const { message: msg } = AntApp.useApp();
  useLayoutEffect(() => bindUiFeedback(msg), [msg]);
  const { t } = useTranslation();
  const language = useLanguage();
  const resetSessionStats = useResetSessionStats();

  useEffect(() => {
    void i18n.changeLanguage(language);
    void emit('language:changed', language).catch((error) => {
      log.error('Language broadcast failed', error);
    });
  }, [language]);

  const [settingsVisible, setSettingsVisible] = useState(false);
  const hasCheckedAIConfig = useRef(false);
  const openFileRef = useRef<() => Promise<void> | void>(() => undefined);
  const saveFileRef = useRef<() => Promise<boolean> | void>(() => undefined);

  const {
    entries,
    currentEntry,
    currentFilePath,
    isTranslating,
    progress,
    openFile,
    saveFile,
    saveAsFile,
    translateAll,
    handleTranslateSelected,
    handleContextualRefine,
    handleEntrySelect,
    confirmEntries,
    changeTargetLanguage,
    cancelTranslation,
  } = useTranslationFlow();

  const {
    configuration,
    loading: aiConfigLoading,
    error: aiConfigError,
    mutate: reloadAIConfig,
  } = useModelConfiguration();
  const active = configuration.defaultModel;

  useEffect(() => {
    if (aiConfigLoading || aiConfigError) return;

    if (!hasCheckedAIConfig.current && !active) {
      hasCheckedAIConfig.current = true;
      setSettingsVisible(true);
      log.info('No AI config found, opening settings');
    }

    if (active) {
      hasCheckedAIConfig.current = true;
    }
  }, [active, aiConfigLoading, aiConfigError]);

  useEffect(() => {
    openFileRef.current = openFile;
    saveFileRef.current = saveFile;
  }, [openFile, saveFile]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (shouldIgnoreBackgroundShortcut(event)) return;
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
    if (aiConfigError) {
      msg.error(t('modelSettings.loadFailed'));
      return false;
    }
    if (!active) {
      setSettingsVisible(true);
      msg.warning(t('messages.aiServiceRequired'));
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
    <div
      data-testid="app-shell"
      className="studio-shell"
      data-theme={themeData.isDark ? 'dark' : 'light'}
    >
      <h1 className="sr-only">{t('app.title')}</h1>
      {aiConfigError && (
        <Alert
          title={t('modelSettings.loadFailed')}
          type="error"
          showIcon
          action={
            <Button size="small" loading={aiConfigLoading} onClick={() => void reloadAIConfig()}>
              {t('common.retry')}
            </Button>
          }
        />
      )}
      {initError && (
        <div
          role="alert"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            background: 'var(--color-error)',
            color: 'var(--color-onError)',
            padding: 'var(--space-4)',
            zIndex: 9999,
            textAlign: 'center',
            boxShadow: 'var(--shadow-md)',
          }}
        >
          {initError}
          <button
            onClick={() => window.location.reload()}
            style={{
              marginLeft: 'var(--space-4)',
              padding: 'var(--space-1) var(--space-3)',
              borderRadius: 'var(--radius-base)',
              border: 'none',
              background: 'rgba(255,255,255,0.2)',
              color: 'var(--color-onError)',
              cursor: 'pointer',
            }}
          >
            {t('messages.reload')}
          </button>
        </div>
      )}

      <Suspense fallback={null}>
        <MenuBar
          onOpenFile={openFile}
          onSaveFile={saveFile}
          onSaveAsFile={saveAsFile}
          onTranslateAll={handleTranslateAll}
          onSettings={() => setSettingsVisible(true)}
          onTargetLanguageChange={changeTargetLanguage}
          onDevTools={async () => {
            try {
              await openDevToolsWindow();
            } catch (error) {
              console.error('[AppShell] 打开开发者工具失败', error);
              msg.error(t('devTools.openFailed'));
            }
          }}
          isTranslating={isTranslating}
          hasEntries={entries.length > 0}
          onCancelTranslation={async () => {
            try {
              await cancelTranslation();
            } catch (error) {
              console.error('[AppShell] 取消翻译失败:', error);
            }
          }}
        />
      </Suspense>

      <Suspense fallback={null}>
        <TranslationWorkspace
          entries={entries}
          currentEntry={currentEntry}
          isTranslating={isTranslating}
          progress={progress}
          currentFilePath={currentFilePath}
          onEntrySelect={handleEntrySelect}
          onConfirmEntries={confirmEntries}
          onTranslateSelected={handleTranslateSelectedWrapper}
          onContextualRefine={handleContextualRefineWrapper}
          onResetStats={resetSessionStats}
          onOpenFile={openFile}
        />
      </Suspense>

      {settingsVisible ? (
        <Suspense fallback={<LazyModalFallback onClose={() => setSettingsVisible(false)} />}>
          <SettingsModal visible={settingsVisible} onClose={() => setSettingsVisible(false)} />
        </Suspense>
      ) : null}
    </div>
  );
}
