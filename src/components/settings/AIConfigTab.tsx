import React, { useState, useEffect, useMemo } from 'react';
import {
  Form,
  Input,
  Select,
  Button,
  List,
  Card,
  Col,
  Tag,
  Popconfirm,
  message,
  Space,
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

const mapProviderInfoToConfig = (provider: ProviderInfo): ProviderConfig => ({
  value: provider.id,
  label: provider.display_name,
  defaultUrl: provider.default_url,
  defaultModel: provider.default_model,
});

interface AIConfigTabProps {}

export const AIConfigTab: React.FC<AIConfigTabProps> = () => {
  const [form] = Form.useForm();
  const { configs, active, mutateAll, mutateActive } = useAIConfigs();
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [testing, setTesting] = useState(false);
  const [dynamicProviders, setDynamicProviders] = useState<ProviderInfo[]>([]);
  const [providersLoading, setProvidersLoading] = useState(false);

  const providerConfigs: ProviderConfig[] = useMemo(() => {
    return dynamicProviders.map(mapProviderInfoToConfig);
  }, [dynamicProviders]);

  // 加载动态供应商列表
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

  // 计算当前 activeIndex
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

  const getProviderLabel = (providerId: string): string => {
    const provider = providerConfigs.find((p) => p.value === providerId);
    return provider ? provider.label : providerId;
  };

  const handleProviderChange = async (providerId: string) => {
    const providerConfig = providerConfigs.find((p) => p.value === providerId);
    if (providerConfig) {
      form.setFieldsValue({
        baseUrl: providerConfig.defaultUrl,
        model: providerConfig.defaultModel,
      });
    }

    try {
      const models = await aiModelCommands.getProviderModels(providerId);
      log.info('已加载模型列表', { providerId, count: models.length });
    } catch (error) {
      log.error('加载模型列表失败:', error);
    }
  };

  const handleTestConnection = async (values: any) => {
    setTesting(true);
    try {
      const testConfig: AIConfig = {
        providerId: values.providerId,
        apiKey: values.apiKey,
        baseUrl: values.baseUrl,
        model: values.model,
        proxy: values.proxy?.enabled
          ? {
              enabled: true,
              host: values.proxy.host,
              port: values.proxy.port,
            }
          : undefined,
      };
      await aiConfigCommands.testConnection(
        testConfig.providerId,
        testConfig.apiKey,
        testConfig.baseUrl
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
  };

  const handleAddNew = () => {
    setIsAddingNew(true);
    setEditingIndex(null);
    form.resetFields();
  };

  const handleEdit = (index: number) => {
    const config = configs[index];
    setEditingIndex(index);
    setIsAddingNew(false);
    form.setFieldsValue(config);
  };

  const handleDelete = async (index: number) => {
    try {
      await aiConfigCommands.delete(String(index));
      message.success('配置已删除');
      mutateAll();
      mutateActive();
      log.info('删除配置', { index });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '删除失败';
      message.error(errorMsg);
      log.error('删除配置失败', { error });
    }
  };

  const handleSetActive = async (index: number) => {
    try {
      await aiConfigCommands.setActive(String(index));
      message.success('配置已启用');
      mutateActive();
      log.info('设置启用配置', { index });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '启用失败';
      message.error(errorMsg);
      log.error('启用配置失败', { error });
    }
  };

  const handleSave = async (values: any) => {
    try {
      const config: AIConfig = {
        providerId: values.providerId,
        apiKey: values.apiKey,
        baseUrl: values.baseUrl,
        model: values.model,
        proxy: values.proxy?.enabled
          ? {
              enabled: true,
              host: values.proxy.host,
              port: values.proxy.port,
            }
          : undefined,
      };

      if (isAddingNew) {
        await aiConfigCommands.add(config);
        message.success('配置已添加');
      } else if (editingIndex !== null) {
        await aiConfigCommands.update(String(editingIndex), config);
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
      log.error('保存配置失败', { error });
    }
  };

  const handleCancel = () => {
    setIsAddingNew(false);
    setEditingIndex(null);
    form.resetFields();
  };

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
                  <Button type="link" danger icon={<DeleteOutlined />} size="small" />
                </Popconfirm>,
              ]}
            >
              <List.Item.Meta
                title={<span>{getProviderLabel(config.providerId)}</span>}
                description={
                  <div style={{ fontSize: '12px', color: '#666' }}>
                    <div>模型: {config.model || '(未设置)'}</div>
                    {config.proxy?.enabled && (
                      <div>
                        代理: {config.proxy.host}:{config.proxy.port}
                      </div>
                    )}
                  </div>
                }
              />
            </List.Item>
          )}
        />
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

            <Form.Item label="模型" name="model">
              <Input placeholder="例如：gpt-3.5-turbo" />
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
};

export default AIConfigTab;
