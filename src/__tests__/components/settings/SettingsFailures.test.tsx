import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../../test/renderWithProviders';
import { NotificationTab } from '../../../components/settings/NotificationTab';
import { LogsTab } from '../../../components/settings/LogsTab';
import i18n from '../../../i18n/config';

const mocks = vi.hoisted(() => ({ init: vi.fn(), permission: vi.fn(), getConfig: vi.fn() }));
vi.mock('../../../utils/notificationManager', () => ({
  notificationManager: {
    init: mocks.init,
    isEnabled: () => false,
    requestPermission: mocks.permission,
  },
}));
vi.mock('../../../services/configCommands', () => ({ configCommands: { get: mocks.getConfig } }));

describe('settings failure feedback', () => {
  beforeEach(async () => {
    mocks.init.mockReset();
    mocks.permission.mockReset();
    mocks.getConfig.mockReset();
    await i18n.changeLanguage('zh-CN');
  });

  it('shows notification initialization failure, permits retry, and reports permission errors', async () => {
    mocks.init.mockRejectedValueOnce(new Error('read denied')).mockResolvedValue(undefined);
    mocks.permission.mockRejectedValue(new Error('permission unavailable'));
    renderWithProviders(<NotificationTab />);
    expect(await screen.findByText('通知设置读取失败，请重试。')).toBeInTheDocument();
    expect(screen.getByRole('switch')).toBeDisabled();
    await userEvent.setup().click(screen.getByRole('button', { name: /重\s*试/ }));
    await waitFor(() => expect(screen.getByRole('switch')).toBeEnabled());
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: i18n.t('notifications.permission') }));
    expect(await screen.findByText('请求通知权限失败，请重试。')).toBeInTheDocument();
  });

  it('blocks log-setting saves after a read failure and enables them only after retry succeeds', async () => {
    mocks.getConfig.mockRejectedValueOnce(new Error('read denied')).mockResolvedValue({
      logLevel: 'warn',
      logRetentionDays: 15,
      logMaxSize: 128,
      logMaxCount: 8,
    });
    renderWithProviders(<LogsTab />);
    expect(await screen.findByText('日志设置读取失败，请重试。')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /保\s*存/ })).toBeDisabled();
    await userEvent.setup().click(screen.getByRole('button', { name: /重\s*试/ }));
    await waitFor(() => expect(screen.getByRole('button', { name: /保\s*存/ })).toBeEnabled());
    expect(screen.getByDisplayValue('15')).toBeInTheDocument();
    expect(screen.queryByText('日志设置读取失败，请重试。')).not.toBeInTheDocument();
  });
});
