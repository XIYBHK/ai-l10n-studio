/**
 * 开发者工具窗口主题提供者
 * 确保独立窗口与主应用保持相同的主题
 */
import React, { useEffect } from 'react';
import { ConfigProvider } from 'antd';
import { useTheme } from '../hooks/useTheme';
import { listen } from '@tauri-apps/api/event';

interface DevToolsThemeProviderProps {
  children: React.ReactNode;
}

export const DevToolsThemeProvider: React.FC<DevToolsThemeProviderProps> = ({ children }) => {
  const themeData = useTheme();

  // 🔔 监听主窗口的主题变更事件
  useEffect(() => {
    let unlistenFn: (() => void) | null = null;

    const setupListener = async () => {
      const unlisten = await listen<{ theme: 'light' | 'dark' | 'system' }>(
        'theme:changed',
        (event) => {
          console.log('[DevToolsThemeProvider] 收到主题变更事件:', event.payload);
          // 更新主题
          themeData.setTheme(event.payload.theme);
        }
      );
      unlistenFn = unlisten;
    };

    setupListener();

    return () => {
      if (unlistenFn) unlistenFn();
    };
  }, [themeData.setTheme]);

  return (
    <ConfigProvider
      theme={{
        ...themeData.themeConfig,
        algorithm: themeData.algorithm,
      }}
    >
      <div
        data-theme={themeData.isDark ? 'dark' : 'light'}
        style={{
          height: '100vh',
          background: themeData.colors.bgPrimary,
          overflow: 'hidden',
        }}
      >
        {children}
      </div>
    </ConfigProvider>
  );
};
