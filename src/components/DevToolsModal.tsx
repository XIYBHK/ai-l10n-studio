import React, { useState, useRef } from 'react';
import { Modal, Input, Button, Space, message, Tabs, Alert, Divider } from 'antd';
import {
  CopyOutlined,
  ReloadOutlined,
  ClearOutlined,
  BugOutlined,
  DownloadOutlined,
  SaveOutlined,
  FileTextOutlined,
  ExperimentOutlined,
  PlayCircleOutlined,
} from '@ant-design/icons';
import { logCommands } from '../services/commands'; // ✅ 迁移到统一命令层 (promptLogApi 已通过 hooks 使用)
import Draggable from 'react-draggable';
import { createModuleLogger } from '../utils/logger';
import { frontendLogger } from '../utils/frontendLogger';
import { useBackendLogs, useFrontendLogs, usePromptLogs } from '../hooks/useLogs';
import { runDynamicProviderTests, TestResult } from '../utils/testDynamicProviders';

const { TextArea } = Input;
const log = createModuleLogger('DevToolsModal');

interface DevToolsModalProps {
  visible: boolean;
  onClose: () => void;
}

export const DevToolsModal: React.FC<DevToolsModalProps> = ({ visible, onClose }) => {
  // 🔄 实时日志模式：打开时自动清空，只显示新产生的日志
  const [realtimeMode, setRealtimeMode] = useState(false);
  
  // 只有在窗口打开时才启用 SWR 和轮询
  const {
    logs,
    isLoading: loading,
    refresh: refreshBackendLogs,
  } = useBackendLogs({
    enabled: visible,
    refreshInterval: realtimeMode ? 2000 : 0, // 实时模式才启用轮询
  });
  const {
    promptLogs,
    isLoading: promptLoading,
    refresh: refreshPromptLogs,
  } = usePromptLogs({
    enabled: visible,
    refreshInterval: realtimeMode ? 2000 : 0, // 实时模式才启用轮询
  });

  // 🔄 前端日志
  const {
    logs: frontendLogs,
    isLoading: frontendLoading,
    refresh: refreshFrontendLogs,
  } = useFrontendLogs({
    enabled: visible,
    refreshInterval: 0, // ❌ 禁用自动轮询，改为手动刷新（避免日志污染）
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

  // 🧪 动态供应商测试状态
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [testRunning, setTestRunning] = useState(false);
  const [testSummary, setTestSummary] = useState<{ passed: number; failed: number } | null>(null);

  // 🧪 运行动态供应商测试
  const handleRunTests = async () => {
    setTestRunning(true);
    setTestResults([]);
    setTestSummary(null);

    try {
      log.info('🚀 开始运行动态供应商测试套件...');
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

  // 🎯 实时日志模式：开启时自动清空历史日志
  const handleToggleRealtimeMode = async () => {
    if (!realtimeMode) {
      // 开启实时模式：先清空所有日志
      try {
        await logCommands.clear(); // 清空后端日志
        await logCommands.clearPromptLogs(); // 清空提示词日志
        message.success('🔴 实时日志模式已开启，历史日志已清空');
        log.info('实时日志模式已开启');
      } catch (error) {
        log.logError(error, '清空日志失败');
        message.error('清空日志失败');
        return;
      }
    } else {
      message.info('⚪ 实时日志模式已关闭');
      log.info('实时日志模式已关闭');
    }
    setRealtimeMode(!realtimeMode);
  };

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
                      icon={realtimeMode ? <BugOutlined /> : <BugOutlined />}
                      onClick={handleToggleRealtimeMode}
                      type={realtimeMode ? 'primary' : 'default'}
                      danger={realtimeMode}
                    >
                      {realtimeMode ? '🔴 实时模式' : '⚪ 实时模式'}
                    </Button>
                    <Button
                      icon={<ReloadOutlined />}
                      onClick={refreshBackendLogs}
                      loading={loading}
                      disabled={realtimeMode}
                    >
                      刷新
                    </Button>
                    <span style={{ fontSize: '12px', color: '#999' }}>
                      {realtimeMode ? '(实时: 每2秒)' : '(手动刷新)'}
                    </span>
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
                  placeholder={
                    realtimeMode
                      ? '🔴 实时日志模式已开启，等待新日志产生...\n\n提示：\n- 日志每2秒自动刷新\n- 只显示开启实时模式后的新日志\n- 适合调试和定位问题'
                      : '⚪ 实时日志模式已关闭\n\n提示：\n- 点击"🔴 实时模式"按钮开启实时监控\n- 开启后会自动清空历史日志，只显示新产生的日志\n- 方便定位触发式操作的日志'
                  }
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
                  <Button icon={<ClearOutlined />} onClick={handleClearFrontendLogs} danger>
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
                  <span>
                    日志行数: {frontendLogs.split('\n').filter((l: string) => l.trim()).length}
                  </span>
                  <span>字符数: {frontendLogs.length}</span>
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
                    <Button
                      icon={<ReloadOutlined />}
                      onClick={refreshPromptLogs}
                      loading={promptLoading}
                      disabled={realtimeMode}
                    >
                      刷新
                    </Button>
                    <span style={{ fontSize: '12px', color: '#999' }}>
                      {realtimeMode ? '(实时: 每2秒)' : '(手动刷新)'}
                    </span>
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
