import userEvent from '@testing-library/user-event';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../../test/renderWithProviders';
import { AIConfigTab } from '../../../components/settings/AIConfigTab';
import type { ModelConfiguration, ModelProviderProfile } from '../../../types/aiProvider';
import i18n from '../../../i18n/config';
import { MODEL_PRESETS } from '../../../config/modelPresets';

const { state, mutate, saveProvider, setDefault, discoverModels, testProvider } = vi.hoisted(
  () => ({
    state: { configuration: { providers: [], defaultModel: null } as ModelConfiguration },
    mutate: vi.fn(),
    saveProvider: vi.fn(),
    setDefault: vi.fn(),
    discoverModels: vi.fn(),
    testProvider: vi.fn(),
  })
);
vi.mock('../../../hooks/useConfig', () => ({
  useModelConfiguration: () => ({
    configuration: state.configuration,
    loading: false,
    error: null,
    mutate,
  }),
}));
vi.mock('../../../services/aiCommands', () => ({
  aiProviderCommands: {
    getAll: vi.fn().mockResolvedValue([
      {
        id: 'catalog',
        display_name: 'Catalog',
        default_url: 'https://catalog.test/v1',
        default_model: 'default',
      },
    ]),
  },
  modelConfigurationCommands: {
    saveProvider,
    setDefault,
    discoverModels,
    testProvider,
    removeProvider: vi.fn(),
  },
}));
const profile: ModelProviderProfile = {
  id: 'saved',
  displayName: 'Saved',
  catalogProviderId: null,
  api: 'openai-completions',
  baseUrl: 'https://saved.test/v1',
  models: [{ id: 'model', name: 'Model', contextWindow: null, maxTokens: null }],
  proxy: null,
};
const fillRequired = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByLabelText('供应商 ID'));
  await user.paste('local-provider');
  await user.click(screen.getByLabelText('显示名称'));
  await user.paste('Local');
  await user.click(screen.getByLabelText('Base URL'));
  await user.paste('https://local.test/v1');
};

const presetName = (id: string) => {
  const preset = MODEL_PRESETS.find((item) => item.id === id)!;
  return `${i18n.t(preset.labelKey)}${preset.modelId}`;
};

