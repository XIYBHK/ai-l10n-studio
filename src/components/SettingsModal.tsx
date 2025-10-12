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
  Alert,
  Descriptions
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
  BellOutlined,
  InfoCircleOutlined,
  BgColorsOutlined
} from '@ant-design/icons';
import { aiConfigCommands, systemPromptCommands, aiModelCommands } from '../services/commands'; // ✅ 迁移到统一命令层
import { AIConfig, ProviderType, PROVIDER_INFO_MAP } from '../types/aiProvider';
import { createModuleLogger } from '../utils/logger';
import { useAsync } from '../hooks/useAsync';
import { useAIConfigs, useSystemPrompt } from '../hooks/useConfig';
import i18n from '../i18n/config'; // Phase 6
import { notificationManager } from '../utils/notificationManager'; // Tauri 2.x: Notification
import type { ModelInfo } from '../types/generated/ModelInfo';
import { ThemeModeSwitch } from './ThemeModeSwitch'; // Phase 9

const log = createModuleLogger('SettingsModal');

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
}

// 供应商配置（从 aiProvider.ts 统一获取）
const PROVIDER_CONFIGS = Object.values(ProviderType).map(type => ({
  value: type,
  label: PROVIDER_INFO_MAP[type].displayName,
  defaultUrl: PROVIDER_INFO_MAP[type].defaultUrl,
  defaultModel: PROVIDER_INFO_MAP[type].defaultModel,
}));

