import React, { useState, useEffect, useRef } from 'react';
import { Modal, Input, Button, Space, message, Tabs } from 'antd';
import { CopyOutlined, ReloadOutlined, ClearOutlined, FileOutlined, BugOutlined } from '@ant-design/icons';
import { invoke } from '@tauri-apps/api/tauri';
import Draggable from 'react-draggable';
import { FileDropTest } from './FileDropTest';

const { TextArea } = Input;

interface DevToolsModalProps {
  visible: boolean;
  onClose: () => void;
}

export const DevToolsModal: React.FC<DevToolsModalProps> = ({
  visible,
  onClose,
}) => {
  const [logs, setLogs] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [bounds, setBounds] = useState({ left: 0, top: 0, bottom: 0, right: 0 });
  const [disabled, setDisabled] = useState(true);
  const draggleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (visible) {
      loadLogs();
      // 定时刷新日志
      const interval = setInterval(loadLogs, 2000); // 每2秒刷新
      return () => clearInterval(interval);
    }
  }, [visible]);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const logLines = await invoke<string[]>('get_app_logs');
      setLogs(logLines.join('\n'));
    } catch (error) {
      console.error('Failed to load logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(logs).then(() => {
      message.success('日志已复制到剪贴板');
    }).catch(() => {
      message.error('复制失败');
    });
  };

  const handleClear = async () => {
    try {
      await invoke('clear_app_logs');
      setLogs('');
      message.success('日志已清空');
    } catch (error) {
      message.error('清空失败');
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
      footer={[
        <Button key="close" onClick={onClose}>
          关闭
        </Button>
      ]}
      modalRender={(modal) => (
        <Draggable
          disabled={disabled}
          bounds={bounds}
          onStart={(event, uiData) => onStart(event, uiData)}
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
                <BugOutlined /> 应用日志
              </span>
            ),
            children: (
              <div>
                <Space style={{ marginBottom: 12, width: '100%', justifyContent: 'space-between' }}>
                  <Space>
                    <Button
                      icon={<ReloadOutlined />}
                      onClick={loadLogs}
                      loading={loading}
                    >
                      刷新
                    </Button>
                    <span style={{ fontSize: '12px', color: '#999' }}>
                      (自动刷新: 每2秒)
                    </span>
                  </Space>
                  <Space>
                    <Button
                      icon={<ClearOutlined />}
                      onClick={handleClear}
                      danger
                    >
                      清空
                    </Button>
                    <Button
                      icon={<CopyOutlined />}
                      onClick={handleCopy}
                      type="primary"
                    >
                      复制日志
                    </Button>
                  </Space>
                </Space>

                <TextArea
                  value={logs}
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

                <div style={{ 
                  marginTop: 12, 
                  fontSize: '12px', 
                  color: '#999',
                  display: 'flex',
                  justifyContent: 'space-between'
                }}>
                  <span>日志行数: {logs.split('\n').filter(l => l.trim()).length}</span>
                  <span>字符数: {logs.length}</span>
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
        ]}
      />
    </Modal>
  );
};

