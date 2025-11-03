/**
 * AI L10N Studio 主应用
 * 已拆解为多个独立的组件
 */

import { useState } from 'react';
import { Layout, ConfigProvider } from 'antd';
import { App as AntApp } from 'antd';
import { useTheme } from './hooks/useTheme';
import AppMenuBar from './components/app/AppMenuBar';
import AppHeader from './components/app/AppHeader';
import MainContent from './components/app/MainContent';
import AppWorkspace from './components/app/AppWorkspace';
import { SettingsModal } from './components/SettingsModal';
import { ErrorBoundary } from './components/ErrorBoundary';

export default function App() {
  const [settingsVisible, setSettingsVisible] = useState(false);

  const themeData = useTheme();

  return (
    <ErrorBoundary>
      <ConfigProvider
        theme={{
          token: themeData.themeConfig?.token,
          algorithm: themeData.algorithm,
        }}
      >
        <AntApp>
          <Layout style={{ height: '100vh' }}>
            {/* 菜单栏 */}
            <AppMenuBar
              onOpenFile={() => {}}
              onSaveFile={() => {}}
              onSaveAsFile={() => {}}
              onSettings={() => setSettingsVisible(true)}
              onTranslateAll={() => {}}
              onTranslateUntranslated={() => {}}
              onTranslateSelected={() => {}}
              isTranslating={false}
            />

            {/* 头部 */}
            <AppHeader
              currentFilePath={null}
              sourceLanguage=""
              targetLanguage="zh-CN"
              onTargetLanguageChange={() => {}}
            />

            {/* 主内容 */}
            <Layout>
              <MainContent
                currentIndex={-1}
                onEntrySelect={() => {}}
                onEntryUpdate={() => {}}
                leftWidth={35}
                onWidthChange={() => {}}
              />

              {/* 工作区 */}
              <AppWorkspace onResetStats={() => {}} />
            </Layout>

            {/* 设置窗口 */}
            <SettingsModal
              visible={settingsVisible}
              onClose={() => setSettingsVisible(false)}
            />
          </Layout>
        </AntApp>
      </ConfigProvider>
    </ErrorBoundary>
  );
}
