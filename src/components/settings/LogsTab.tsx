import { useCallback, useEffect, useRef, useState } from 'react';
import { Card, Form, Select, InputNumber, Button, Alert, App } from 'antd';
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
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const { message } = App.useApp();
  const loadGeneration = useRef(0);

  const loadConfig = useCallback(() => {
    const generation = ++loadGeneration.current;
    setLoadError(false);
    setLoaded(false);
    configCommands
      .get()
      .then((config) => {
        if (generation !== loadGeneration.current) return;
        form.setFieldsValue({
          log_level: config.logLevel || 'info',
          log_retention_days: config.logRetentionDays ?? 7,
          log_max_size: config.logMaxSize ?? 128,
          log_max_count: config.logMaxCount ?? 8,
        });
        setLoaded(true);
        log.debug('日志配置已加载', config);
      })
      .catch((err) => {
        log.error('加载日志配置失败:', err);
        if (generation === loadGeneration.current) setLoadError(true);
      });
  }, [form]);

  useEffect(() => {
    loadConfig();
    return () => {
      ++loadGeneration.current;
    };
  }, [loadConfig]);

  async function handleSave(values: {
    log_level: string;
    log_retention_days: number;
    log_max_size: number;
    log_max_count: number;
  }) {
    if (!loaded) return;
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
      {loadError && (
        <Alert
          type="error"
          showIcon
          title={t('settings.logs.loadFailed')}
          action={
            <Button size="small" onClick={loadConfig}>
              {t('common.retry')}
            </Button>
          }
          style={{ marginBottom: 'var(--space-4)' }}
        />
      )}

      <Form form={form} layout="vertical" onFinish={handleSave} disabled={!loaded}>
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
          <Button type="primary" htmlType="submit" loading={loading} disabled={!loaded}>
            {t('common.save')}
          </Button>
        </Form.Item>
      </Form>
    </Card>
  );
}

export default LogsTab;
