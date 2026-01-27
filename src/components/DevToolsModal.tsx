import { useEffect, useRef } from 'react';
import { Modal, Input, Button, Space, Tabs, App } from 'antd';
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
  const { message } = App.useApp();
  const { backendLogs, backendEnabled, promptLogs } = useGlobalLogStore();

  const backendLogText = backendLogs.join('\n');
  const promptLogText = promptLogs;
  const draggleRef = useRef<HTMLDivElement>(null);
  const backendLogRef = useRef<any>(null);
  const promptLogRef = useRef<any>(null);

  function handleToggleBackendLog() {
    toggleBackendLogEnabled();
    message.info(backendEnabled ? '后端日志已暂停' : '后端日志已继续');
  }

  async function handleClearBackendLogs() {
    try {
      await clearBackendLogs();
      message.success('后端日志已清空');
    } catch (error) {
      console.error('[DevToolsModal] 清空后端日志失败:', error);
      message.error('清空失败');
    }
  }

  async function handleClearPromptLogs() {
    try {
      await clearPromptLogs();
      message.success('提示词日志已清空');
    } catch (error) {
      console.error('[DevToolsModal] 清空提示词日志失败:', error);
      message.error('清空失败');
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
        message.success('日志已复制到剪贴板');
      })
      .catch(() => {
        message.error('复制失败');
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
      message.success(`后端日志已导出: ${filename}`);
    } catch (error) {
      console.error('[DevToolsModal] 导出日志失败:', error);
      message.error('导出失败');
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
          开发者工具
        </div>
      }
      open={visible}
      onCancel={onClose}
      width={900}
      style={{ top: 20 }}
      destroyOnClose
      mask={false}
      footer={[
        <Button key="close" onClick={onClose}>
          关闭
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
                    <span style={{ fontSize: '12px', color: '#999' }}>
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
                  rows={20}
                  placeholder="暂无后端日志"
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
                  <span>日志行数: {backendLogText.split('\n').filter((l) => l.trim()).length}</span>
                  <span>字符数: {backendLogText.length}</span>
                  <span>最后更新: {new Date().toLocaleTimeString()}</span>
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
                    <span style={{ fontSize: '12px', color: '#999' }}>
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
                    color: '#666',
                    marginBottom: 12,
                    padding: '8px 12px',
                    background: '#e6fffb',
                    borderRadius: 4,
                    border: '1px solid #87e8de',
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
                  rows={20}
                  placeholder="等待提示词日志输出...
提示:
- 执行精翻或批量翻译时会自动记录
- 包含完整的输入提示词和AI响应
- 便于调试和优化翻译质量"
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
                  <span>日志行数: {promptLogText.split('\n').filter((l) => l.trim()).length}</span>
                  <span>字符数: {promptLogText.length}</span>
                  <span>最后更新: {new Date().toLocaleTimeString()}</span>
                </div>
              </div>
            ),
          },
        ]}
      />
    </Modal>
  );
}
