/**
 * 应用入口文件
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { getCurrentWindow } from '@tauri-apps/api/window';
import App from './App';
import { initializeStores } from './store';
import { useAppStore } from './store/useAppStore';
import i18n from './i18n/config';
import './index.css';

let appWindow: ReturnType<typeof getCurrentWindow> | null = null;
try {
  appWindow = getCurrentWindow();
} catch {
  appWindow = null;
}

async function bootstrap() {
  const root = ReactDOM.createRoot(document.getElementById('root')!);
  const renderApp = (initError: string | null = null) => {
    root.render(
      <React.StrictMode>
        <App initError={initError} />
      </React.StrictMode>
    );
  };

  try {
    let initError: string | null = null;

    try {
      await initializeStores();
    } catch (error) {
      initError = i18n.t('errors.loadFailed', { error: String(error) });
      console.error(initError, error);
    }
    await i18n.changeLanguage(useAppStore.getState().language);
    renderApp(initError);
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

    if (appWindow) {
      await appWindow.show();
      console.log('[App] Window shown', { initError });
    }
  } catch (error) {
    console.error('[App] 启动失败:', error);

    if (appWindow) {
      await appWindow.show();
    }
  }
}

bootstrap();
