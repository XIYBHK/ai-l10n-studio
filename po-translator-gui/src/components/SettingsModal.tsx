import React, { useState, useEffect } from 'react';
import { 
  Modal, 
  Form, 
  Input, 
  Switch, 
  Select, 
  InputNumber, 
  Button, 
  List, 
  Card, 
  Space, 
  Divider, 
  Tag, 
  Popconfirm,
  message,
  Row,
  Col,
  Tabs,
  Alert
} from 'antd';
import { 
  PlusOutlined, 
  DeleteOutlined, 
  EditOutlined, 
  CheckOutlined,
  ThunderboltOutlined,
  FileTextOutlined,
  ApiOutlined,
  UndoOutlined,
  GlobalOutlined
} from '@ant-design/icons';
import { aiConfigApi, systemPromptApi } from '../services/api';
import { AIConfig, ProviderType } from '../types/aiProvider';
import { createModuleLogger } from '../utils/logger';
import { useAsync } from '../hooks/useAsync';
import i18n from '../i18n/config'; // Phase 6

const log = createModuleLogger('SettingsModal');

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
}

// 供应商配置
const PROVIDER_CONFIGS = [
  { 
    value: ProviderType.Moonshot, 
    label: 'Moonshot AI', 
    defaultUrl: 'https://api.moonshot.cn/v1', 
    defaultModel: 'moonshot-v1-auto' 
  },
  { 
    value: ProviderType.OpenAI, 
    label: 'OpenAI', 
    defaultUrl: 'https://api.openai.com/v1', 
    defaultModel: 'gpt-3.5-turbo' 
  },
  { 
    value: ProviderType.SparkDesk, 
    label: '讯飞星火', 
    defaultUrl: 'https://spark-api.xf-yun.com/v1', 
    defaultModel: 'spark-v3.5' 
  },
  { 
    value: ProviderType.Wenxin, 
    label: '百度文心', 
    defaultUrl: 'https://aip.baidubce.com/rpc/2.0/ai_custom/v1', 
    defaultModel: 'ERNIE-Bot-4' 
  },
  { 
    value: ProviderType.Qianwen, 
    label: '阿里通义千问', 
    defaultUrl: 'https://dashscope.aliyuncs.com/api/v1', 
    defaultModel: 'qwen-max' 
  },
  { 
    value: ProviderType.GLM, 
    label: '智谱 GLM', 
    defaultUrl: 'https://open.bigmodel.cn/api/paas/v4', 
    defaultModel: 'glm-4' 
  },
  { 
    value: ProviderType.Claude, 
    label: 'Claude (Anthropic)', 
    defaultUrl: 'https://api.anthropic.com/v1', 
    defaultModel: 'claude-3-opus-20240229' 
  },
  { 
    value: ProviderType.Gemini, 
    label: 'Google Gemini', 
    defaultUrl: 'https://generativelanguage.googleapis.com/v1', 
    defaultModel: 'gemini-pro' 
  },
];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  visible,
  onClose,
}) => {
  const [form] = Form.useForm();
  const [configs, setConfigs] = useState<AIConfig[]>([]);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [testing, setTesting] = useState(false);
  
  // Phase 3: 系统提示词状态
  const [systemPrompt, setSystemPrompt] = useState<string>('');
  const [isPromptModified, setIsPromptModified] = useState(false);
  
  // Phase 6: 语言设置状态
  const [currentLanguage, setCurrentLanguage] = useState<string>(i18n.language);
  
  // 异步操作hooks
  const { execute: loadPrompt } = useAsync(systemPromptApi.getPrompt);
  const { execute: savePrompt, loading: savingPrompt } = useAsync(systemPromptApi.updatePrompt);
  const { execute: resetPrompt, loading: resettingPrompt } = useAsync(systemPromptApi.resetPrompt);

  useEffect(() => {
    if (visible) {
      loadConfigs();
      loadSystemPrompt();
    }
  }, [visible]);
  
  const loadSystemPrompt = async () => {
    try {
      const prompt = await loadPrompt();
      setSystemPrompt(prompt || '');
      setIsPromptModified(false);
    } catch (error) {
      log.logError(error, '加载系统提示词失败');
    }
  };

  const loadConfigs = async () => {
    try {
      const allConfigs = await aiConfigApi.getAllConfigs();
      setConfigs(allConfigs);
      
      const activeConfig = await aiConfigApi.getActiveConfig();
      if (activeConfig) {
        const index = allConfigs.findIndex(
          c => c.provider === activeConfig.provider && c.apiKey === activeConfig.apiKey
        );
        setActiveIndex(index >= 0 ? index : null);
      }
      
      log.info('配置加载成功', { count: allConfigs.length, activeIndex });
    } catch (error) {
      log.logError(error, '加载配置失败');
    }
  };

  const handleProviderChange = (provider: ProviderType) => {
    const providerConfig = PROVIDER_CONFIGS.find(p => p.value === provider);
    if (providerConfig) {
      form.setFieldsValue({
        baseUrl: providerConfig.defaultUrl,
        model: providerConfig.defaultModel,
      });
    }
  };

  const handleAddNew = () => {
    setIsAddingNew(true);
    setEditingIndex(null);
    form.resetFields();
    form.setFieldsValue({
      provider: ProviderType.Moonshot,
      baseUrl: 'https://api.moonshot.cn/v1',
      model: 'moonshot-v1-auto',
      proxy: {
        enabled: false,
        host: '127.0.0.1',
        port: 7890,
      },
    });
  };

  const handleEdit = (index: number) => {
    const config = configs[index];
    setEditingIndex(index);
    setIsAddingNew(false);
    form.setFieldsValue({
      provider: config.provider,
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
      model: config.model,
      proxy: config.proxy || {
        enabled: false,
        host: '127.0.0.1',
        port: 7890,
      },
    });
  };

  const handleSaveConfig = async () => {
    try {
      const values = await form.validateFields();
      const config: AIConfig = {
        provider: values.provider,
        apiKey: values.apiKey,
        baseUrl: values.baseUrl || undefined,
        model: values.model || undefined,
        proxy: values.proxy?.enabled ? {
          enabled: values.proxy.enabled,
          host: values.proxy.host,
          port: values.proxy.port,
        } : undefined,
      };

      if (isAddingNew) {
        await aiConfigApi.addConfig(config);
        message.success('添加配置成功');
      } else if (editingIndex !== null) {
        await aiConfigApi.updateConfig(editingIndex, config);
        message.success('更新配置成功');
      }

      await loadConfigs();
      setIsAddingNew(false);
      setEditingIndex(null);
      form.resetFields();
      log.info('配置保存成功', { provider: config.provider });
    } catch (error) {
      log.logError(error, '保存配置失败');
      message.error('保存配置失败');
    }
  };

  const handleDelete = async (index: number) => {
    try {
      await aiConfigApi.removeConfig(index);
      message.success('删除配置成功');
      await loadConfigs();
      log.info('配置删除成功', { index });
    } catch (error) {
      log.logError(error, '删除配置失败');
      message.error('删除配置失败');
    }
  };

  const handleSetActive = async (index: number) => {
    try {
      await aiConfigApi.setActiveConfig(index);
      setActiveIndex(index);
      message.success('设置启用配置成功');
      log.info('设置启用配置成功', { index });
    } catch (error) {
      log.logError(error, '设置启用配置失败');
      message.error('设置启用配置失败');
    }
  };

  const handleTestConnection = async () => {
    try {
      setTesting(true);
      const values = await form.validateFields();
      
      const result = await aiConfigApi.testConnection(
        values.provider,
        values.apiKey,
        values.baseUrl || undefined
      );

      if (result.success) {
        message.success(
          `${result.message} (响应时间: ${result.response_time_ms}ms)`,
          3
        );
      } else {
        message.error(result.message, 5);
      }
      
      log.info('连接测试完成', result);
    } catch (error) {
      log.logError(error, '测试连接失败');
      message.error('测试连接失败');
    } finally {
      setTesting(false);
    }
  };
  
  // Phase 3: 系统提示词处理函数
  const handlePromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setSystemPrompt(e.target.value);
    setIsPromptModified(true);
  };
  
  const handleSavePrompt = async () => {
    try {
      await savePrompt(systemPrompt);
      setIsPromptModified(false);
      message.success('系统提示词已保存');
      log.info('系统提示词已保存');
    } catch (error) {
      log.logError(error, '保存系统提示词失败');
    }
  };
  
  const handleResetPrompt = async () => {
    try {
      await resetPrompt();
      await loadSystemPrompt();
      message.success('系统提示词已重置为默认值');
      log.info('系统提示词已重置');
    } catch (error) {
      log.logError(error, '重置系统提示词失败');
    }
  };

  // Phase 6: 语言切换处理
  const handleLanguageChange = async (language: string) => {
    try {
      await i18n.changeLanguage(language);
      setCurrentLanguage(language);
      localStorage.setItem('app-language', language);
      message.success(`语言已切换为 ${language === 'zh-CN' ? '简体中文' : 'English'}`);
      log.info('应用语言已切换', { language });
    } catch (error) {
      log.logError(error, '语言切换失败');
      message.error('语言切换失败');
    }
  };

  const handleCancel = () => {
    setIsAddingNew(false);
    setEditingIndex(null);
    form.resetFields();
  };

  const getProviderLabel = (provider: ProviderType) => {
    return PROVIDER_CONFIGS.find(p => p.value === provider)?.label || provider;
  };

  // 定义Tab项
  const tabItems = [
    {
      key: 'ai-config',
      label: (
        <span>
          <ApiOutlined /> AI 配置
        </span>
      ),
      children: (
        <Row gutter={16}>
        {/* 左侧：配置列表 */}
        <Col span={10}>
          <Card 
            title="已保存的配置" 
            size="small"
            extra={
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={handleAddNew}
                size="small"
              >
                新增
              </Button>
            }
          >
            <List
              dataSource={configs}
              locale={{ emptyText: '暂无配置，请点击"新增"添加配置' }}
              renderItem={(config, index) => (
                <List.Item
                  actions={[
                    <Button
                      key="edit"
                      type="link"
                      icon={<EditOutlined />}
                      onClick={() => handleEdit(index)}
                      size="small"
                    />,
                    <Popconfirm
                      key="delete"
                      title="确认删除此配置？"
                      onConfirm={() => handleDelete(index)}
                      okText="确认"
                      cancelText="取消"
                    >
                      <Button
                        type="link"
                        danger
                        icon={<DeleteOutlined />}
                        size="small"
                      />
                    </Popconfirm>,
                  ]}
                >
                  <List.Item.Meta
                    title={
                      <Space>
                        <span>{getProviderLabel(config.provider)}</span>
                        {activeIndex === index && (
                          <Tag color="green" icon={<CheckOutlined />}>
                            启用中
                          </Tag>
                        )}
                      </Space>
                    }
                    description={
                      <div style={{ fontSize: '12px', color: '#666' }}>
                        <div>API: {config.apiKey.substring(0, 10)}...</div>
                        {config.proxy?.enabled && (
                          <div>代理: {config.proxy.host}:{config.proxy.port}</div>
                        )}
                      </div>
                    }
                  />
                  {activeIndex !== index && (
                    <Button
                      type="text"
                      size="small"
                      onClick={() => handleSetActive(index)}
                    >
                      设为启用
                    </Button>
                  )}
                </List.Item>
              )}
            />
          </Card>
        </Col>

        {/* 右侧：配置编辑器 */}
        <Col span={14}>
          {(isAddingNew || editingIndex !== null) ? (
            <Card 
              title={isAddingNew ? '新增配置' : '编辑配置'} 
              size="small"
            >
              <Form
                form={form}
                layout="vertical"
                size="small"
              >
                <Form.Item
                  label="服务提供商"
                  name="provider"
                  rules={[{ required: true, message: '请选择服务提供商' }]}
                >
                  <Select onChange={handleProviderChange}>
                    {PROVIDER_CONFIGS.map(p => (
                      <Select.Option key={p.value} value={p.value}>
                        {p.label}
                      </Select.Option>
                    ))}
                  </Select>
                </Form.Item>

                <Form.Item
                  label="API 密钥"
                  name="apiKey"
                  rules={[{ required: true, message: '请输入 API 密钥' }]}
                >
                  <Input.Password placeholder="请输入 API 密钥" />
                </Form.Item>

                <Form.Item
                  label="API 基础 URL"
                  name="baseUrl"
                  tooltip="留空使用默认 URL"
                >
                  <Input placeholder="https://api.example.com/v1" />
                </Form.Item>

                <Form.Item
                  label="模型"
                  name="model"
                  tooltip="留空使用默认模型"
                >
                  <Input placeholder="模型名称" />
                </Form.Item>

                <Divider orientation="left" plain style={{ margin: '12px 0' }}>
                  代理设置
                </Divider>

                <Form.Item
                  label="启用代理"
                  name={['proxy', 'enabled']}
                  valuePropName="checked"
                  tooltip="如果使用 VPN，需要配置代理"
                >
                  <Switch />
                </Form.Item>

                <Form.Item
                  noStyle
                  shouldUpdate={(prevValues, currentValues) =>
                    prevValues.proxy?.enabled !== currentValues.proxy?.enabled
                  }
                >
                  {({ getFieldValue }) =>
                    getFieldValue(['proxy', 'enabled']) ? (
                      <>
                        <Form.Item
                          label="代理地址"
                          name={['proxy', 'host']}
                          rules={[{ required: true, message: '请输入代理地址' }]}
                        >
                          <Input placeholder="127.0.0.1" />
                        </Form.Item>

                        <Form.Item
                          label="代理端口"
                          name={['proxy', 'port']}
                          rules={[{ required: true, message: '请输入代理端口' }]}
                        >
                          <InputNumber 
                            placeholder="7890" 
                            min={1} 
                            max={65535} 
                            style={{ width: '100%' }}
                          />
                        </Form.Item>
                      </>
                    ) : null
                  }
                </Form.Item>

                <Divider style={{ margin: '12px 0' }} />

                <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
                  <Button onClick={handleCancel}>
                    取消
                  </Button>
                  <Button
                    icon={<ThunderboltOutlined />}
                    onClick={handleTestConnection}
                    loading={testing}
                  >
                    测试连接
                  </Button>
                  <Button type="primary" onClick={handleSaveConfig}>
                    保存
                  </Button>
                </Space>
              </Form>
            </Card>
          ) : (
            <Card 
              size="small"
              style={{ 
                height: '100%', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                color: '#999'
              }}
            >
              <div style={{ textAlign: 'center' }}>
                <p>选择一个配置进行编辑</p>
                <p>或点击"新增"添加新配置</p>
              </div>
            </Card>
          )}
        </Col>
      </Row>
      ),
    },
    {
      key: 'system-prompt',
      label: (
        <span>
          <FileTextOutlined /> 系统提示词
        </span>
      ),
      children: (
        <div>
          <Alert
            message="自定义系统提示词"
            description="修改翻译提示词以适应不同领域的翻译需求。留空则使用默认提示词。提示词会自动与术语库风格总结拼接。"
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />
          
          <Card 
            size="small" 
            title="系统提示词编辑器" 
            style={{ marginBottom: 16 }}
          >
            <Input.TextArea
              value={systemPrompt}
              onChange={handlePromptChange}
              placeholder="输入自定义系统提示词..."
              autoSize={{ minRows: 12, maxRows: 20 }}
              style={{ fontFamily: 'monospace' }}
            />
          </Card>
          
          <Card 
            size="small" 
            title="💡 最终提示词组成说明" 
            style={{ marginBottom: 16, background: '#f5f5f5' }}
          >
            <div style={{ fontSize: '13px', lineHeight: '1.8' }}>
              <p><strong>实际发送给 AI 的提示词结构：</strong></p>
              <div style={{ 
                background: '#fff', 
                padding: '12px', 
                borderRadius: '4px',
                fontFamily: 'monospace',
                fontSize: '12px'
              }}>
                <div>1️⃣ <strong>基础提示词</strong>（你在上方编辑的内容，或默认提示词）</div>
                <div style={{ marginTop: 8 }}>+</div>
                <div style={{ marginTop: 8 }}>2️⃣ <strong>术语库风格总结</strong>（如果有，系统自动拼接）</div>
                <div style={{ marginLeft: 20, color: '#666', marginTop: 4 }}>
                  • 格式：【用户翻译风格偏好】（基于N条术语学习）
                </div>
                <div style={{ marginTop: 8 }}>=</div>
                <div style={{ marginTop: 8 }}>📤 <strong>发送给 AI</strong></div>
              </div>
              <p style={{ marginTop: 12, color: '#666' }}>
                ✨ 提示：术语库的风格总结会自动附加到你的提示词之后，无需手动添加
              </p>
            </div>
          </Card>
          
          <Space>
            <Button
              type="primary"
              onClick={handleSavePrompt}
              loading={savingPrompt}
              disabled={!isPromptModified}
            >
              保存提示词
            </Button>
            <Popconfirm
              title="确认重置为默认提示词？"
              onConfirm={handleResetPrompt}
              okText="确认"
              cancelText="取消"
            >
              <Button
                icon={<UndoOutlined />}
                loading={resettingPrompt}
              >
                重置为默认
              </Button>
            </Popconfirm>
            {isPromptModified && (
              <Tag color="warning">未保存</Tag>
            )}
          </Space>
        </div>
      ),
    },
    {
      key: 'language',
      label: (
        <span>
          <GlobalOutlined /> 语言设置
        </span>
      ),
      children: (
        <div>
          <Alert
            message="应用语言设置"
            description="选择应用界面显示的语言。语言设置会立即生效并保存。"
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />
          
          <Card size="small" title="当前语言" style={{ marginBottom: 16 }}>
            <Select
              value={currentLanguage}
              onChange={handleLanguageChange}
              style={{ width: 200 }}
            >
              <Select.Option value="zh-CN">简体中文</Select.Option>
              <Select.Option value="en-US">English</Select.Option>
            </Select>
          </Card>
          
          <Card 
            size="small" 
            title="🌍 语言优先级说明" 
            style={{ background: '#f5f5f5' }}
          >
            <div style={{ fontSize: '13px', lineHeight: '1.8' }}>
              <p><strong>应用语言选择优先级：</strong></p>
              <div style={{ 
                background: '#fff', 
                padding: '12px', 
                borderRadius: '4px',
                marginTop: 8
              }}>
                <div>1️⃣ <strong>用户手动设置</strong>（你在上方选择的语言）</div>
                <div style={{ marginTop: 8 }}>↓</div>
                <div style={{ marginTop: 8 }}>2️⃣ <strong>系统语言</strong>（首次启动时自动检测）</div>
                <div style={{ marginTop: 8 }}>↓</div>
                <div style={{ marginTop: 8 }}>3️⃣ <strong>默认中文</strong>（如果以上都失败）</div>
              </div>
              <p style={{ marginTop: 12, color: '#666' }}>
                ✨ 提示：语言设置会保存在本地，下次启动时自动使用
              </p>
            </div>
          </Card>
        </div>
      ),
    },
  ];
  
  return (
    <Modal
      title="设置"
      open={visible}
      onCancel={onClose}
      footer={null}
      width={900}
      destroyOnClose
      maskClosable={false}
    >
      <Tabs items={tabItems} defaultActiveKey="ai-config" />
    </Modal>
  );
};
