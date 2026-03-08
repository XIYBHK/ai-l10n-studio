import userEvent from '@testing-library/user-event';
import { screen, waitFor } from '@testing-library/react';
import { ThemeModeSwitch } from '../../components/ThemeModeSwitch';
import { useAppStore } from '../../store/useAppStore';
import { renderWithProviders } from '../../test/renderWithProviders';

const DEFAULT_STATS = {
  total: 0,
  tm_hits: 0,
  deduplicated: 0,
  ai_translated: 0,
  token_stats: {
    input_tokens: 0,
    output_tokens: 0,
    total_tokens: 0,
    cost: 0,
  },
  tm_learned: 0,
};

describe('ThemeModeSwitch', () => {
  beforeEach(() => {
    useAppStore.setState({
      config: null,
      theme: 'system',
      language: 'zh-CN',
      systemTheme: 'light',
      cumulativeStats: DEFAULT_STATS,
    });
  });

  it('updates the applied theme when the user selects dark mode', async () => {
    const user = userEvent.setup();

    renderWithProviders(<ThemeModeSwitch />);

    const options = screen.getByTestId('theme-mode-switch').querySelectorAll('label');
    await user.click(options[1] as HTMLElement);

    await waitFor(() => {
      expect(useAppStore.getState().theme).toBe('dark');
      expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
      expect(document.body).toHaveAttribute('data-theme', 'dark');
    });
  });

  it('keeps system mode aligned with the mocked system theme', async () => {
    const user = userEvent.setup();

    renderWithProviders(<ThemeModeSwitch />);

    const options = screen.getByTestId('theme-mode-switch').querySelectorAll('label');
    await user.click(options[2] as HTMLElement);

    await waitFor(() => {
      expect(useAppStore.getState().theme).toBe('system');
      expect(document.documentElement).toHaveAttribute('data-theme', 'light');
    });
  });
});
