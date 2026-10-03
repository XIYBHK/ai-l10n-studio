import { useState } from 'react';
import { Button, Card, Form, Input, Space, message } from 'antd';
import { useTranslation } from 'react-i18next';
import { MODEL_PRESETS, createPresetProfile } from '../../config/modelPresets';
import { modelConfigurationCommands } from '../../services/aiCommands';
import type { ModelProviderProfile, ModelProviderSummary } from '../../types/aiProvider';
import { createModuleLogger } from '../../utils/logger';
import styles from './AIConfigTab.module.css';

const log = createModuleLogger('QuickProviderSetup');

interface Props {
  providers: ModelProviderSummary[];
  disabled: boolean;
  onBusyChange: (busy: boolean) => void;
  onSaved: () => Promise<unknown>;
  onAdvanced: (profile: ModelProviderProfile, apiKey: string) => void;
}

export function QuickProviderSetup({
  providers,
  disabled,
  onBusyChange,
  onSaved,
  onAdvanced,
}: Props) {
  const { t } = useTranslation();
  const [selectedId, setSelectedId] = useState<string>();
  const [form] = Form.useForm<{ apiKey: string }>();
  const preset = MODEL_PRESETS.find(({ id }) => id === selectedId);

  const save = async ({ apiKey }: { apiKey: string }) => {
    if (!preset) return;
    onBusyChange(true);
    try {
      const profile = createPresetProfile(preset, t(preset.labelKey), providers);
      await modelConfigurationCommands.saveProvider(profile, apiKey.trim(), preset.modelId);
      await onSaved();
      form.resetFields();
      setSelectedId(undefined);
      message.success(t('modelSettings.quick.saved'));
    } catch (cause) {
      log.error('quick provider setup failed', cause);
    } finally {
      onBusyChange(false);
    }
  };

  return (
    <Card size="small" title={t('modelSettings.quick.title')}>
      <p className={styles.quickDescription}>{t('modelSettings.quick.description')}</p>
      <div className={styles.presetGrid}>
        {MODEL_PRESETS.map((item) => (
          <Button
            key={item.id}
            className={styles.presetButton}
            type={selectedId === item.id ? 'primary' : 'default'}
            aria-pressed={selectedId === item.id}
            disabled={disabled}
            onClick={() => {
              form.resetFields();
              setSelectedId(item.id);
            }}
          >
            <span>{t(item.labelKey)}</span>
            <span className={styles.presetModel}>{item.modelId}</span>
          </Button>
        ))}
      </div>
      {preset && (
        <Form form={form} layout="vertical" onFinish={(values) => void save(values)}>
          <p className={styles.quickEndpoint}>{preset.baseUrl}</p>
          <Form.Item
            name="apiKey"
            label={t('modelSettings.apiKey')}
            extra={t(
              preset.id === 'qwen'
                ? 'modelSettings.quick.qwenKeyHelp'
                : 'modelSettings.quick.keyHelp'
            )}
            rules={[
              { required: true, whitespace: true, message: t('modelSettings.quick.keyRequired') },
            ]}
          >
            <Input.Password autoComplete="new-password" disabled={disabled} />
          </Form.Item>
          <Space wrap>
            <Button type="primary" htmlType="submit" loading={disabled}>
              {t('modelSettings.quick.saveAndUse')}
            </Button>
            <Button
              disabled={disabled}
              onClick={() =>
                onAdvanced(
                  createPresetProfile(preset, t(preset.labelKey), providers),
                  form.getFieldValue('apiKey')?.trim() || ''
                )
              }
            >
              {t('modelSettings.quick.advanced')}
            </Button>
          </Space>
        </Form>
      )}
    </Card>
  );
}
