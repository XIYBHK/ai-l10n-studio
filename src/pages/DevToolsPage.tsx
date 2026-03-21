/**
 * 开发者工具独立窗口页面
 * 将 DevToolsModal 的内容提取为独立页面，可以在独立窗口中运行
 */
import React, { useRef, useEffect } from 'react';
import { Input, Button, Space, Tabs, App } from 'antd';
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
  const { colors, isDark } = useTheme();

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
    message.info(backendEnabled ? '后端日志已暂停' : '后端日志已继续');
  };

  // 清空日志
  const handleClearBackendLogs = async () => {
    try {
      await clearBackendLogs();
      message.success('后端日志已清空');
    } catch (error) {
      console.error('[DevToolsPage] 清空后端日志失败:', error);
      message.error('清空失败');
    }
  };

  const handleClearPromptLogs = async () => {
    try {
      await clearPromptLogs();
      message.success('提示词日志已清空');
    } catch (error) {
      console.error('[DevToolsPage] 清空提示词日志失败:', error);
      message.error('清空失败');
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
        message.success('日志已复制到剪贴板');
      })
      .catch(() => {
        message.error('复制失败');
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
      message.success(`后端日志已导出: ${filename}`);
    } catch (error) {
      console.error('[DevToolsPage] 导出日志失败:', error);
      message.error('导出失败');
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
                <BugOutlined /> 后端日志
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
                      {backendEnabled ? '暂停' : '继续'}
                    </Button>
                    <Button icon={<ClearOutlined />} onClick={handleClearBackendLogs}>
                      清空
                    </Button>
                    <span style={{ fontSize: '12px', color: colors.textSecondary }}>
                      {backendEnabled ? '(每2秒更新)' : '(已暂停)'}
                    </span>
                  </Space>
                  <Space>
                    <Button icon={<DownloadOutlined />} onClick={handleExportBackendLogs}>
                      导出
                    </Button>
                    <Button icon={<CopyOutlined />} onClick={handleCopy} type="primary">
                      复制
                    </Button>
                  </Space>
                </Space>

                <TextArea
                  ref={backendLogRef}
                  value={backendLogText}
                  readOnly
                  rows={25}
                  placeholder="暂无后端日志"
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
                  <span>日志行数: {backendLogText.split('\n').filter((l) => l.trim()).length}</span>
                  <span>字符数: {backendLogText.length}</span>
                  <span>最后更新: {formatTime()}</span>
                </div>
              </div>
            ),
          },
          {
            key: 'prompt-logs',
            label: (
              <span>
                <FileTextOutlined /> AI 提示词日志
              </span>
            ),
            children: (
              <div>
                <Space style={{ marginBottom: 12, width: '100%', justifyContent: 'space-between' }}>
                  <Space>
                    <Button icon={<ClearOutlined />} onClick={handleClearPromptLogs}>
                      清空
                    </Button>
                    <span style={{ fontSize: '12px', color: colors.textSecondary }}>
                      {backendEnabled ? '(每2秒更新)' : '(已暂停)'}
                    </span>
                  </Space>
                  <Space>
                    <Button
                      icon={<CopyOutlined />}
                      onClick={() => {
                        navigator.clipboard
                          .writeText(promptLogs)
                          .then(() => {
                            message.success('提示词日志已复制到剪贴板');
                          })
                          .catch(() => {
                            message.error('复制失败');
                          });
                      }}
                      type="primary"
                    >
                      复制
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
                  }}
                >
                  捕获精翻（Contextual Refine）和批量翻译时发送给 AI 的提示词及响应
                  <br />
                  每个日志包含：时间、类型、完整提示词、AI响应、元数据
                  <br />
                  最多保留最近 100 条记录，可手动清空
                </div>

                <TextArea
                  ref={promptLogRef}
                  value={promptLogText}
                  readOnly
                  rows={25}
                  placeholder="等待提示词日志输出…
提示:
- 执行精翻或批量翻译时会自动记录
- 包含完整的输入提示词和AI响应
- 便于调试和优化翻译质量"
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
                  <span>日志行数: {promptLogText.split('\n').filter((l) => l.trim()).length}</span>
                  <span>字符数: {promptLogText.length}</span>
                  <span>最后更新: {formatTime()}</span>
                </div>
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
