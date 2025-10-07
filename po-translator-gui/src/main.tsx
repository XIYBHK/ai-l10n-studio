import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import './utils/frontendLogger' // 初始化前端日志拦截器
import { initializeI18n } from './i18n/config' // Phase 6: 异步 i18n 初始化

// Phase 6: 异步初始化 i18n 后再渲染应用
async function bootstrap() {
  // 初始化 i18n（系统语言检测）
  await initializeI18n();

  // 渲染应用
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}

bootstrap().catch(error => {
  console.error('[Bootstrap] 启动失败:', error);
  // 即使 i18n 初始化失败也渲染应用
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
});