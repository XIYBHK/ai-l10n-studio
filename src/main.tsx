import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import './utils/frontendLogger' // 初始化前端日志拦截器
import { initializeI18n } from './i18n/config' // Phase 6: 异步 i18n 初始化
import { initializeStores } from './store' // Tauri 2.x: Store Plugin
import { autoMigrate } from './utils/storeMigration' // Tauri 2.x: 数据迁移
import { SWRConfig } from 'swr'
import { defaultSWRConfig } from './services/swr'
import { initializeSWRRevalidators } from './services/swrEvents'
import { initializeStatsManager } from './services/statsManager'

// Phase 6: 异步初始化 i18n 后再渲染应用
async function bootstrap() {
  try {
    // 1. 数据迁移（localStorage → TauriStore）
    console.log('[Bootstrap] 🚀 开始数据迁移...');
    const { migrated } = await autoMigrate();
    if (migrated) {
      console.log('[Bootstrap] ✅ 数据迁移成功');
    }
    
    // 2. 加载持久化数据（主题、语言、统计）
    console.log('[Bootstrap] 📦 加载持久化数据...');
    await initializeStores();
    console.log('[Bootstrap] ✅ 持久化数据加载完成');
    
    // 3. 初始化 i18n（系统语言检测）
    await initializeI18n();
    // 初始化 SWR 事件 revalidators（事件驱动刷新）
    initializeSWRRevalidators();
    // 初始化统一统计聚合管理器
    initializeStatsManager();
    
  } catch (error) {
    console.error('[Bootstrap] ⚠️ 初始化失败，使用默认值:', error);
    // 即使失败也继续渲染应用
  }

  // 渲染应用
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <SWRConfig value={defaultSWRConfig}>
        <App />
      </SWRConfig>
    </React.StrictMode>,
  );
}

bootstrap().catch(error => {
  console.error('[Bootstrap] 启动失败:', error);
  // 即使 i18n 初始化失败也渲染应用
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <SWRConfig value={defaultSWRConfig}>
        <App />
      </SWRConfig>
    </React.StrictMode>,
  );
});