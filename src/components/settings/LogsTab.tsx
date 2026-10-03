import { useEffect, useState } from 'react';
import { Card, Form, Select, InputNumber, Button, message } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { configCommands } from '../../services/configCommands';
import { createModuleLogger } from '../../utils/logger';
import { CSS_COLORS } from '../../hooks/useCssColors';

const log = createModuleLogger('LogsTab');

export function LogsTab() {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    configCommands
      .get()
      .then((config) => {
        form.setFieldsValue({
          log_level: config.logLevel || 'info',
          log_retention_days: config.logRetentionDays ?? 7,
          log_max_size: config.logMaxSize ?? 128,
          log_max_count: config.logMaxCount ?? 8,
        });
        log.debug('日志配置已加载', config);
      })
      .catch((err) => {
        log.error('加载日志配置失败:', err);
        form.setFieldsValue({
          log_level: 'info',
          log_retention_days: 7,
          log_max_size: 128,
          log_max_count: 8,
        });
      });
  }, [form]);

  async function handleSave(values: {
    log_level: string;
    log_retention_days: number;
    log_max_size: number;
    log_max_count: number;
  }) {
    setLoading(true);
    try {
      await configCommands.update({
        logLevel: values.log_level,
        logRetentionDays: values.log_retention_days,
        logMaxSize: values.log_max_size,
        logMaxCount: values.log_max_count,
      });
      message.success(t('messages.logSettingsSaved'));
      log.info('日志设置已保存', values);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : t('settings.saveFailed');
      message.error(errorMsg);
      log.error('保存日志设置失败', { error });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card
      title={
        <span>
          <InfoCircleOutlined /> {t('settings.tabs.logs')}
        </span>
      }
      size="small"
    >
      <p
        style={{
          marginBottom: 'var(--space-4)',
          color: CSS_COLORS.textSecondary,
          fontSize: 'var(--font-size-base)',
        }}
      >
        {t('settings.logs.description')}
      </p>

      <Form form={form} layout="vertical" onFinish={handleSave}>
        <Form.Item
          label={t('settings.logs.level')}
          name="log_level"
          tooltip={t('settings.logs.levelHelp')}
        >
          <Select>
            <Select.Option value="debug">{t('settings.logs.debug')}</Select.Option>
            <Select.Option value="info">{t('settings.logs.info')}</Select.Option>
            <Select.Option value="warn">{t('settings.logs.warn')}</Select.Option>
            <Select.Option value="error">{t('settings.logs.error')}</Select.Option>
          </Select>
        </Form.Item>

        <Form.Item
          label={t('settings.logs.retention')}
          name="log_retention_days"
          tooltip={t('settings.logs.retentionHelp')}
        >
          <InputNumber min={0} max={365} style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item
          label={t('settings.logs.size')}
          name="log_max_size"
          tooltip={t('settings.logs.sizeHelp')}
        >
          <InputNumber min={64} max={1024} style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item
          label={t('settings.logs.count')}
          name="log_max_count"
          tooltip={t('settings.logs.countHelp')}
        >
          <InputNumber min={1} max={50} style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item>
          <Button type="primary" htmlType="submit" loading={loading}>
            {t('common.save')}
          </Button>
        </Form.Item>
      </Form>
    </Card>
  );
}

export default LogsTab;
