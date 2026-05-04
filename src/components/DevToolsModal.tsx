import { useEffect, useRef } from 'react';
import { Modal, Input, Button, Space, Tabs, App } from 'antd';
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
import Draggable from 'react-draggable';
import { formatTime } from '../utils/formatters';
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

interface DevToolsModalProps {
  visible: boolean;
  onClose: () => void;
}

export function DevToolsModal({ visible, onClose }: DevToolsModalProps) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const { backendLogs, backendEnabled, promptLogs } = useGlobalLogStore();

  const backendLogText = backendLogs.join('\n');
  const promptLogText = promptLogs;
  const draggleRef = useRef<HTMLDivElement>(null);
  const backendLogRef = useRef<any>(null);
  const promptLogRef = useRef<any>(null);

  function handleToggleBackendLog() {
    toggleBackendLogEnabled();
    message.info(
      backendEnabled ? t('messages.backendLogsPaused') : t('messages.backendLogsResumed')
    );
  }

  async function handleClearBackendLogs() {
    try {
      await clearBackendLogs();
      message.success(t('messages.backendLogsCleared'));
    } catch (error) {
      console.error('[DevToolsModal] 清空后端日志失败:', error);
      message.error(t('errors.clearFailed'));
    }
  }

  async function handleClearPromptLogs() {
    try {
      await clearPromptLogs();
      message.success(t('messages.promptLogsCleared'));
    } catch (error) {
      console.error('[DevToolsModal] 清空提示词日志失败:', error);
      message.error(t('errors.clearFailed'));
    }
  }

  useEffect(() => {
    if (visible) {
      startBackendLogMonitoring();
      startPromptLogMonitoring();
    } else {
      stopBackendLogMonitoring();
      stopPromptLogMonitoring();
    }

    return () => {
      stopBackendLogMonitoring();
      stopPromptLogMonitoring();
    };
  }, [visible]);

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

  function handleCopy() {
    navigator.clipboard
      .writeText(backendLogText)
      .then(() => {
        message.success(t('messages.logsCopied'));
      })
      .catch(() => {
        message.error(t('errors.copyFailed'));
      });
  }

  function handleExportBackendLogs() {
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
      console.error('[DevToolsModal] 导出日志失败:', error);
      message.error(t('errors.exportFailed'));
    }
  }

  return (
    <Modal
      title={
        <div
          style={{
            width: '100%',
            cursor: 'move',
          }}
        >
          {t('devTools.modalTitle')}
        </div>
      }
      open={visible}
      onCancel={onClose}
      width={960}
      centered
      destroyOnClose
      footer={[
        <Button key="close" onClick={onClose}>
          {t('common.close')}
        </Button>,
      ]}
      modalRender={(modal) => (
        <Draggable
          bounds={false}
          nodeRef={draggleRef as unknown as React.RefObject<HTMLDivElement>}
        >
          <div ref={draggleRef}>{modal}</div>
        </Draggable>
      )}
    >
      <Tabs
        defaultActiveKey="logs"
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
                    <span style={{ fontSize: '12px', color: '#999' }}>
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
                  rows={20}
                  placeholder={t('devTools.backendLogsEmpty')}
                  style={{
                    fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                    fontSize: '12px',
                    backgroundColor: '#1e1e1e',
                    color: '#d4d4d4',
                  }}
                />

                <div
                  style={{
                    marginTop: 12,
                    fontSize: '12px',
                    color: '#999',
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
                    <span style={{ fontSize: '12px', color: '#999' }}>
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
                            message.success(t('messages.logsCopied'));
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
                    color: '#666',
                    marginBottom: 12,
                    padding: '8px 12px',
                    background: '#e6fffb',
                    borderRadius: 4,
                    border: '1px solid #87e8de',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {t('devTools.promptLogsHelp')}
                </div>

                <TextArea
                  ref={promptLogRef}
                  value={promptLogText}
                  readOnly
                  rows={20}
                  placeholder={t('devTools.promptLogsEmpty')}
                  style={{
                    fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                    fontSize: '12px',
                    backgroundColor: '#1e1e1e',
                    color: '#d4d4d4',
                    whiteSpace: 'pre-wrap',
                  }}
                />

                <div
                  style={{
                    marginTop: 12,
                    fontSize: '12px',
                    color: '#999',
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
    </Modal>
  );
}
