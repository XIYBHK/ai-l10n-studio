/**
 * 开发者工具独立窗口页面
 * 将 DevToolsModal 的内容提取为独立页面，可以在独立窗口中运行
 */
import React, { useRef, useEffect } from 'react';
import { Input, Button, Space, Tabs, App } from 'antd';
import { useTranslation } from 'react-i18next';
import {
  CopyOutlined,
  ClearOutlined,
  BugOutlined,
  DownloadOutlined,
  FileTextOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
} from '@ant-design/icons';
import { useTheme } from '../hooks/useTheme';
import { formatTime } from '../utils/formatters';

// 新的日志服务
import {
  useGlobalLogStore,
  toggleBackendLogEnabled,
  clearBackendLogs,
  clearPromptLogs,
  startBackendLogMonitoring,
  stopBackendLogMonitoring,
  startPromptLogMonitoring,
  stopPromptLogMonitoring,
} from '../services/logService';

const { TextArea } = Input;

export function DevToolsPage() {
  const { message } = App.useApp();
  const { colors } = useTheme();
  const { t } = useTranslation();

  // 使用全局日志 Store
  const { backendLogs, backendEnabled, promptLogs } = useGlobalLogStore();

  // 格式化日志显示
  const backendLogText = backendLogs.join('\n');
  const promptLogText = promptLogs;

  // 日志文本框样式（根据主题动态调整）
  const logTextAreaStyle: React.CSSProperties = {
    fontFamily: 'Consolas, Monaco, "Courier New", monospace',
    fontSize: '12px',
    backgroundColor: 'var(--color-bgPrimary)',
    color: 'var(--color-textPrimary)',
    border: `1px solid ${colors.borderPrimary}`,
  };

  // 日志自动滚动 refs
  const backendLogRef = useRef<any>(null);
  const promptLogRef = useRef<any>(null);

  // 暂停/继续日志收集
  const handleToggleBackendLog = () => {
    toggleBackendLogEnabled();
    message.info(backendEnabled ? t('messages.backendLogsPaused') : t('messages.backendLogsResumed'));
  };

  // 清空日志
  const handleClearBackendLogs = async () => {
    try {
      await clearBackendLogs();
      message.success(t('messages.backendLogsCleared'));
    } catch (error) {
      console.error('[DevToolsPage] 清空后端日志失败:', error);
      message.error(t('errors.clearFailed'));
    }
  };

  const handleClearPromptLogs = async () => {
    try {
      await clearPromptLogs();
      message.success(t('messages.promptLogsCleared'));
    } catch (error) {
      console.error('[DevToolsPage] 清空提示词日志失败:', error);
      message.error(t('errors.clearFailed'));
    }
  };

  // 页面加载时启动日志监控
  useEffect(() => {
    startBackendLogMonitoring();
    startPromptLogMonitoring();

    return () => {
      stopBackendLogMonitoring();
      stopPromptLogMonitoring();
    };
  }, []);

  // 自动滚动到底部
  useEffect(() => {
    if (backendLogRef.current?.resizableTextArea?.textArea) {
      const textarea = backendLogRef.current.resizableTextArea.textArea;
      textarea.scrollTop = textarea.scrollHeight;
    }
  }, [backendLogText]);

  useEffect(() => {
    if (promptLogRef.current?.resizableTextArea?.textArea) {
      const textarea = promptLogRef.current.resizableTextArea.textArea;
      textarea.scrollTop = textarea.scrollHeight;
    }
  }, [promptLogs]);

  const handleCopy = () => {
    navigator.clipboard
      .writeText(backendLogText)
      .then(() => {
        message.success(t('messages.logsCopied'));
      })
      .catch(() => {
        message.error(t('errors.copyFailed'));
      });
  };

  const handleExportBackendLogs = () => {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const filename = `backend-logs-${timestamp}.txt`;
      const blob = new Blob([backendLogText], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      message.success(t('messages.backendLogsExported', { filename }));
    } catch (error) {
      console.error('[DevToolsPage] 导出日志失败:', error);
      message.error(t('errors.exportFailed'));
    }
  };

  return (
    <div
      style={{
        padding: '16px',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: colors.bgPrimary,
        color: colors.textPrimary,
      }}
    >
      <Tabs
        defaultActiveKey="logs"
        style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
        items={[
          {
            key: 'logs',
            label: (
              <span>
                <BugOutlined /> {t('devTools.backendLogsTab')}
              </span>
            ),
            children: (
              <div>
                <Space style={{ marginBottom: 12, width: '100%', justifyContent: 'space-between' }}>
                  <Space>
                    <Button
                      icon={backendEnabled ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
                      onClick={handleToggleBackendLog}
                      type={backendEnabled ? 'primary' : 'default'}
                    >
                      {backendEnabled ? t('devTools.pause') : t('devTools.resume')}
                    </Button>
                    <Button icon={<ClearOutlined />} onClick={handleClearBackendLogs}>
                      {t('devTools.clear')}
                    </Button>
                    <span style={{ fontSize: '12px', color: colors.textSecondary }}>
                      {backendEnabled ? t('devTools.updateInterval') : t('devTools.paused')}
                    </span>
                  </Space>
                  <Space>
                    <Button icon={<DownloadOutlined />} onClick={handleExportBackendLogs}>
                      {t('devTools.export')}
                    </Button>
                    <Button icon={<CopyOutlined />} onClick={handleCopy} type="primary">
                      {t('devTools.copy')}
                    </Button>
                  </Space>
                </Space>

                <TextArea
                  ref={backendLogRef}
                  value={backendLogText}
                  readOnly
                  rows={25}
                  placeholder={t('devTools.backendLogsEmpty')}
                  style={logTextAreaStyle}
                />

                <div
                  style={{
                    marginTop: 12,
                    fontSize: '12px',
                    color: colors.textSecondary,
                    display: 'flex',
                    justifyContent: 'space-between',
                  }}
                >
                  <span>
                    {t('devTools.linesCount', {
                      count: backendLogText.split('\n').filter((l) => l.trim()).length,
                    })}
                  </span>
                  <span>{t('devTools.charsCount', { count: backendLogText.length })}</span>
                  <span>{t('devTools.lastUpdate', { time: formatTime() })}</span>
                </div>
              </div>
            ),
          },
          {
            key: 'prompt-logs',
            label: (
              <span>
                <FileTextOutlined /> {t('devTools.promptLogsTab')}
              </span>
            ),
            children: (
              <div>
                <Space style={{ marginBottom: 12, width: '100%', justifyContent: 'space-between' }}>
                  <Space>
                    <Button icon={<ClearOutlined />} onClick={handleClearPromptLogs}>
                      {t('devTools.clear')}
                    </Button>
                    <span style={{ fontSize: '12px', color: colors.textSecondary }}>
                      {backendEnabled ? t('devTools.updateInterval') : t('devTools.paused')}
                    </span>
                  </Space>
                  <Space>
                    <Button
                      icon={<CopyOutlined />}
                      onClick={() => {
                        navigator.clipboard
                          .writeText(promptLogs)
                          .then(() => {
                            message.success(t('messages.promptLogsCopied'));
                          })
                          .catch(() => {
                            message.error(t('errors.copyFailed'));
                          });
                      }}
                      type="primary"
                    >
                      {t('devTools.copy')}
                    </Button>
                  </Space>
                </Space>

                <div
                  style={{
                    fontSize: '12px',
                    color: 'var(--color-textPrimary)',
                    marginBottom: 12,
                    padding: '8px 12px',
                    background: 'var(--color-bgSecondary)',
                    borderRadius: 4,
                    border: '1px solid var(--color-borderSecondary)',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {t('devTools.promptLogsHelp')}
                </div>

                <TextArea
                  ref={promptLogRef}
                  value={promptLogText}
                  readOnly
                  rows={25}
                  placeholder={t('devTools.promptLogsEmpty')}
                  style={{
                    ...logTextAreaStyle,
                    whiteSpace: 'pre-wrap',
                  }}
                />

                <div
                  style={{
                    marginTop: 12,
                    fontSize: '12px',
                    color: colors.textSecondary,
                    display: 'flex',
                    justifyContent: 'space-between',
                  }}
                >
                  <span>
                    {t('devTools.linesCount', {
                      count: promptLogText.split('\n').filter((l) => l.trim()).length,
                    })}
                  </span>
                  <span>{t('devTools.charsCount', { count: promptLogText.length })}</span>
                  <span>{t('devTools.lastUpdate', { time: formatTime() })}</span>
                </div>
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
