/**
 * 应用入口文件
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { getCurrentWindow } from '@tauri-apps/api/window';
import App from './App';
import { initializeStores } from './store';
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

    await Promise.all([
      initializeStores().catch((error) => {
        initError = `Store 初始化失败: ${String(error)}`;
        console.error(initError, error);
        renderApp(initError);
      }),
      new Promise<void>((resolve) => {
        renderApp();
        requestAnimationFrame(() => resolve());
      }),
    ]);

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