export const SettingsModal: React.FC<SettingsModalProps> = ({
  visible,
  onClose,
}) => {
  const [form] = Form.useForm();
  const { configs, active, mutateAll, mutateActive } = useAIConfigs();
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [testing, setTesting] = useState(false);
  const [currentModelInfo, setCurrentModelInfo] = useState<ModelInfo | null>(null);
  const [availableModels, setAvailableModels] = useState<ModelInfo[]>([]);
  
  // Phase 3: 系统提示词状态
  const [systemPrompt, setSystemPrompt] = useState<string>('');
  const [isPromptModified, setIsPromptModified] = useState(false);
  
  // Phase 9: 语言设置状态（监听 i18n 变化）
  const [currentLanguage, setCurrentLanguage] = useState<string>(i18n.language);
  
  // 监听 i18n 语言变化，自动更新 Select 组件
  useEffect(() => {
    const handleLanguageChanged = () => {
      setCurrentLanguage(i18n.language);
    };
    
    i18n.on('languageChanged', handleLanguageChanged);
    return () => {
      i18n.off('languageChanged', handleLanguageChanged);
    };
  }, []);
  
  // Notification设置状态
  const [notificationEnabled, setNotificationEnabled] = useState(notificationManager.isEnabled());
  
  // 异步操作hooks
  const { prompt, mutate: mutatePrompt } = useSystemPrompt();
  const { execute: savePrompt, loading: savingPrompt } = useAsync(systemPromptCommands.set);
  const { execute: resetPrompt, loading: resettingPrompt } = useAsync(systemPromptCommands.reset);

  useEffect(() => {
    if (visible) {
      // SWR 自动加载
      setSystemPrompt(prompt || '');
      setIsPromptModified(false);
      // 计算当前 activeIndex
      if (active) {
        const idx = configs.findIndex(c => c.provider === active.provider && c.apiKey === active.apiKey);
        setActiveIndex(idx >= 0 ? idx : null);
      } else {
        setActiveIndex(null);
      }
    }
  }, [visible, prompt, active, configs]);
  
  // 加载由 SWR 负责

  const handleProviderChange = async (provider: ProviderType) => {
    const providerConfig = PROVIDER_CONFIGS.find(p => p.value === provider);
    if (providerConfig) {
      form.setFieldsValue({
        baseUrl: providerConfig.defaultUrl,
        model: providerConfig.defaultModel,
      });
    }
    
    // 加载该供应商的可用模型列表
    try {
      const models = await aiModelCommands.getProviderModels(provider);
      setAvailableModels(models);
      log.info('已加载模型列表', { provider, count: models.length });
      
      // 如果有推荐模型，自动选择
      const recommendedModel = models.find(m => m.recommended);
      if (recommendedModel && !form.getFieldValue('model')) {
        form.setFieldsValue({ model: recommendedModel.id });
        setCurrentModelInfo(recommendedModel);
      }
    } catch (error) {
      log.logError(error, '加载模型列表失败');
      setAvailableModels([]);
    }
  };

  const handleAddNew = async () => {
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
    
    // 自动加载 Moonshot 的模型列表
    try {
      const models = await aiModelCommands.getProviderModels(ProviderType.Moonshot);
      setAvailableModels(models);
      
      // 查找推荐模型
      const recommendedModel = models.find(m => m.recommended);
      if (recommendedModel) {
        setCurrentModelInfo(recommendedModel);
      }
    } catch (error) {
      log.logError(error, '加载默认模型列表失败');
      setAvailableModels([]);
    }
  };

  const handleEdit = async (index: number) => {
    const config = configs[index];
    setEditingIndex(index);
    setIsAddingNew(false);
    
    // 安全日志：不输出敏感信息
    log.info('编辑配置', { 
      index, 
      provider: config.provider,
      hasApiKey: !!config.apiKey,
      apiKeyLength: config.apiKey?.length || 0,
      baseUrl: config.baseUrl,
      model: config.model,
    });
    
    // 加载该供应商的模型列表
    try {
      const models = await aiModelCommands.getProviderModels(config.provider);
      setAvailableModels(models);
      
      // 如果有当前模型，加载其信息
      if (config.model) {
        const modelInfo = models.find(m => m.id === config.model);
        setCurrentModelInfo(modelInfo || null);
      }
    } catch (error) {
      log.logError(error, '加载模型列表失败');
      setAvailableModels([]);
    }
    
    // 直接使用用户保存的值，不填充默认值
    // 留空的字段在后端会自动使用默认值
    form.setFieldsValue({
      provider: config.provider,
      apiKey: config.apiKey || '',    // 确保显示实际值
      baseUrl: config.baseUrl || '',  // 用户保存的值，空就是空
      model: config.model || '',       // 用户保存的值，空就是空
      proxy: config.proxy || {
        enabled: false,
        host: '127.0.0.1',
        port: 7890,
      },
    });
    
    // 强制刷新表单显示
    setTimeout(() => {
      form.validateFields().catch(() => {});
    }, 100);
  };

  const handleSaveConfig = async () => {
    try {
      const values = await form.validateFields();
      const config: AIConfig = {
        provider: values.provider,
        // 留空表示不变，避免把密钥覆盖为空字符串
        apiKey: values.apiKey || undefined,
        baseUrl: values.baseUrl || undefined,
        model: values.model || undefined,
        proxy: values.proxy?.enabled ? {
          enabled: values.proxy.enabled,
          host: values.proxy.host,
          port: values.proxy.port,
        } : undefined,
      };

      if (isAddingNew) {
        await aiConfigCommands.add(config);
        message.success('添加配置成功');
        
        // 刷新配置列表
        await mutateAll();
        
        // 如果是第一个配置，自动设为启用
        const updatedConfigs = await aiConfigCommands.getAll();
        if (updatedConfigs.length === 1) {
          await aiConfigCommands.setActive('0');
          setActiveIndex(0);
          await mutateActive();
          message.success('已自动设为启用配置', 2);
        }
      } else if (editingIndex !== null) {
        await aiConfigCommands.update(editingIndex.toString(), config);
        message.success('更新配置成功');
        
        await mutateAll();
        await mutateActive();
      }
      
      setIsAddingNew(false);
      setEditingIndex(null);
      form.resetFields();
      log.info('配置保存成功', { provider: config.provider });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      log.error('保存配置失败', { error: errorMsg });
      message.error(`保存配置失败: ${errorMsg}`);
    }
  };


  const handleDelete = async (index: number) => {
    try {
      await aiConfigCommands.delete(index.toString());
      message.success('删除配置成功');
      
      // 重置编辑状态，防止索引超出范围
      if (editingIndex === index) {
        setEditingIndex(null);
        setIsAddingNew(false);
        form.resetFields();
      } else if (editingIndex !== null && editingIndex > index) {
        // 如果正在编辑的配置在被删除配置之后，索引需要减1
        setEditingIndex(editingIndex - 1);
      }
      
      await mutateAll();
      await mutateActive();
      log.info('配置删除成功', { index });
    } catch (error) {
      log.logError(error, '删除配置失败');
      message.error('删除配置失败');
    }
  };

  const handleSetActive = async (index: number) => {
    try {
      await aiConfigCommands.setActive(index.toString());
      setActiveIndex(index);
      message.success('设置启用配置成功');
      log.info('设置启用配置成功', { index });
      await mutateActive();
    } catch (error) {
      log.logError(error, '设置启用配置失败');
      message.error('设置启用配置失败');
    }
  };

  const handleTestConnection = async () => {
    try {
      setTesting(true);
      const values = await form.validateFields();
      
      // 只有在启用代理且配置完整时才传递 proxy
      const proxyConfig = values.proxy?.enabled && values.proxy?.host && values.proxy?.port
        ? {
            enabled: values.proxy.enabled,
            host: values.proxy.host,
            port: values.proxy.port,
          }
        : undefined;
      
      const result = await aiConfigCommands.testConnection(
        values.provider,
        values.apiKey,
        values.baseUrl || undefined,
        values.model || undefined,      // ✅ 传递 model
        proxyConfig                      // ✅ 传递完整的 proxy 或 undefined
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
      await mutatePrompt();
    } catch (error) {
      log.logError(error, '保存系统提示词失败');
    }
  };
  
  const handleResetPrompt = async () => {
    try {
      await resetPrompt();
      await mutatePrompt();
      setSystemPrompt(prompt || '');
      message.success('系统提示词已重置为默认值');
      log.info('系统提示词已重置');
    } catch (error) {
      log.logError(error, '重置系统提示词失败');
    }
  };

  // Phase 9: 语言切换处理（无刷新，响应式更新）
  const handleLanguageChange = async (language: string) => {
    try {
      // 1. 切换 i18n 语言（响应式，无需刷新）
      await i18n.changeLanguage(language);
      setCurrentLanguage(language);
      
      // 2. 保存到 TauriStore（通过 useAppStore）
      const { useAppStore } = await import('../store/useAppStore');
      useAppStore.getState().setLanguage(language as any);
      
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
                    activeIndex !== index ? (
                      <Button
                        key="active"
                        type="primary"
                        size="small"
                        onClick={() => handleSetActive(index)}
                      >
                        设为启用
                      </Button>
                    ) : (
                      <Tag key="active-tag" color="green" icon={<CheckOutlined />}>
                        启用中
                      </Tag>
                    ),
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
                      <span>{getProviderLabel(config.provider)}</span>
                    }
                    description={
                      <div style={{ fontSize: '12px', color: '#666' }}>
                        <div>模型: {config.model || '(未设置)'}</div>
                        {config.proxy?.enabled && (
                          <div>代理: {config.proxy.host}:{config.proxy.port}</div>
                        )}
                      </div>
                    }
                  />
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
                  extra={editingIndex !== null ? "已保存的密钥会以掩码形式显示，留空则保持原值不变" : null}
                >
                  <Input.Password 
                    placeholder="请输入 API 密钥"
                    autoComplete="off"
                    visibilityToggle
                  />
                </Form.Item>

                <Form.Item
                  label="API 基础 URL"
                  name="baseUrl"
                  tooltip="留空使用默认 URL"
                  extra={editingIndex !== null && !form.getFieldValue('baseUrl') ? "当前使用默认 URL" : null}
                >
                  <Input 
                    placeholder="https://api.example.com/v1"
                    autoComplete="off"
                  />
                </Form.Item>

                <Form.Item
                  label="模型"
                  name="model"
                  tooltip="选择预设模型或手动输入自定义模型"
                  rules={[{ required: true, message: '请选择或输入模型' }]}
                >
                  <Select
                    placeholder="选择预设模型或输入自定义"
                    showSearch
                    allowClear
                    optionFilterProp="children"
                    onChange={(value) => {
                      if (value) {
                        const modelInfo = availableModels.find(m => m.id === value);
                        setCurrentModelInfo(modelInfo || null);
                      } else {
                        setCurrentModelInfo(null);
                      }
                    }}
                    dropdownRender={(menu) => (
                      <>
                        {menu}
                        {availableModels.length === 0 && (
                          <div style={{ padding: '8px', color: '#999', textAlign: 'center' }}>
                            暂无预设模型，请手动输入
                          </div>
                        )}
                      </>
                    )}
                  >
                    {availableModels.map((model) => (
                      <Select.Option key={model.id} value={model.id}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span>
                            {model.name}
                            {model.recommended && <Tag color="blue" style={{ marginLeft: 8, fontSize: '10px' }}>推荐</Tag>}
                          </span>
                          <span style={{ fontSize: '11px', color: '#999' }}>
                            ${model.input_price.toFixed(2)}/${model.output_price.toFixed(2)}/1M
                          </span>
                        </div>
                      </Select.Option>
                    ))}
                  </Select>
                </Form.Item>

                {/* 模型信息显示 */}
                {currentModelInfo && (
                  <Alert
                    message={
                      <Space direction="vertical" size={4} style={{ width: '100%' }}>
                        <div style={{ fontWeight: 600 }}>{currentModelInfo.name}</div>
                        <Descriptions size="small" column={2} style={{ fontSize: '12px' }}>
                          <Descriptions.Item label="上下文">{(currentModelInfo.context_window / 1000).toFixed(0)}K</Descriptions.Item>
                          <Descriptions.Item label="输出">{(currentModelInfo.max_output_tokens / 1000).toFixed(0)}K</Descriptions.Item>
                          <Descriptions.Item label="输入价格">${currentModelInfo.input_price.toFixed(2)}/1M</Descriptions.Item>
                          <Descriptions.Item label="输出价格">${currentModelInfo.output_price.toFixed(2)}/1M</Descriptions.Item>
                        </Descriptions>
                        {currentModelInfo.supports_cache && currentModelInfo.cache_reads_price && (
                          <div style={{ fontSize: '12px', color: '#722ed1' }}>
                            💾 缓存价格: ${currentModelInfo.cache_reads_price.toFixed(2)}/1M 
                            (省 {Math.round(((currentModelInfo.input_price - currentModelInfo.cache_reads_price) / currentModelInfo.input_price) * 100)}%)
                          </div>
                        )}
                      </Space>
                    }
                    type="info"
                    icon={<InfoCircleOutlined />}
                    style={{ marginBottom: 16 }}
                  />
                )}

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
      key: 'appearance',
      label: (
        <span>
          <BgColorsOutlined /> 外观与语言
        </span>
      ),
      children: (
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          {/* Phase 9: 主题切换 */}
          <Card size="small" title="主题模式">
            <Space direction="vertical" style={{ width: '100%' }}>
              <ThemeModeSwitch />
              <Alert
                message="提示"
                description="选择'跟随系统'时，主题将自动适应您的系统设置"
                type="info"
                showIcon
                style={{ marginTop: 8 }}
              />
            </Space>
          </Card>
          
          {/* 语言设置 */}
          <Card size="small" title="界面语言">
            <Select
              value={currentLanguage}
              onChange={handleLanguageChange}
              style={{ width: 200 }}
            >
              <Select.Option value="zh-CN">简体中文</Select.Option>
              <Select.Option value="en-US">English</Select.Option>
            </Select>
          </Card>
        </Space>
      ),
    },
    {
      key: 'notification',
      label: (
        <span>
          <BellOutlined /> 通知设置
        </span>
      ),
      children: (
        <div>
          <Card size="small" title="桌面通知">
            <Space direction="vertical" style={{ width: '100%' }}>
              <Row align="middle" gutter={16}>
                <Col span={18}>
                  <div>
                    <div style={{ marginBottom: 8, fontWeight: 'bold' }}>启用桌面通知</div>
                    <div style={{ fontSize: '12px', color: '#666' }}>
                      接收批量翻译完成、错误提醒、文件保存等系统通知
                    </div>
                  </div>
                </Col>
                <Col span={6} style={{ textAlign: 'right' }}>
                  <Switch
                    checked={notificationEnabled}
                    onChange={(checked) => {
                      setNotificationEnabled(checked);
                      notificationManager.setEnabled(checked);
                      message.success(checked ? '通知已启用' : '通知已禁用');
                    }}
                  />
                </Col>
              </Row>
              
              <Divider style={{ margin: '16px 0' }} />
              
              <div style={{ fontSize: '12px', color: '#999' }}>
                <div style={{ marginBottom: 8 }}>通知类型：</div>
                <ul style={{ paddingLeft: 20, margin: 0 }}>
                  <li>✅ 批量翻译完成通知</li>
                  <li>❌ 翻译错误通知</li>
                  <li>💾 文件保存成功通知</li>
                  <li>📤 文件导出成功通知</li>
                </ul>
              </div>
              
              <Button
                type="primary"
                size="small"
                disabled={!notificationEnabled}
                onClick={async () => {
                  await notificationManager.info('测试通知', '这是一条测试通知消息');
                  message.success('测试通知已发送');
                }}
                style={{ marginTop: 16 }}
              >
                发送测试通知
              </Button>
            </Space>
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
      style={{ top: 20 }}
      styles={{ 
        body: {
          maxHeight: 'calc(100vh - 200px)',
          overflowY: 'auto' 
        }
      }}
      destroyOnHidden
      maskClosable={false}
    >
      <Tabs items={tabItems} defaultActiveKey="ai-config" />
    </Modal>
  );
};