describe('AIConfigTab', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('zh-CN');
    state.configuration = { providers: [], defaultModel: null };
    vi.clearAllMocks();
    saveProvider.mockResolvedValue(undefined);
    mutate.mockResolvedValue(undefined);
    setDefault.mockResolvedValue(undefined);
    discoverModels.mockResolvedValue([
      { id: 'discovered', name: 'Discovered', contextWindow: 1000, maxTokens: 100 },
    ]);
  }, 15000);

  it('saves a custom provider with two models and complete profile metadata', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AIConfigTab />);
    await user.click(screen.getByRole('button', { name: /添加自定义 API/ }));
    await fillRequired(user);
    await user.type(screen.getAllByRole('textbox', { name: '模型 ID' })[0], 'model-a');
    await user.click(screen.getByRole('button', { name: /添加模型/ }));
    await user.type(screen.getAllByRole('textbox', { name: '模型 ID' })[1], 'model-b');
    await user.click(screen.getByRole('button', { name: '保存供应商' }));
    await waitFor(() =>
      expect(saveProvider).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'local-provider',
          displayName: 'Local',
          catalogProviderId: null,
          api: 'openai-completions',
          baseUrl: 'https://local.test/v1',
          proxy: null,
          models: expect.arrayContaining([
            expect.objectContaining({ id: 'model-a' }),
            expect.objectContaining({ id: 'model-b' }),
          ]),
        }),
        null
      )
    );
  }, 15000);

  it('never prefills a saved key, preserves it when blank and clears only explicitly', async () => {
    state.configuration = { providers: [{ profile, hasApiKey: true }], defaultModel: null };
    const user = userEvent.setup();
    renderWithProviders(<AIConfigTab />);
    await user.click(screen.getByRole('button', { name: /编\s*辑/ }));
    expect(screen.getByLabelText('API Key')).toHaveValue('');
    await user.click(screen.getByRole('button', { name: '保存供应商' }));
    await waitFor(() => expect(saveProvider).toHaveBeenCalledWith(expect.anything(), null));
    await waitFor(() => expect(screen.queryByLabelText('API Key')).not.toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /编\s*辑/ }));
    await user.click(screen.getByRole('checkbox', { name: '清除已保存的密钥' }));
    await user.click(screen.getByRole('button', { name: '保存供应商' }));
    await waitFor(() => expect(saveProvider).toHaveBeenLastCalledWith(expect.anything(), ''));
  }, 15000);

  it('selects a default model independently from the provider editor', async () => {
    state.configuration = { providers: [{ profile, hasApiKey: false }], defaultModel: null };
    const user = userEvent.setup();
    renderWithProviders(<AIConfigTab />);
    await user.click(screen.getByRole('combobox', { name: '默认模型' }));
    await user.click(await screen.findByText('Saved / Model'));
    await waitFor(() =>
      expect(setDefault).toHaveBeenCalledWith({ providerId: 'saved', modelId: 'model' })
    );
  }, 15000);

  it('loads built-in provider metadata and its catalog models', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AIConfigTab />);
    await user.click(screen.getByRole('combobox', { name: '添加内置供应商' }));
    await user.click(await screen.findByText('Catalog'));
    await waitFor(() =>
      expect(discoverModels).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'catalog', catalogProviderId: 'catalog' }),
        null
      )
    );
    expect(await screen.findByDisplayValue('discovered')).toBeInTheDocument();
  }, 15000);

  it('discovers models before a custom provider has any model IDs', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AIConfigTab />);
    await user.click(screen.getByRole('button', { name: /添加自定义 API/ }));
    await fillRequired(user);
    await user.click(screen.getByRole('button', { name: '发现模型' }));
    await waitFor(() =>
      expect(discoverModels).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'local-provider',
          catalogProviderId: null,
          baseUrl: 'https://local.test/v1',
        }),
        null
      )
    );
    expect(await screen.findByDisplayValue('discovered')).toBeInTheDocument();
  }, 15000);

  it.each(MODEL_PRESETS.map((preset) => [preset.id, preset.modelId] as const))(
    'quick preset %s saves with its preset profile and default model',
    async (presetId, modelId) => {
      const user = userEvent.setup();
      renderWithProviders(<AIConfigTab />);
      const presetButton = screen.getByRole('button', { name: presetName(presetId), exact: true });
      await user.click(presetButton);
      const key = screen.getByLabelText('API Key');
      await user.type(key, '  sk-quick-test  ');
      await user.click(screen.getByRole('button', { name: /保存并使用/ }));
      const preset = MODEL_PRESETS.find((item) => item.id === presetId)!;
      await waitFor(() =>
        expect(saveProvider).toHaveBeenCalledWith(
          expect.objectContaining({
            id: preset.id,
            displayName: expect.any(String),
            catalogProviderId: null,
            api: preset.api,
            baseUrl: preset.baseUrl,
            models: [{ id: modelId, name: null, contextWindow: null, maxTokens: null }],
            proxy: null,
          }),
          'sk-quick-test',
          modelId
        )
      );
      expect(setDefault).not.toHaveBeenCalled();
      expect(discoverModels).not.toHaveBeenCalled();
      await waitFor(() => expect(screen.queryByLabelText('API Key')).not.toBeInTheDocument());
    },
    15000
  );

  it('blocks quick preset save for a blank API key', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AIConfigTab />);
    await user.click(screen.getByRole('button', { name: presetName('deepseek'), exact: true }));
    await user.click(screen.getByRole('button', { name: /保存并使用/ }));
    expect(await screen.findByText(i18n.t('modelSettings.quick.keyRequired'))).toBeInTheDocument();
    expect(saveProvider).not.toHaveBeenCalled();
  });

  it('clears the quick API key when switching presets', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AIConfigTab />);
    await user.click(screen.getByRole('button', { name: presetName('deepseek'), exact: true }));
    await user.type(screen.getByLabelText('API Key'), 'stale-key');
    await user.click(screen.getByRole('button', { name: presetName('qwen'), exact: true }));
    expect(screen.getByLabelText('API Key')).toHaveValue('');
  });

  it('uses a suffixed provider id when a preset id already exists', async () => {
    state.configuration = {
      providers: [{ profile: { ...profile, id: 'deepseek' }, hasApiKey: false }],
      defaultModel: null,
    };
    const user = userEvent.setup();
    renderWithProviders(<AIConfigTab />);
    await user.click(screen.getByRole('button', { name: presetName('deepseek'), exact: true }));
    await user.type(screen.getByLabelText('API Key'), 'new-key');
    await user.click(screen.getByRole('button', { name: /保存并使用/ }));
    await waitFor(() =>
      expect(saveProvider).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'deepseek-2' }),
        'new-key',
        expect.any(String)
      )
    );
  });

  it('keeps advanced preset fields when opening advanced settings', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AIConfigTab />);
    await user.click(screen.getByRole('button', { name: presetName('deepseek'), exact: true }));
    await user.type(screen.getByLabelText('API Key'), 'retry-key');
    await user.click(screen.getByRole('button', { name: /高级设置/ }));
    expect(screen.getByLabelText('API Key')).toHaveValue('retry-key');
    expect(screen.getByLabelText('Base URL')).toHaveValue('https://api.deepseek.com');
  });

  it('keeps the quick key after a failed save and allows retry', async () => {
    const user = userEvent.setup();
    saveProvider.mockRejectedValueOnce(new Error('temporary failure')).mockResolvedValue(undefined);
    renderWithProviders(<AIConfigTab />);
    await user.click(screen.getByRole('button', { name: presetName('deepseek'), exact: true }));
    await user.type(screen.getByLabelText('API Key'), 'retry-key');
    await user.click(screen.getByRole('button', { name: /保存并使用/ }));
    await waitFor(() => expect(saveProvider).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByRole('button', { name: /保存并使用/ })).toBeEnabled());
    expect(screen.getByLabelText('API Key')).toHaveValue('retry-key');
    await user.click(screen.getByRole('button', { name: /保存并使用/ }));
    await waitFor(() => expect(saveProvider).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByLabelText('API Key')).not.toBeInTheDocument());
  });
});
