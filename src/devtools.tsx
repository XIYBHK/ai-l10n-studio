/**
 * 开发者工具独立窗口入口
 */
import React from 'react';
import ReactDOM from 'react-dom/client';
import { Alert, App, Button } from 'antd';
import './index.css';
import { DevToolsPage } from './pages/DevToolsPage';
import { DevToolsThemeProvider } from './components/DevToolsThemeProvider';
import { loadPersistedState, useAppStore } from './store/useAppStore';
import i18n from './i18n/config';

async function bootstrap() {
  const root = ReactDOM.createRoot(document.getElementById('devtools-root')!);

  try {
    console.log('[DevTools] 加载持久化设置...');
    await loadPersistedState();
    await i18n.changeLanguage(useAppStore.getState().language);

    console.log('[DevTools] 主题加载完成，开始渲染...');

    root.render(
      <React.StrictMode>
        <DevToolsThemeProvider>
          <App>
            <DevToolsPage />
          </App>
        </DevToolsThemeProvider>
      </React.StrictMode>
    );

    console.log('[DevTools] 窗口初始化完成');
  } catch (error) {
    console.error('[DevTools] 启动失败:', error);
    root.render(
      <DevToolsThemeProvider>
        <App>
          <div style={{ padding: 'var(--space-4)' }}>
            <Alert
              type="error"
              showIcon
              title={i18n.t('errors.loadFailed', { error: String(error) })}
              action={<Button onClick={() => location.reload()}>{i18n.t('common.retry')}</Button>}
            />
          </div>
        </App>
      </DevToolsThemeProvider>
    );
  }
}

bootstrap();
