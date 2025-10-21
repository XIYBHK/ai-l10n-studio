import React, { useState, useRef, useEffect } from 'react';
import { Modal, Input, Button, Space, Tabs, Alert, Divider, App } from 'antd';
import {
  CopyOutlined,
  ReloadOutlined,
  ClearOutlined,
  BugOutlined,
  DownloadOutlined,
  FileTextOutlined,
  ExperimentOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
} from '@ant-design/icons';
import Draggable from 'react-draggable';
import { runDynamicProviderTests, TestResult } from '../utils/testDynamicProviders';

// ✅ 新的日志服务（参考 clash-verge-rev）
import {
  useGlobalLogStore,
  toggleBackendLogEnabled,
  clearBackendLogs,
  clearPromptLogs,
  clearFrontendLogs,
  startBackendLogMonitoring,
  stopBackendLogMonitoring,
  startPromptLogMonitoring,
  stopPromptLogMonitoring,
  toggleFrontendLogEnabled,
} from '../services/logService';

const { TextArea } = Input;

interface DevToolsModalProps {
  visible: boolean;
  onClose: () => void;
}

export const DevToolsModal: React.FC<DevToolsModalProps> = ({ visible, onClose }) => {
  // ✅ 使用 App 提供的 message（避免静态方法警告）
  const { message } = App.useApp();

  // ✅ 使用全局日志 Store（参考 clash-verge-rev）
  const {
    backendLogs,
    backendEnabled,
    frontendLogs,
    frontendEnabled,
    promptLogs,
  } = useGlobalLogStore();

  // 格式化日志显示
  const backendLogText = backendLogs.join('\n');
  const frontendLogText = frontendLogs
    .map((log) => `[${log.time}] [${log.type}] ${log.module ? `[${log.module}]` : ''} ${log.message}`)
    .join('\n');
  const promptLogText = promptLogs;
  const [bounds, setBounds] = useState({ left: 0, top: 0, bottom: 0, right: 0 });
  const [disabled, setDisabled] = useState(true);
  const draggleRef = useRef<HTMLDivElement>(null);

  // 🧪 动态供应商测试状态
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [testRunning, setTestRunning] = useState(false);
  const [testSummary, setTestSummary] = useState<{ passed: number; failed: number } | null>(null);

  // 📜 日志自动滚动 refs
  const backendLogRef = useRef<any>(null);
  const promptLogRef = useRef<any>(null);
  const frontendLogRef = useRef<any>(null);

  // 🧪 运行动态供应商测试
  const handleRunTests = async () => {
    setTestRunning(true);
    setTestResults([]);
    setTestSummary(null);

    try {
      console.log('🚀 开始运行动态供应商测试套件...');
      const result = await runDynamicProviderTests();

      setTestResults(result.results);
      setTestSummary({ passed: result.passed, failed: result.failed });

      if (result.failed === 0) {
        message.success(`🎉 所有测试通过！(${result.passed}/${result.passed + result.failed})`);
      } else {
        message.warning(`⚠️ 部分测试失败 (${result.passed}/${result.passed + result.failed})`);
      }
    } catch (error) {
      log.error('测试套件运行失败:', error);
      message.error('测试套件运行失败');
    } finally {
      setTestRunning(false);
    }
  };

  // ⏸️ 暂停/继续日志收集（参考 clash-verge-rev）
  const handleToggleBackendLog = () => {
    toggleBackendLogEnabled();
    message.info(backendEnabled ? '⏸️ 后端日志已暂停' : '▶️ 后端日志已继续');
  };

  const handleToggleFrontendLog = () => {
    toggleFrontendLogEnabled();
    message.info(frontendEnabled ? '⏸️ 前端日志已暂停' : '▶️ 前端日志已继续');
  };

  // 🧹 清空日志（参考 clash-verge-rev）
  const handleClearBackendLogs = async () => {
    try {
      await clearBackendLogs();
      message.success('🧹 后端日志已清空');
    } catch (error) {
      console.error('[DevToolsModal] 清空后端日志失败:', error);
      message.error('清空失败');
    }
  };

  const handleClearPromptLogs = async () => {
    try {
      await clearPromptLogs();
      message.success('🧹 提示词日志已清空');
    } catch (error) {
      console.error('[DevToolsModal] 清空提示词日志失败:', error);
      message.error('清空失败');
    }
  };

  const handleClearFrontendLogs = () => {
    clearFrontendLogs();
    message.success('🧹 前端日志已清空');
  };

  // 🎯 模态框打开时启动日志监控（参考 clash）
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

  // 📜 自动滚动到底部（显示最新日志）
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

  useEffect(() => {
    if (frontendLogRef.current?.resizableTextArea?.textArea) {
      const textarea = frontendLogRef.current.resizableTextArea.textArea;
      textarea.scrollTop = textarea.scrollHeight;
    }
  }, [frontendLogText]);

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
      console.error('[DevToolsModal] 导出日志失败:', error);
      message.error('导出失败');
    }
  };

  const handleExportFrontendLogs = () => {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const filename = `frontend-logs-${timestamp}.txt`;
      const blob = new Blob([frontendLogText], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      message.success(`前端日志已导出: ${filename}`);
    } catch (error) {
      console.error('[DevToolsModal] 导出前端日志失败:', error);
      message.error('导出失败');
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
                      icon={backendEnabled ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
                      onClick={handleToggleBackendLog}
                      type={backendEnabled ? 'primary' : 'default'}
                    >
                      {backendEnabled ? '⏸️ 暂停' : '▶️ 继续'}
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
                    icon={frontendEnabled ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
                    onClick={handleToggleFrontendLog}
                    type={frontendEnabled ? 'primary' : 'default'}
                  >
                    {frontendEnabled ? '⏸️ 暂停' : '▶️ 继续'}
                  </Button>
                  <Button icon={<ClearOutlined />} onClick={handleClearFrontendLogs}>
                    清空
                  </Button>
                  <Button icon={<DownloadOutlined />} onClick={handleExportFrontendLogs}>
                    导出
                  </Button>
                  <span style={{ fontSize: '12px', color: '#999' }}>
                    {frontendEnabled ? '(实时收集)' : '(已暂停)'}
                  </span>
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
                  💡 自动捕获：模块日志（INFO/WARN/ERROR 级别）
                  <br />
                  📁 内存管理：最多保留 1000 条日志
                  <br />
                  ⚙️ 简化设计：无文件保存，只保留内存日志，性能更好
                </div>

                <TextArea
                  ref={frontendLogRef}
                  value={frontendLogText}
                  readOnly
                  rows={20}
                  placeholder="暂无前端日志\n\n提示：\n- 自动捕获 INFO/WARN/ERROR 级别日志\n- 最多保留 1000 条\n- 内存模式，性能更好"
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
                    日志行数: {frontendLogs.length}
                  </span>
                  <span>字符数: {frontendLogText.length}</span>
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
                  💡 捕获精翻（Contextual Refine）和批量翻译时发送给 AI 的提示词及响应
                  <br />
                  📊 每个日志包含：时间、类型、完整提示词、AI响应、元数据
                  <br />
                  🔄 最多保留最近 100 条记录，可手动清空
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
          {
            key: 'provider-tests',
            label: (
              <span>
                <ExperimentOutlined /> 供应商测试
              </span>
            ),
            children: (
              <div>
                <Alert
                  message="🧪 动态供应商架构测试"
                  description="测试 Phase 2 的动态供应商系统，验证前后端 API 是否正常工作"
                  type="info"
                  showIcon
                  style={{ marginBottom: 16 }}
                />

                <Space style={{ marginBottom: 16 }}>
                  <Button
                    icon={<PlayCircleOutlined />}
                    onClick={handleRunTests}
                    loading={testRunning}
                    type="primary"
                  >
                    运行完整测试套件
                  </Button>
                  <Button
                    icon={<ClearOutlined />}
                    onClick={() => {
                      setTestResults([]);
                      setTestSummary(null);
                      message.success('测试结果已清空');
                    }}
                    disabled={testResults.length === 0}
                  >
                    清空结果
                  </Button>
                </Space>

                {testSummary && (
                  <Alert
                    message={`测试完成: ${testSummary.passed} 通过, ${testSummary.failed} 失败`}
                    type={testSummary.failed === 0 ? 'success' : 'warning'}
                    showIcon
                    style={{ marginBottom: 16 }}
                  />
                )}

                {testResults.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <Divider orientation="left">详细测试结果</Divider>
                    {testResults.map((result, index) => (
                      <div key={index} style={{ marginBottom: 12 }}>
                        <Alert
                          message={`测试 ${index + 1}: ${result.success ? '✅ 通过' : '❌ 失败'}`}
                          description={
                            <div>
                              <div style={{ marginBottom: 8 }}>{result.message}</div>
                              {result.data && (
                                <details>
                                  <summary style={{ cursor: 'pointer', color: '#1890ff' }}>
                                    查看数据详情
                                  </summary>
                                  <pre
                                    style={{
                                      marginTop: 8,
                                      fontSize: '12px',
                                      background: '#f5f5f5',
                                      padding: '8px',
                                      borderRadius: '4px',
                                      maxHeight: '200px',
                                      overflow: 'auto',
                                    }}
                                  >
                                    {JSON.stringify(result.data, null, 2)}
                                  </pre>
                                </details>
                              )}
                            </div>
                          }
                          type={result.success ? 'success' : 'error'}
                          showIcon
                        />
                      </div>
                    ))}
                  </div>
                )}

                <div
                  style={{
                    padding: '12px',
                    background: '#f8f9fa',
                    borderRadius: '6px',
                    fontSize: '12px',
                    color: '#666',
                  }}
                >
                  <div>
                    <strong>测试项目:</strong>
                  </div>
                  <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
                    <li>获取所有已注册的 AI 供应商</li>
                    <li>获取所有可用的模型</li>
                    <li>根据模型 ID 查找对应供应商</li>
                    <li>测试已知模型: deepseek-chat, kimi-latest</li>
                    <li>测试不存在模型的处理</li>
                  </ul>
                  <div>
                    <strong>意义:</strong>{' '}
                    验证插件化架构是否正常工作，确保添加新供应商时前端能自动识别
                  </div>
                </div>
              </div>
            ),
          },
        ]}
      />
    </Modal>
  );
};
