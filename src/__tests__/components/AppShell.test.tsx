import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SWRConfig } from 'swr';
import AppShell from '../../AppShell';
import i18n from '../../i18n/config';
import { useAppStore } from '../../store/useAppStore';
import { render } from '@testing-library/react';

const getConfiguration = vi.hoisted(() => vi.fn());
vi.mock('../../services/aiCommands', () => ({
  modelConfigurationCommands: { get: getConfiguration },
}));
vi.mock('../../hooks/useTheme', () => ({
  useThemeRuntime: () => ({ themeConfig: {}, appliedTheme: 'light', isDark: false }),
}));
vi.mock('../../hooks/useTranslationFlow', () => ({
  useTranslationFlow: () => ({ entries: [], isTranslating: false, progress: 0 }),
}));
vi.mock('../../components/MenuBar', () => ({ MenuBar: () => <div>Menu</div> }));
vi.mock('../../components/TranslationWorkspace', () => ({
  TranslationWorkspace: () => <div>Workspace</div>,
}));
vi.mock('../../components/SettingsModal', () => ({
  SettingsModal: () => <div role="dialog">Settings</div>,
}));

describe('model configuration startup', () => {
  beforeEach(async () => {
    getConfiguration.mockReset();
    useAppStore.setState({ language: 'en-US' });
    await i18n.changeLanguage('en-US');
  });

  function mount() {
    render(
      <SWRConfig value={{ provider: () => new Map(), shouldRetryOnError: false }}>
        <AppShell />
      </SWRConfig>
    );
  }

  it('shows a retryable read failure without opening unconfigured-model settings', async () => {
    getConfiguration.mockRejectedValueOnce(new Error('read failed')).mockResolvedValue({
      providers: [],
      defaultModel: { providerId: 'local', modelId: 'model' },
    });
    mount();
    expect(await screen.findByText('Unable to load model settings')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() =>
      expect(screen.queryByText('Unable to load model settings')).not.toBeInTheDocument()
    );
    expect(getConfiguration).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens settings only after successfully reading an empty configuration', async () => {
    getConfiguration.mockResolvedValue({ providers: [], defaultModel: null });
    mount();
    expect(await screen.findByRole('dialog')).toHaveTextContent('Settings');
  });
});
