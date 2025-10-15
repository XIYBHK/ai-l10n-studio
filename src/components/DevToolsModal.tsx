import React, { useState, useRef } from 'react';
import { Modal, Input, Button, Space, message, Tabs } from 'antd';
import {
  CopyOutlined,
  ReloadOutlined,
  ClearOutlined,
  FileOutlined,
  BugOutlined,
  DownloadOutlined,
  SaveOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import { logCommands } from '../services/commands'; // ✅ 迁移到统一命令层 (promptLogApi 已通过 hooks 使用)
import Draggable from 'react-draggable';
import { FileDropTest } from './FileDropTest';
import { createModuleLogger } from '../utils/logger';
import { frontendLogger } from '../utils/frontendLogger';
import { useBackendLogs, useFrontendLogs, usePromptLogs } from '../hooks/useLogs';

const { TextArea } = Input;
const log = createModuleLogger('DevToolsModal');

interface DevToolsModalProps {
  visible: boolean;
  onClose: () => void;
}

export const DevToolsModal: React.FC<DevToolsModalProps> = ({ visible, onClose }) => {
  // 只有在窗口打开时才启用 SWR 和轮询
  const {
    logs,
    isLoading: loading,
    refresh: refreshBackendLogs,
  } = useBackendLogs({
    enabled: visible,
    refreshInterval: 2000,
  });
  const {
    promptLogs,
    isLoading: promptLoading,
    refresh: refreshPromptLogs,
  } = usePromptLogs({
    enabled: visible,
    refreshInterval: 2000,
  });
  
  // 🔄 前端日志
  const {
    logs: frontendLogs,
    isLoading: frontendLoading,
    refresh: refreshFrontendLogs,
  } = useFrontendLogs({
    enabled: visible,
    refreshInterval: 5000, // 前端日志刷新频率较低
  });
  const backendLogText =
    typeof logs === 'string' ? logs : logs ? JSON.stringify(logs, null, 2) : '';
  const promptLogText =
    typeof promptLogs === 'string'
      ? promptLogs
      : promptLogs
        ? JSON.stringify(promptLogs, null, 2)
        : '';
  const [bounds, setBounds] = useState({ left: 0, top: 0, bottom: 0, right: 0 });
  const [disabled, setDisabled] = useState(true);
  const draggleRef = useRef<HTMLDivElement>(null);

  // 移除了手动刷新的 useEffect，因为 SWR 的 enabled 参数会在 visible=true 时自动请求

  // 🔄 前端日志操作函数（使用新的文件读取系统）
  const handleClearFrontendLogs = () => {
    frontendLogger.clearLogs();
    refreshFrontendLogs(); // 刷新来显示空日志
    message.success('前端日志已清空');
  };

  // SWR 已处理日志加载与轮询

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

  const handleExportLogs = () => {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const filename = `backend-logs-${timestamp}.txt`;

      // 创建 Blob 对象
      const blob = new Blob([backendLogText], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);

      // 创建下载链接
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // 清理
      URL.revokeObjectURL(url);

      message.success(`后端日志已导出: ${filename}`);
      log.info('后端日志已导出', { filename });
    } catch (error) {
      log.logError(error, '导出日志失败');
      message.error('导出失败');
    }
  };

  const handleSaveFrontendLogs = async () => {
    try {
      const filename = await frontendLogger.saveLogs();
      message.success(`前端日志已保存到数据目录: ${filename}`);
      log.info('前端日志已保存', { filename });
    } catch (error) {
      log.logError(error, '保存前端日志失败');
      message.error('保存失败');
    }
  };

  const handleClear = async () => {
    try {
      await logCommands.clear();
      await refreshBackendLogs();
      message.success('日志已清空');
      log.info('日志已清空');
    } catch (error) {
      log.logError(error, '清空日志失败');
    }
  };

  const onStart = (_event: any, uiData: any) => {
    const { clientWidth, clientHeight } = window.document.documentElement;
    const targetRect = draggleRef.current?.getBoundingClientRect();
    if (!targetRect) {
      return;
    }
    setBounds({
      left: -targetRect.left + uiData.x,
      right: clientWidth - (targetRect.right - uiData.x),
      top: -targetRect.top + uiData.y,
      bottom: clientHeight - (targetRect.bottom - uiData.y),
    });
  };

  return (
    <Modal
      title={
        <div
          style={{
            width: '100%',
            cursor: 'move',
          }}
          onMouseOver={() => {
            if (disabled) {
              setDisabled(false);
            }
          }}
          onMouseOut={() => {
            setDisabled(true);
          }}
          onFocus={() => {}}
          onBlur={() => {}}
        >
          🛠️ 开发者工具 (可拖拽)
        </div>
      }
      open={visible}
      onCancel={onClose}
      width={900}
      style={{ top: 20 }}
      destroyOnHidden={true}
      mask={false}
      footer={[
        <Button key="close" onClick={onClose}>
          关闭
        </Button>,
      ]}
      modalRender={(modal) => (
        <Draggable
          disabled={disabled}
          bounds={bounds}
          onStart={(event, uiData) => onStart(event, uiData)}
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
                      icon={<ReloadOutlined />}
                      onClick={refreshBackendLogs}
                      loading={loading}
                    >
                      刷新
                    </Button>
                    <span style={{ fontSize: '12px', color: '#999' }}>(自动刷新: 每2秒)</span>
                  </Space>
                  <Space>
                    <Button icon={<DownloadOutlined />} onClick={handleExportLogs}>
                      导出日志
                    </Button>
                    <Button icon={<ClearOutlined />} onClick={handleClear} danger>
                      清空
                    </Button>
                    <Button icon={<CopyOutlined />} onClick={handleCopy} type="primary">
                      复制日志
                    </Button>
                  </Space>
                </Space>

                <TextArea
                  value={backendLogText}
                  readOnly
                  rows={20}
                  placeholder="等待日志输出...
提示: 
- 日志每2秒自动刷新
- 执行翻译操作时会输出详细日志
- 显示最近1000条日志记录"
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
            key: 'frontend',
            label: (
              <span>
                <BugOutlined /> 前端日志
              </span>
            ),
            children: (
              <div>
                <Space style={{ marginBottom: 12 }}>
                  <Button 
                    icon={<ReloadOutlined />} 
                    onClick={refreshFrontendLogs}
                    loading={frontendLoading}
                  >
                    刷新
                  </Button>
                  <Button icon={<SaveOutlined />} onClick={handleSaveFrontendLogs} type="primary">
                    手动保存
                  </Button>
                  <Button
                    icon={<ClearOutlined />}
                    onClick={handleClearFrontendLogs}
                    danger
                  >
                    清空
                  </Button>
                </Space>

                <div
                  style={{
                    fontSize: '12px',
                    color: '#666',
                    marginBottom: 12,
                    padding: '8px 12px',
                    background: '#e6f7ff',
                    borderRadius: 4,
                    border: '1px solid #91d5ff',
                  }}
                >
                  💡 自动捕获：模块日志（[App]、[EditorPane] 等）+ 错误/警告，已过滤框架噪音
                  <br />
                  📁 文件管理：内存最多 500 条，自动保存每 5 分钟或 100 条日志，保留最近 5 个文件
                  <br />
                  🔄 显示保存到本地的前端日志文件内容（最新 3 个文件）
                </div>

                <TextArea
                  value={frontendLogs}
                  readOnly
                  rows={20}
                  placeholder="等待前端日志输出...(从保存的日志文件读取)"
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
                  <span>日志行数: {frontendLogs.split('\n').filter((l) => l.trim()).length}</span>
                  <span>字符数: {frontendLogs.length}</span>
                  <span>最后更新: {new Date().toLocaleTimeString()}</span>
                </div>
              </div>
            ),
          },
          {
            key: 'filedrop',
            label: (
              <span>
                <FileOutlined /> 文件拖放测试
              </span>
            ),
            children: <FileDropTest />,
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
                    <Button
                      icon={<ReloadOutlined />}
                      onClick={refreshPromptLogs}
                      loading={promptLoading}
                    >
                      刷新
                    </Button>
                    <span style={{ fontSize: '12px', color: '#999' }}>(自动刷新: 每2秒)</span>
                  </Space>
                  <Space>
                    <Button
                      icon={<ClearOutlined />}
                      onClick={async () => {
                        try {
                          await logCommands.clearPromptLogs();
                          refreshPromptLogs();
                          message.success('提示词日志已清空');
                          log.info('提示词日志已清空');
                        } catch (error) {
                          log.logError(error, '清空提示词日志失败');
                        }
                      }}
                      danger
                    >
                      清空
                    </Button>
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
                      复制日志
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
                  💡 捕获精翻（Contextual Refine）和批量翻译时发送给 AI 的提示词及响应
                  <br />
                  📊 每个日志包含：时间、类型、完整提示词、AI响应、元数据
                  <br />
                  🔄 最多保留最近 100 条记录，可手动清空
                </div>

                <TextArea
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
};
