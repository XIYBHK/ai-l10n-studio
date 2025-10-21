import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import './utils/simpleFrontendLogger'; // ✅ 简化的前端日志系统（参考 clash-verge-rev）
import { initializeI18n } from './i18n/config'; // Phase 6: 异步 i18n 初始化
import { initializeStores } from './store'; // Tauri 2.x: Store Plugin
import { SWRConfig } from 'swr';
import { defaultSWRConfig } from './services/swr';
import { initializeSWRRevalidators } from './services/swrEvents';
import { initializeStatsManagerV2 } from './services/statsManagerV2';
import { AppDataProvider } from './providers'; // Phase 9: 统一数据提供者

// Phase 6: 异步初始化 i18n 后再渲染应用
async function bootstrap() {
  try {
    // 1. 加载持久化数据（主题、语言、统计）
    console.log('[Bootstrap] 📦 加载持久化数据...');
    await initializeStores();
    console.log('[Bootstrap] ✅ 持久化数据加载完成');

    // 2. 初始化 i18n（系统语言检测）
    await initializeI18n();
    // 初始化 SWR 事件 revalidators（事件驱动刷新）
    initializeSWRRevalidators();
    // 初始化统一统计聚合管理器
    initializeStatsManagerV2();
  } catch (error) {
    console.error('[Bootstrap] ⚠️ 初始化失败，使用默认值:', error);
    // 即使失败也继续渲染应用
  }

  // 渲染应用
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <SWRConfig value={defaultSWRConfig}>
        <AppDataProvider>
          <App />
        </AppDataProvider>
      </SWRConfig>
    </React.StrictMode>
  );
}

bootstrap().catch((error) => {
  console.error('[Bootstrap] 启动失败:', error);
  // 即使 i18n 初始化失败也渲染应用
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <SWRConfig value={defaultSWRConfig}>
        <AppDataProvider>
          <App />
        </AppDataProvider>
      </SWRConfig>
    </React.StrictMode>
  );
});
