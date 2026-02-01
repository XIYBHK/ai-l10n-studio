import { useEffect, useState, useMemo } from 'react';
import {
  Form,
  Input,
  Select,
  Button,
  Card,
  Col,
  Tag,
  Popconfirm,
  message,
  Space,
  AutoComplete,
  Empty,
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  CheckOutlined,
  ApiOutlined,
} from '@ant-design/icons';
import { aiConfigCommands, aiModelCommands, aiProviderCommands } from '../../services/commands';
import { AIConfig } from '../../types/aiProvider';
import { createModuleLogger } from '../../utils/logger';
import { useAIConfigs } from '../../hooks/useConfig';
import type { ProviderInfo } from '../../types/generated/ProviderInfo';

const log = createModuleLogger('AIConfigTab');

type ProviderConfig = {
  value: string;
  label: string;
  defaultUrl?: string;
  defaultModel?: string;
};

function mapProviderInfoToConfig(provider: ProviderInfo): ProviderConfig {
  return {
    value: provider.id,
    label: provider.display_name,
    defaultUrl: provider.default_url,
    defaultModel: provider.default_model,
  };
}

interface AIConfigTabProps {
  onProviderChange?: (providerId: string) => void;
}

export function AIConfigTab({ onProviderChange }: AIConfigTabProps) {
  const [form] = Form.useForm();
  const { configs, active, mutateAll, mutateActive } = useAIConfigs();
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [testing, setTesting] = useState(false);
  const [deletingIndex, setDeletingIndex] = useState<number | null>(null);
  const [dynamicProviders, setDynamicProviders] = useState<ProviderInfo[]>([]);
  const [providersLoading, setProvidersLoading] = useState(false);
  const [availableModels, setAvailableModels] = useState<string[]>([]);

  const providerConfigs: ProviderConfig[] = useMemo(() => {
    return dynamicProviders.map(mapProviderInfoToConfig);
  }, [dynamicProviders]);

  useEffect(() => {
    setProvidersLoading(true);
    aiProviderCommands
      .getAll()
      .then((providers) => {
        log.debug('加载动态供应商成功:', providers);
        setDynamicProviders(providers);
      })
      .catch((err) => {
        log.error('加载动态供应商失败:', err);
      })
      .finally(() => {
        setProvidersLoading(false);
      });
  }, []);

  useEffect(() => {
    if (active) {
      const idx = configs.findIndex(
        (c) => c.providerId === active.providerId && c.apiKey === active.apiKey
      );
      setActiveIndex(idx >= 0 ? idx : null);
    } else {
      setActiveIndex(null);
    }
  }, [active, configs]);

  function getProviderLabel(providerId: string): string {
    const provider = providerConfigs.find((p) => p.value === providerId);
    return provider ? provider.label : providerId;
  }

  async function handleProviderChange(providerId: string) {
    const providerConfig = providerConfigs.find((p) => p.value === providerId);
    if (providerConfig) {
      form.setFieldsValue({
        baseUrl: providerConfig.defaultUrl,
        model: providerConfig.defaultModel,
      });
    }

    // 加载该供应商的所有模型
    try {
      const models = await aiModelCommands.getProviderModels(providerId);
      const modelIds = models.map((m) => m.id);
      setAvailableModels(modelIds);
      log.info('已加载模型列表', { providerId, count: modelIds.length });

      // 触发回调
      onProviderChange?.(providerId);
    } catch (error) {
      log.error('加载模型列表失败:', error);
      setAvailableModels([]);
    }
  }

  async function handleTestConnection(values: any) {
    setTesting(true);
    try {
      const testConfig: AIConfig = {
        providerId: values.providerId,
        apiKey: values.apiKey,
        baseUrl: values.baseUrl || undefined,
        model: values.model,
        proxy: values.proxy?.enabled
          ? {
              enabled: true,
              host: values.proxy.host,
              port: values.proxy.port,
            }
          : null,
      };
      await aiConfigCommands.testConnection(
        testConfig.providerId,
        testConfig.apiKey,
        testConfig.baseUrl || undefined
      );
      message.success('连接测试成功！');
      log.info('连接测试成功', { providerId: values.providerId });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '测试失败';
      message.error(errorMsg);
      log.error('测试连接异常', { error });
    } finally {
      setTesting(false);
    }
  }

  function handleAddNew() {
    setIsAddingNew(true);
    setEditingIndex(null);
    form.resetFields();
  }

  function handleEdit(index: number) {
    log.info('编辑配置', { index, total: configs.length });
    const config = configs[index];
    log.info('配置数据', { config });
    setEditingIndex(index);
    setIsAddingNew(false);
    form.setFieldsValue({
      ...config,
      proxy: config.proxy || { enabled: false, host: '', port: '' },
    });
  }

  async function handleDelete(index: number) {
    setDeletingIndex(index);
    log.info('[删除] 开始删除配置', { index, total: configs.length });
    try {
      log.info('[删除] 调用删除命令');
      await aiConfigCommands.delete(String(index));
      log.info('[删除] 命令执行成功');
      message.success('配置已删除');
      mutateAll();
      mutateActive();
      log.info('[删除] 配置删除成功', { index });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '删除失败';
      message.error(`删除配置失败: ${errorMsg}`);
      log.error('[删除] 删除配置失败', { error, index, total: configs.length });
    } finally {
      setDeletingIndex(null);
      log.info('[删除] 清除删除状态');
    }
  }

  async function handleSetActive(index: number) {
    try {
      log.info('设置启用配置', { index, total: configs.length });
      await aiConfigCommands.setActive(String(index));
      message.success('配置已启用');
      mutateActive();
      log.info('设置启用配置成功', { index });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '启用失败';
      message.error(`启用配置失败: ${errorMsg}`);
      log.error('启用配置失败', { error, index, total: configs.length });
    }
  }

  async function handleSave(values: any) {
    try {
      // 确保空字符串转换为 null
      const config: AIConfig = {
        providerId: values.providerId,
        apiKey: values.apiKey,
        baseUrl: values.baseUrl?.trim() || null,
        model: values.model?.trim() || null,
        proxy: values.proxy?.enabled
          ? {
              enabled: true,
              host: values.proxy.host,
              port: values.proxy.port,
            }
          : null,
      };

      log.info('保存配置', { isAddingNew, editingIndex, providerId: config.providerId });

      if (isAddingNew) {
        await aiConfigCommands.add(config);
        message.success('配置已添加');
      } else if (editingIndex !== null) {
        await aiConfigCommands.update(editingIndex, config);
        message.success('配置已更新');
      }

      setIsAddingNew(false);
      setEditingIndex(null);
      form.resetFields();
      mutateAll();
      mutateActive();
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '保存失败';
      message.error(errorMsg);
      log.error('保存配置失败', { error, values });
    }
  }

  function handleCancel() {
    setIsAddingNew(false);
    setEditingIndex(null);
    form.resetFields();
  }

  return (
    <Col span={24}>
      <Card
        title={
          <span>
            <ApiOutlined /> AI 配置
          </span>
        }
        size="small"
      >
        {configs.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description='暂无配置，请点击"新增"添加配置'
            style={{ padding: '20px 0' }}
          />
        ) : (
          <Space direction="vertical" style={{ width: '100%' }} size="small">
            {configs.map((config, index) => (
              <Card
                key={`config-${index}-${config.providerId}`}
                size="small"
                styles={{
                  body: { padding: '12px 16px' }
                }}
                style={{ border: '1px solid var(--ant-color-border-secondary)' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 500, marginBottom: 4 }}>
                      {getProviderLabel(config.providerId)}
                    </div>
                    <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--ant-color-text-secondary)' }}>
                      <div>模型: {config.model || '(未设置)'}</div>
                      {config.proxy?.enabled && (
                        <div>
                          代理: {config.proxy.host}:{config.proxy.port}
                        </div>
                      )}
                    </div>
                  </div>
                  <Space size="small" wrap>
                    {activeIndex !== index ? (
                      <Button
                        size="small"
                        type="primary"
                        onClick={() => handleSetActive(index)}
                      >
                        设为启用
                      </Button>
                    ) : (
                      <Tag color="green" icon={<CheckOutlined />}>
                        启用中
                      </Tag>
                    )}
                    <Button
                      size="small"
                      type="link"
                      icon={<EditOutlined />}
                      onClick={() => handleEdit(index)}
                      title="编辑"
                    />
                    <Popconfirm
                      title="确认删除此配置？"
                      onConfirm={() => handleDelete(index)}
                      okText="确认"
                      cancelText="取消"
                      okButtonProps={{ loading: deletingIndex === index }}
                    >
                      <Button
                        size="small"
                        type="link"
                        danger
                        icon={<DeleteOutlined />}
                        title="删除"
                        loading={deletingIndex === index}
                        disabled={deletingIndex !== null && deletingIndex !== index}
                      />
                    </Popconfirm>
                  </Space>
                </div>
              </Card>
            ))}
          </Space>
        )}
      </Card>

      {isAddingNew || editingIndex !== null ? (
        <Card
          title={isAddingNew ? '新增配置' : '编辑配置'}
          size="small"
          style={{ marginTop: 16 }}
          extra={
            <Button onClick={handleCancel} size="small">
              取消
            </Button>
          }
        >
          <Form form={form} layout="vertical" size="small" onFinish={handleSave}>
            <Form.Item
              label="服务提供商"
              name="providerId"
              rules={[{ required: true, message: '请选择服务提供商' }]}
            >
              <Select onChange={handleProviderChange} loading={providersLoading}>
                {providerConfigs.map((p) => (
                  <Select.Option key={p.value} value={p.value}>
                    {p.label}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item
              label="API Key"
              name="apiKey"
              rules={[{ required: true, message: '请输入 API Key' }]}
            >
              <Input.Password placeholder="请输入 API Key" />
            </Form.Item>

            <Form.Item label="基础 URL" name="baseUrl">
              <Input placeholder="可选，留空则使用默认值" />
            </Form.Item>

            <Form.Item
              label="模型"
              name="model"
              rules={[{ required: true, message: '请输入或选择模型' }]}
              extra={
                availableModels.length > 0
                  ? `该供应商支持 ${availableModels.length} 个模型，可从下拉列表选择或手动输入`
                  : '请输入模型名称'
              }
            >
              <AutoComplete
                placeholder={
                  availableModels.length > 0
                    ? '从列表选择或手动输入模型名称'
                    : '例如：gpt-3.5-turbo'
                }
                options={availableModels.map((model) => ({ value: model, label: model }))}
                filterOption={(inputValue, option) =>
                  option?.value.toLowerCase().includes(inputValue.toLowerCase()) ?? false
                }
                allowClear
              />
            </Form.Item>

            <Form.Item>
              <Space>
                <Button type="primary" htmlType="submit" loading={testing} icon={<CheckOutlined />}>
                  {isAddingNew ? '添加' : '更新'}
                </Button>
                <Button onClick={handleCancel}>取消</Button>
                <Button
                  onClick={() => form.validateFields().then(handleTestConnection)}
                  loading={testing}
                >
                  测试连接
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Card>
      ) : (
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={handleAddNew}
          style={{ marginTop: 16 }}
        >
          新增配置
        </Button>
      )}
    </Col>
  );
}

export default AIConfigTab;
