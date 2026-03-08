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
import { aiConfigCommands, aiModelCommands, aiProviderCommands } from '../../services/aiCommands';
import type { AIConfig } from '../../types/aiProvider';
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
  const isEditingExisting = editingIndex !== null && !isAddingNew;

  useEffect(() => {
    setProvidersLoading(true);
    aiProviderCommands
      .getAll()
      .then((providers) => {
        log.debug('鍔犺浇鍔ㄦ€佷緵搴斿晢鎴愬姛:', providers);
        setDynamicProviders(providers);
      })
      .catch((err) => {
        log.error('鍔犺浇鍔ㄦ€佷緵搴斿晢澶辫触:', err);
      })
      .finally(() => {
        setProvidersLoading(false);
      });
  }, []);

  useEffect(() => {
    if (active) {
      const idx = configs.findIndex((config) => config.index === active.index);
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

    // 鍔犺浇璇ヤ緵搴斿晢鐨勬墍鏈夋ā锟?
    try {
      const models = await aiModelCommands.getProviderModels(providerId);
      const modelIds = models.map((m) => m.id);
      setAvailableModels(modelIds);
      log.info('锟窖硷拷锟斤拷模锟斤拷锟叫憋拷', { providerId, count: modelIds.length });

      // 瑙﹀彂鍥炶皟
      onProviderChange?.(providerId);
    } catch (error) {
      log.error('鍔犺浇妯″瀷鍒楄〃澶辫触:', error);
      setAvailableModels([]);
    }
  }

  async function handleTestConnection(values: any) {
    const apiKey = values.apiKey?.trim();
    if (!apiKey) {
      message.warning('娴嬭瘯杩炴帴鍓嶈閲嶆柊杈撳叆 API Key');
      return;
    }

    setTesting(true);
    try {
      const testConfig: AIConfig = {
        providerId: values.providerId,
        apiKey,
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
      message.success('锟斤拷锟接诧拷锟皆成癸拷');
      log.info('杩炴帴娴嬭瘯鎴愬姛', { providerId: values.providerId });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '娴嬭瘯澶辫触';
      message.error(errorMsg);
      log.error('娴嬭瘯杩炴帴寮傚父', { error });
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
    log.info('缂栬緫閰嶇疆', { index, total: configs.length });
    const config = configs[index];
    log.info('閰嶇疆鏁版嵁', { config });
    setEditingIndex(index);
    setIsAddingNew(false);
    form.setFieldsValue({
      providerId: config.providerId,
      baseUrl: config.baseUrl,
      model: config.model,
      apiKey: '',
      proxy: config.proxy || { enabled: false, host: '', port: '' },
    });
  }

  async function handleDelete(index: number) {
    setDeletingIndex(index);
    log.info('[删锟斤拷] 锟斤拷始删锟斤拷锟斤拷锟斤拷', { index, total: configs.length });
    try {
      log.info('[鍒犻櫎] 璋冪敤鍒犻櫎鍛戒护');
      await aiConfigCommands.delete(String(index));
      log.info('[鍒犻櫎] 鍛戒护鎵ц鎴愬姛');
      message.success('锟斤拷锟斤拷锟斤拷删锟斤拷');
      mutateAll();
      mutateActive();
      log.info('[鍒犻櫎] 閰嶇疆鍒犻櫎鎴愬姛', { index });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '鍒犻櫎澶辫触';
      message.error(`鍒犻櫎閰嶇疆澶辫触: ${errorMsg}`);
      log.error('[鍒犻櫎] 鍒犻櫎閰嶇疆澶辫触', { error, index, total: configs.length });
    } finally {
      setDeletingIndex(null);
      log.info('[delete] cleared deleting state');
    }
  }

  async function handleSetActive(index: number) {
    try {
      log.info('璁剧疆鍚敤閰嶇疆', { index, total: configs.length });
      await aiConfigCommands.setActive(String(index));
      message.success('锟斤拷锟斤拷锟斤拷锟斤拷锟斤拷');
      mutateActive();
      log.info('璁剧疆鍚敤閰嶇疆鎴愬姛', { index });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '鍚敤澶辫触';
      message.error(`鍚敤閰嶇疆澶辫触: ${errorMsg}`);
      log.error('鍚敤閰嶇疆澶辫触', { error, index, total: configs.length });
    }
  }

  async function handleSave(values: any) {
    try {
      const apiKey = values.apiKey?.trim() ?? '';
      if (isAddingNew && !apiKey) {
        message.error('锟斤拷锟斤拷锟斤拷 API Key');
        return;
      }

      // 纭繚绌哄瓧绗︿覆杞崲锟?null
      const config: AIConfig = {
        providerId: values.providerId,
        apiKey,
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

      log.info('淇濆瓨閰嶇疆', { isAddingNew, editingIndex, providerId: config.providerId });

      if (isAddingNew) {
        await aiConfigCommands.add(config);
        message.success('锟斤拷锟斤拷锟斤拷锟斤拷锟斤拷');
      } else if (editingIndex !== null) {
        await aiConfigCommands.update(editingIndex, config);
        message.success('锟斤拷锟斤拷锟窖革拷锟斤拷');
      }

      setIsAddingNew(false);
      setEditingIndex(null);
      form.resetFields();
      mutateAll();
      mutateActive();
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '淇濆瓨澶辫触';
      message.error(errorMsg);
      log.error('淇濆瓨閰嶇疆澶辫触', { error, values });
    }
  }

  function handleCancel() {
    setIsAddingNew(false);
    setEditingIndex(null);
    form.resetFields();
  }

  return (
    <Col span={24} data-testid="ai-config-tab">
      <Card
        title={
          <span>
            <ApiOutlined /> AI 閰嶇疆
          </span>
        }
        size="small"
      >
        {configs.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description='鏆傛棤閰嶇疆锛岃鐐瑰嚮"鏂板"娣诲姞閰嶇疆'
            style={{ padding: '20px 0' }}
          />
        ) : (
          <Space direction="vertical" style={{ width: '100%' }} size="small">
            {configs.map((config, index) => (
              <Card
                key={`config-${index}-${config.providerId}`}
                size="small"
                styles={{
                  body: { padding: '12px 16px' },
                }}
                style={{ border: '1px solid var(--ant-color-border-secondary)' }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 12,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 500, marginBottom: 4 }}>
                      {getProviderLabel(config.providerId)}
                    </div>
                    <div
                      style={{
                        fontSize: 'var(--font-size-sm)',
                        color: 'var(--ant-color-text-secondary)',
                      }}
                    >
                      <div>妯″瀷: {config.model || '(鏈锟?'}</div>
                      <div>瀵嗛挜: {config.apiKeyPreview || '(鏈锟?'}</div>
                      {config.proxy?.enabled && (
                        <div>
                          浠ｇ悊: {config.proxy.host}:{config.proxy.port}
                        </div>
                      )}
                    </div>
                  </div>
                  <Space size="small" wrap>
                    {activeIndex !== index ? (
                      <Button size="small" type="primary" onClick={() => handleSetActive(index)}>
                        璁句负鍚敤
                      </Button>
                    ) : (
                      <Tag color="green" icon={<CheckOutlined />}>
                        鍚敤锟?
                      </Tag>
                    )}
                    <Button
                      size="small"
                      type="link"
                      icon={<EditOutlined />}
                      onClick={() => handleEdit(index)}
                      title="缂栬緫"
                    />
                    <Popconfirm
                      title="纭鍒犻櫎姝ら厤缃紵"
                      onConfirm={() => handleDelete(index)}
                      okText="纭"
                      cancelText="鍙栨秷"
                      okButtonProps={{ loading: deletingIndex === index }}
                    >
                      <Button
                        size="small"
                        type="link"
                        danger
                        icon={<DeleteOutlined />}
                        title="鍒犻櫎"
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
          title={isAddingNew ? '鏂板閰嶇疆' : '缂栬緫閰嶇疆'}
          size="small"
          style={{ marginTop: 16 }}
          extra={
            <Button onClick={handleCancel} size="small">
              鍙栨秷
            </Button>
          }
        >
          <Form form={form} layout="vertical" size="small" onFinish={handleSave}>
            <Form.Item
              label="Provider"
              name="providerId"
              rules={[{ required: true, message: 'Please select a provider' }]}
            >
              <Select
                data-testid="ai-config-provider"
                onChange={handleProviderChange}
                loading={providersLoading}
              >
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
              rules={
                isEditingExisting
                  ? []
                  : [{ required: true, whitespace: true, message: 'Please enter an API Key' }]
              }
              extra={
                isEditingExisting
                  ? 'Leave blank to keep the current key; re-enter it before testing.'
                  : undefined
              }
            >
              <Input.Password
                data-testid="ai-config-api-key"
                placeholder={
                  isEditingExisting
                    ? 'Leave blank to keep the current key'
                    : 'Please enter an API Key'
                }
              />
            </Form.Item>

            <Form.Item label="Base URL" name="baseUrl">
              <Input placeholder="Optional, uses the provider default when empty" />
            </Form.Item>

            <Form.Item
              label="Model"
              name="model"
              rules={[{ required: true, message: 'Please enter or select a model' }]}
              extra={
                availableModels.length > 0
                  ? `This provider exposes ${availableModels.length} models; choose one or type manually`
                  : 'Please enter a model name'
              }
            >
              <AutoComplete
                data-testid="ai-config-model"
                placeholder={
                  availableModels.length > 0
                    ? 'Select from the list or type a model name'
                    : 'e.g. gpt-3.5-turbo'
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
                  {isAddingNew ? '娣诲姞' : '鏇存柊'}
                </Button>
                <Button onClick={handleCancel}>鍙栨秷</Button>
                <Button
                  data-testid="ai-config-test-connection"
                  onClick={() => form.validateFields().then(handleTestConnection)}
                  loading={testing}
                >
                  娴嬭瘯杩炴帴
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Card>
      ) : (
        <Button
          data-testid="ai-config-add-button"
          type="primary"
          icon={<PlusOutlined />}
          onClick={handleAddNew}
          style={{ marginTop: 16 }}
        >
          鏂板閰嶇疆
        </Button>
      )}
    </Col>
  );
}

export default AIConfigTab;
