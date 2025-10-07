import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, Switch, Select, InputNumber, message } from 'antd';
import { configApi } from '../services/api';
import { createModuleLogger } from '../utils/logger';

const log = createModuleLogger('SettingsModal');

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (config: any) => void;
}

interface AppConfig {
  api_key: string;
  provider: string;
  model: string;
  base_url: string | null;
  use_translation_memory: boolean;
  translation_memory_path: string | null;
  log_level: string;
  auto_save: boolean;
  batch_size: number;
  max_concurrent: number;
  timeout_seconds: number;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  visible,
  onClose,
  onSave,
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [providers, setProviders] = useState<any[]>([]);
  const [selectedProvider, setSelectedProvider] = useState('moonshot');

  useEffect(() => {
    if (visible) {
      loadConfig();
      loadProviders();
    }
  }, [visible]);

  const loadConfig = async () => {
    try {
      const config = await configApi.get() as AppConfig;
      form.setFieldsValue(config);
      setSelectedProvider(config.provider);
      log.info('配置加载成功', { provider: config.provider });
    } catch (error) {
      log.logError(error, '加载配置失败');
    }
  };

  const loadProviders = async () => {
    try {
      const providerList = await configApi.getProviders() as any[];
      setProviders(providerList);
      log.info('服务商列表加载成功', { count: providerList.length });
    } catch (error) {
      log.logError(error, '加载服务商列表失败');
    }
  };

  const handleProviderChange = (value: string) => {
    setSelectedProvider(value);
    const provider = providers.find(p => p.name === value);
    if (provider) {
      form.setFieldsValue({
        base_url: provider.base_url,
        model: provider.models[0],
      });
    }
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      const values = await form.validateFields();
      
      // 验证配置
      await configApi.validate(values);
      
      // 保存配置
      await configApi.update(values);
      
      message.success('设置保存成功');
      log.info('配置保存成功', { provider: values.provider, model: values.model });
      onSave(values);
      onClose();
    } catch (error: any) {
      log.logError(error, '保存配置失败');
      message.error(error?.message || '保存设置失败');
    } finally {
      setLoading(false);
    }
  };

  const currentProvider = providers.find(p => p.name === selectedProvider);

  return (
    <Modal
      title="设置"
      open={visible}
      onOk={handleSave}
      onCancel={onClose}
      confirmLoading={loading}
      width={600}
      okText="保存"
      cancelText="取消"
      destroyOnClose={true}
      mask={false}
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          provider: 'moonshot',
          model: 'moonshot-v1-auto',
          base_url: 'https://api.moonshot.cn/v1',
          use_translation_memory: true,
          translation_memory_path: 'data/translation_memory.json',
          log_level: 'info',
          auto_save: true,
          batch_size: 10,
          max_concurrent: 3,
          timeout_seconds: 30,
        }}
      >
        <Form.Item
          label="API 密钥"
          name="api_key"
          rules={[{ required: true, message: '请输入 API 密钥' }]}
        >
          <Input.Password placeholder="请输入 API 密钥" />
        </Form.Item>

        <Form.Item
          label="服务提供商"
          name="provider"
          rules={[{ required: true, message: '请选择服务提供商' }]}
        >
          <Select onChange={handleProviderChange}>
            {providers.map(p => (
              <Select.Option key={p.name} value={p.name}>
                {p.display_name}
              </Select.Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item
          label="模型"
          name="model"
          rules={[{ required: true, message: '请选择模型' }]}
        >
          <Select>
            {currentProvider?.models.map((model: string) => (
              <Select.Option key={model} value={model}>
                {model}
              </Select.Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item
          label="API 基础 URL"
          name="base_url"
        >
          <Input placeholder="https://api.moonshot.cn/v1" />
        </Form.Item>

        <Form.Item
          label="批量大小"
          name="batch_size"
          tooltip="每批次翻译的条目数量"
        >
          <InputNumber min={1} max={50} style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item
          label="最大并发数"
          name="max_concurrent"
          tooltip="同时进行的翻译任务数"
        >
          <InputNumber min={1} max={10} style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item
          label="超时时间（秒）"
          name="timeout_seconds"
          tooltip="API 请求超时时间"
        >
          <InputNumber min={5} max={300} style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item
          label="使用翻译记忆库"
          name="use_translation_memory"
          valuePropName="checked"
        >
          <Switch />
        </Form.Item>

        <Form.Item
          label="翻译记忆库路径"
          name="translation_memory_path"
        >
          <Input placeholder="data/translation_memory.json" />
        </Form.Item>

        <Form.Item
          label="自动保存"
          name="auto_save"
          valuePropName="checked"
        >
          <Switch />
        </Form.Item>

        <Form.Item
          label="日志级别"
          name="log_level"
        >
          <Select>
            <Select.Option value="error">Error</Select.Option>
            <Select.Option value="warn">Warn</Select.Option>
            <Select.Option value="info">Info</Select.Option>
            <Select.Option value="debug">Debug</Select.Option>
          </Select>
        </Form.Item>
      </Form>
    </Modal>
  );
};

