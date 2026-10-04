import { useEffect, useState } from 'react';
import {
  Alert,
  App,
  Button,
  Card,
  Checkbox,
  Collapse,
  Empty,
  Form,
  Input,
  InputNumber,
  Popconfirm,
  Select,
  Space,
  Tag,
} from 'antd';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { aiProviderCommands, modelConfigurationCommands } from '../../services/aiCommands';
import { useModelConfiguration } from '../../hooks/useConfig';
import type { ModelApi, ModelDefinition, ModelProviderProfile } from '../../types/aiProvider';
import type { ProviderInfo } from '../../types/generated/ProviderInfo';
import { createModuleLogger } from '../../utils/logger';
import styles from './AIConfigTab.module.css';
import { QuickProviderSetup } from './QuickProviderSetup';

const log = createModuleLogger('AIConfigTab');
const emptyModel = (): ModelDefinition => ({
  id: '',
  name: null,
  contextWindow: null,
  maxTokens: null,
});
const emptyProfile = (): ModelProviderProfile => ({
  id: '',
  displayName: '',
  catalogProviderId: null,
  api: 'openai-completions',
  baseUrl: '',
  models: [emptyModel()],
  proxy: null,
});
interface Props {
  onProviderChange?: (providerId: string) => void;
}

export function AIConfigTab({ onProviderChange }: Props) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const { configuration, loading, error, mutate } = useModelConfiguration();
  const [catalog, setCatalog] = useState<ProviderInfo[]>([]);
  const [editing, setEditing] = useState<ModelProviderProfile | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [clearKey, setClearKey] = useState(false);
  const [testModel, setTestModel] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [form] = Form.useForm<ModelProviderProfile>();
  const watchedModels = Form.useWatch('models', form) as ModelDefinition[] | undefined;
  const proxyEnabled = Form.useWatch(['proxy', 'enabled'], form) === true;
  const existing = editing
    ? configuration.providers.find((provider) => provider.profile.id === editing.id)
    : undefined;

  useEffect(() => {
    let active = true;
    aiProviderCommands
      .getAll()
      .then((providers) => {
        if (active) setCatalog(providers);
      })
      .catch((cause) => log.error('provider catalog failed', cause));
    return () => {
      active = false;
    };
  }, []);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
    } catch (cause) {
      log.error('model settings action failed', cause);
    } finally {
      setBusy(false);
    }
  };
  const edit = (profile: ModelProviderProfile) => {
    setEditing(profile);
    setApiKey('');
    setClearKey(false);
    setTestModel(profile.models[0]?.id);
    form.resetFields();
    form.setFieldsValue(profile);
    onProviderChange?.(profile.catalogProviderId ?? profile.id);
  };
  const readProfile = (): ModelProviderProfile => ({
    ...editing!,
    ...form.getFieldsValue(true),
    proxy: form.getFieldValue(['proxy', 'enabled'])
      ? {
          enabled: true,
          host: String(form.getFieldValue(['proxy', 'host']) ?? '').trim(),
          port: Number(form.getFieldValue(['proxy', 'port'])),
        }
      : null,
    models: ((form.getFieldValue('models') as ModelDefinition[] | undefined) ?? []).map(
      (model) => ({
        id: model.id.trim(),
        name: model.name?.trim() || null,
        contextWindow: model.contextWindow ?? null,
        maxTokens: model.maxTokens ?? null,
      })
    ),
  });
  const credential = () => (clearKey ? '' : apiKey.trim() || null);
  const save = () =>
    run(async () => {
      await form.validateFields();
      await modelConfigurationCommands.saveProvider(readProfile(), credential());
      await mutate();
      setEditing(null);
      setApiKey('');
      message.success(t('modelSettings.saved'));
    });
  const addBuiltin = (id: string) =>
    run(async () => {
      const item = catalog.find((provider) => provider.id === id);
      if (!item) return;
      let profile = {
        ...emptyProfile(),
        id: item.id,
        displayName: item.display_name,
        catalogProviderId: item.id,
        api: item.api,
        baseUrl: item.default_url,
      };
      if (configuration.providers.some((provider) => provider.profile.id === id)) {
        let suffix = 2;
        while (
          configuration.providers.some((provider) => provider.profile.id === id + '-' + suffix)
        )
          suffix++;
        profile = { ...profile, id: id + '-' + suffix };
      }
      profile.models = await modelConfigurationCommands.discoverModels(profile, null);
      edit(profile);
    });
  const discover = () =>
    run(async () => {
      await form.validateFields(['id', 'displayName', 'baseUrl', 'api']);
      const discovered = await modelConfigurationCommands.discoverModels(
        readProfile(),
        credential()
      );
      const current = readProfile().models.filter((model) => model.id);
      const ids = new Set(current.map((model) => model.id));
      const merged = [...current, ...discovered.filter((model) => !ids.has(model.id))];
      form.setFieldValue('models', merged);
      setTestModel((previous) => previous || merged[0]?.id);
      message.success(t('modelSettings.discovered', { count: discovered.length }));
    });
  const test = () =>
    run(async () => {
      await form.validateFields();
      const profile = readProfile();
      const selected = profile.models.some((model) => model.id === testModel)
        ? testModel!
        : profile.models[0].id;
      const result = await modelConfigurationCommands.testProvider(profile, credential(), selected);
      if (result.success)
        message.success(t('modelSettings.connected', { ms: result.responseTimeMs }));
      else message.error(result.message);
    });
  const options = configuration.providers.flatMap((provider) =>
    provider.profile.models.map((model) => ({
      value: JSON.stringify([provider.profile.id, model.id]),
      label: provider.profile.displayName + ' / ' + (model.name || model.id),
    }))
  );

  return (
    <div data-testid="ai-config-tab" className={styles.settings} aria-busy={busy}>
      <div className={styles.intro}>
        <h3>{t('modelSettings.title')}</h3>
        <p>{t('modelSettings.description')}</p>
      </div>
      {error && <Alert type="error" showIcon message={t('modelSettings.loadFailed')} />}
      {!editing && (
        <QuickProviderSetup
          providers={configuration.providers}
          disabled={busy || loading || !!error}
          onBusyChange={setBusy}
          onSaved={mutate}
          onAdvanced={(profile, key) => {
            edit(profile);
            setApiKey(key);
          }}
        />
      )}
      <label className={styles.label} htmlFor="default-model">
        {t('modelSettings.defaultModel')}
      </label>
      <Select
        id="default-model"
        aria-label={t('modelSettings.defaultModel')}
        loading={loading}
        disabled={busy}
        allowClear
        placeholder={t('modelSettings.selectDefault')}
        value={
          configuration.defaultModel
            ? JSON.stringify([
                configuration.defaultModel.providerId,
                configuration.defaultModel.modelId,
              ])
            : undefined
        }
        options={options}
        onChange={(value: string | undefined) =>
          void run(async () => {
            const pair: [string, string] | null = value ? JSON.parse(value) : null;
            await modelConfigurationCommands.setDefault(
              pair ? { providerId: pair[0], modelId: pair[1] } : null
            );
            await mutate();
          })
        }
      />
      {!configuration.providers.length && !editing && (
        <Empty description={t('modelSettings.empty')} image={Empty.PRESENTED_IMAGE_SIMPLE} />
      )}
      <div className={styles.providers}>
        {configuration.providers.map((provider) => (
          <Card
            key={provider.profile.id}
            size="small"
            title={provider.profile.displayName}
            extra={
              <Space>
                <Tag>
                  {t(provider.hasApiKey ? 'modelSettings.keyConfigured' : 'modelSettings.noKey')}
                </Tag>
                <Button size="small" disabled={busy} onClick={() => edit(provider.profile)}>
                  {t('common.edit')}
                </Button>
                <Popconfirm
                  title={t('modelSettings.confirmRemove')}
                  onConfirm={() =>
                    run(async () => {
                      await modelConfigurationCommands.removeProvider(provider.profile.id);
                      if (editing?.id === provider.profile.id) setEditing(null);
                      await mutate();
                    })
                  }
                >
                  <Button
                    size="small"
                    danger
                    disabled={busy}
                    aria-label={t('modelSettings.removeProvider', {
                      name: provider.profile.displayName,
                    })}
                    icon={<DeleteOutlined />}
                  />
                </Popconfirm>
              </Space>
            }
          >
            <div className={styles.endpoint}>
              {provider.profile.api} · {provider.profile.baseUrl}
            </div>
            <div className={styles.modelTags}>
              {provider.profile.models.map((model) => (
                <Tag key={model.id}>{model.name || model.id}</Tag>
              ))}
            </div>
          </Card>
        ))}
      </div>
      {editing ? (
        <Card
          size="small"
          title={t(existing ? 'modelSettings.editProvider' : 'modelSettings.newProvider')}
        >
          <Form form={form} layout="vertical" initialValues={editing} onFinish={() => void save()}>
            <div className={styles.fieldGrid}>
              <Form.Item
                name="id"
                label={t('modelSettings.providerId')}
                rules={[
                  { required: true },
                  { pattern: /^[a-z][a-z0-9-]*$/, message: t('modelSettings.idRule') },
                  {
                    validator: (_, value: string) =>
                      !existing &&
                      configuration.providers.some((provider) => provider.profile.id === value)
                        ? Promise.reject(new Error(t('modelSettings.duplicateId')))
                        : Promise.resolve(),
                  },
                ]}
              >
                <Input disabled={!!existing} autoComplete="off" placeholder="my-provider" />
              </Form.Item>
              <Form.Item
                name="displayName"
                label={t('modelSettings.displayName')}
                rules={[{ required: true, whitespace: true }]}
              >
                <Input />
              </Form.Item>
              <Form.Item name="api" label={t('modelSettings.api')} rules={[{ required: true }]}>
                <Select
                  options={(
                    ['openai-completions', 'openai-responses', 'anthropic-messages'] as ModelApi[]
                  ).map((value) => ({ value, label: value }))}
                />
              </Form.Item>
              <Form.Item
                name="baseUrl"
                label={t('modelSettings.baseUrl')}
                rules={[{ required: true }, { type: 'url' }]}
              >
                <Input placeholder="https://api.example.com/v1" />
              </Form.Item>
            </div>
            <Form.Item
              label={t('modelSettings.apiKey')}
              htmlFor="model-api-key"
              extra={t(
                existing?.hasApiKey ? 'modelSettings.keepApiKey' : 'modelSettings.optionalApiKey'
              )}
            >
              <Input.Password
                id="model-api-key"
                disabled={clearKey}
                autoComplete="new-password"
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
              />
              {existing?.hasApiKey && (
                <Checkbox
                  checked={clearKey}
                  onChange={(event) => setClearKey(event.target.checked)}
                >
                  {t('modelSettings.clearKey')}
                </Checkbox>
              )}
            </Form.Item>
            <div className={styles.modelHeader}>
              <span className={styles.label}>{t('modelSettings.models')}</span>
              <Button size="small" loading={busy} onClick={() => void discover()}>
                {t('modelSettings.discover')}
              </Button>
            </div>
            <Form.List
              name="models"
              rules={[
                {
                  validator: (_, models: ModelDefinition[]) =>
                    models?.length
                      ? Promise.resolve()
                      : Promise.reject(new Error(t('modelSettings.requireModel'))),
                },
              ]}
            >
              {(fields, { add, remove }, { errors }) => (
                <>
                  <div className={styles.columnLabels} aria-hidden="true">
                    <span>{t('modelSettings.modelId')}</span>
                    <span>{t('modelSettings.modelName')}</span>
                    <span>{t('modelSettings.contextWindow')}</span>
                    <span>{t('modelSettings.maxTokens')}</span>
                    <span />
                  </div>
                  {fields.map(({ key, name }) => (
                    <div className={styles.modelRow} key={key}>
                      <Form.Item name={[name, 'id']} rules={[{ required: true, whitespace: true }]}>
                        <Input
                          aria-label={t('modelSettings.modelId')}
                          placeholder={t('modelSettings.modelId')}
                        />
                      </Form.Item>
                      <Form.Item name={[name, 'name']}>
                        <Input
                          aria-label={t('modelSettings.modelName')}
                          placeholder={t('modelSettings.modelName')}
                        />
                      </Form.Item>
                      <Form.Item name={[name, 'contextWindow']}>
                        <InputNumber
                          min={1}
                          precision={0}
                          aria-label={t('modelSettings.contextWindow')}
                          placeholder={t('modelSettings.contextWindow')}
                        />
                      </Form.Item>
                      <Form.Item name={[name, 'maxTokens']}>
                        <InputNumber
                          min={1}
                          precision={0}
                          aria-label={t('modelSettings.maxTokens')}
                          placeholder={t('modelSettings.maxTokens')}
                        />
                      </Form.Item>
                      <Button
                        aria-label={t('modelSettings.removeModel')}
                        disabled={busy}
                        icon={<DeleteOutlined />}
                        onClick={() => remove(name)}
                      />
                    </div>
                  ))}
                  <Form.ErrorList errors={errors} />
                  <Button type="dashed" icon={<PlusOutlined />} onClick={() => add(emptyModel())}>
                    {t('modelSettings.addModel')}
                  </Button>
                </>
              )}
            </Form.List>
            <Collapse
              className={styles.proxy}
              size="small"
              items={[
                {
                  key: 'proxy',
                  label: t('modelSettings.proxy'),
                  children: (
                    <>
                      <Form.Item name={['proxy', 'enabled']} valuePropName="checked">
                        <Checkbox>{t('modelSettings.enableProxy')}</Checkbox>
                      </Form.Item>
                      <div className={styles.fieldGrid}>
                        <Form.Item
                          name={['proxy', 'host']}
                          label={t('modelSettings.proxyHost')}
                          rules={[{ required: proxyEnabled }]}
                        >
                          <Input disabled={!proxyEnabled} placeholder="127.0.0.1" />
                        </Form.Item>
                        <Form.Item
                          name={['proxy', 'port']}
                          label={t('modelSettings.proxyPort')}
                          rules={[{ required: proxyEnabled }]}
                        >
                          <InputNumber disabled={!proxyEnabled} min={1} max={65535} precision={0} />
                        </Form.Item>
                      </div>
                    </>
                  ),
                },
              ]}
            />
            <div className={styles.actions}>
              <Space wrap>
                <Button type="primary" htmlType="submit" loading={busy}>
                  {t('modelSettings.save')}
                </Button>
                <Button
                  disabled={busy}
                  onClick={() => {
                    setEditing(null);
                    setApiKey('');
                  }}
                >
                  {t('common.cancel')}
                </Button>
              </Space>
              <Space wrap>
                <Select
                  aria-label={t('modelSettings.testModel')}
                  className={styles.testModel}
                  value={testModel}
                  placeholder={t('modelSettings.testModel')}
                  onChange={setTestModel}
                  options={(watchedModels ?? editing.models)
                    .filter((model) => model.id)
                    .map((model) => ({ value: model.id, label: model.id }))}
                />
                <Button loading={busy} onClick={() => void test()}>
                  {t('modelSettings.test')}
                </Button>
              </Space>
            </div>
          </Form>
        </Card>
      ) : (
        <Space wrap>
          <Select<string>
            aria-label={t('modelSettings.addBuiltin')}
            value={undefined}
            disabled={busy}
            className={styles.builtin}
            placeholder={t('modelSettings.addBuiltin')}
            options={catalog.map((provider) => ({
              value: provider.id,
              label: provider.display_name,
            }))}
            onChange={(id) => void addBuiltin(id)}
          />
          <Button icon={<PlusOutlined />} disabled={busy} onClick={() => edit(emptyProfile())}>
            {t('modelSettings.addCustom')}
          </Button>
        </Space>
      )}
    </div>
  );
}
export default AIConfigTab;
