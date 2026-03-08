import userEvent from '@testing-library/user-event';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderWithProviders } from '../../../test/renderWithProviders';
import { AIConfigTab } from '../../../components/settings/AIConfigTab';

const mockUseAIConfigs = vi.fn();
const mockGetAllProviders = vi.fn();
const mockGetProviderModels = vi.fn();
const mockTestConnection = vi.fn();

vi.mock('../../../hooks/useConfig', () => ({
  useAIConfigs: () => mockUseAIConfigs(),
}));

vi.mock('../../../services/aiCommands', () => ({
  aiConfigCommands: {
    getAll: vi.fn(),
    getActive: vi.fn(),
    add: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    setActive: vi.fn(),
    testConnection: (...args: unknown[]) => mockTestConnection(...args),
  },
  aiModelCommands: {
    getProviderModels: (...args: unknown[]) => mockGetProviderModels(...args),
  },
  aiProviderCommands: {
    getAll: (...args: unknown[]) => mockGetAllProviders(...args),
  },
}));

describe('AIConfigTab', () => {
  beforeEach(() => {
    mockUseAIConfigs.mockReturnValue({
      configs: [],
      active: null,
      loading: false,
      error: null,
      mutateAll: vi.fn(),
      mutateActive: vi.fn(),
    });

    mockGetAllProviders.mockResolvedValue([
      {
        id: 'deepseek',
        display_name: 'DeepSeek',
        default_url: 'https://api.deepseek.com',
        default_model: 'deepseek-chat',
      },
    ]);

    mockGetProviderModels.mockResolvedValue([
      {
        id: 'deepseek-chat',
        display_name: 'DeepSeek Chat',
      },
    ]);

    mockTestConnection.mockResolvedValue({
      success: true,
      message: 'ok',
    });
  });

  it('submits a connection test from the UI form', async () => {
    const user = userEvent.setup();

    renderWithProviders(<AIConfigTab />);

    await waitFor(() => {
      expect(mockGetAllProviders).toHaveBeenCalledTimes(1);
    });

    await user.click(screen.getByTestId('ai-config-add-button'));

    const providerField = screen.getByTestId('ai-config-provider');
    fireEvent.mouseDown(providerField);

    const option = await within(document.body).findByText('DeepSeek');
    await user.click(option);

    const apiKeyInput = screen.getByPlaceholderText(/API Key/i);
    await user.type(apiKeyInput, 'sk-test-123');
    await user.click(screen.getByTestId('ai-config-test-connection'));

    await waitFor(() => {
      expect(mockGetProviderModels).toHaveBeenCalledWith('deepseek');
      expect(mockTestConnection).toHaveBeenCalledWith(
        'deepseek',
        'sk-test-123',
        'https://api.deepseek.com'
      );
    });
  });
});
