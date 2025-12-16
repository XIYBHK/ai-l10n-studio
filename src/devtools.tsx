/**
 * 开发者工具独立窗口入口
 */
import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from 'antd';
import './index.css';
import { DevToolsPage } from './pages/DevToolsPage';
import { DevToolsThemeProvider } from './components/DevToolsThemeProvider';
import { loadPersistedState } from './store/useAppStore';

// 🚀 初始化并渲染开发者工具窗口
async function bootstrap() {
  const root = ReactDOM.createRoot(document.getElementById('devtools-root')!);

  try {
    // 🔄 先加载主题设置，再渲染应用（确保主题正确）
    console.log('[DevTools] 加载持久化设置...');
    await loadPersistedState().catch((error) => {
      console.error('[DevTools] 加载主题失败:', error);
    });

    console.log('[DevTools] 主题加载完成，开始渲染...');

    // 然后渲染应用
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
  }
}

bootstrap();
