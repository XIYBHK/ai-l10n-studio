/**
 * 应用入口文件
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { getCurrentWindow } from '@tauri-apps/api/window';
import App from './App';
import { initializeStores } from './store';
import './index.css';

const appWindow = getCurrentWindow();

// 并行初始化和渲染，提升启动速度
async function bootstrap() {
  const root = ReactDOM.createRoot(document.getElementById('root')!);

  try {
    // 并行执行：初始化 Store + 渲染应用
    const [_] = await Promise.all([
      initializeStores().catch((error) => {
        console.error('Store 初始化失败:', error);
      }),
      // 立即开始渲染，不等待 Store
      new Promise<void>((resolve) => {
        root.render(
          <React.StrictMode>
            <App />
          </React.StrictMode>
        );
        // 等待下一帧，确保渲染已开始
        requestAnimationFrame(() => resolve());
      }),
    ]);

    // 渲染完成后显示窗口
    await appWindow.show();
    console.log('[App] 窗口已显示');
  } catch (error) {
    console.error('[App] 启动失败:', error);
    // 即使出错也显示窗口
    await appWindow.show();
  }
}

bootstrap();
