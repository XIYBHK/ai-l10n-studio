/**
 * 开发者工具窗口主题提供者
 * 确保独立窗口与主应用保持相同的主题
 */
import React, { useEffect } from 'react';
import { ConfigProvider } from 'antd';
import { useTheme, useThemeDocument } from '../hooks/useTheme';
import { listen } from '@tauri-apps/api/event';
import { useAppStore } from '../store/useAppStore';
import { getStyleCsp } from '../utils/styleCsp';
import i18n from '../i18n/config';

interface DevToolsThemeProviderProps {
  children: React.ReactNode;
}

export function DevToolsThemeProvider({ children }: DevToolsThemeProviderProps) {
  const themeData = useTheme();
  useThemeDocument(themeData.appliedTheme);

  useEffect(() => {
    let unlistenFn: (() => void) | null = null;

    let active = true;
    const setupListener = async () => {
      const unlisten = await listen<{
        theme: 'light' | 'dark' | 'system';
        appliedTheme: 'light' | 'dark';
      }>('theme:changed', (event) => {
        if (!active) return;
        console.log('[DevToolsThemeProvider] 收到主题变更事件:', event.payload);
        useAppStore.setState({
          theme: event.payload.theme,
          systemTheme: event.payload.appliedTheme,
        });
      });
      if (!active) {
        unlisten();
        return;
      }
      unlistenFn = unlisten;
    };

    void setupListener().catch((error) => {
      console.error('[DevToolsThemeProvider] Theme listener failed', error);
    });

    return () => {
      active = false;
      if (unlistenFn) unlistenFn();
    };
  }, []);

  useEffect(() => {
    let active = true;
    let unlisten: (() => void) | undefined;
    void listen<string>('language:changed', (event) => {
      if (active) void i18n.changeLanguage(event.payload);
    })
      .then((dispose) => {
        if (active) unlisten = dispose;
        else dispose();
      })
      .catch((error) => console.error('[DevToolsThemeProvider] Language listener failed', error));
    return () => {
      active = false;
      unlisten?.();
    };
  }, []);

  return (
    <ConfigProvider theme={themeData.themeConfig} csp={getStyleCsp()}>
      <div
        data-theme={themeData.isDark ? 'dark' : 'light'}
        style={{
          height: '100vh',
          background: 'var(--color-bgPrimary)',
          overflow: 'hidden',
        }}
      >
        {children}
      </div>
    </ConfigProvider>
  );
}
