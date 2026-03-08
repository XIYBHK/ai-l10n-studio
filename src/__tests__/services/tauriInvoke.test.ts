import { clearMocks, mockIPC } from '@tauri-apps/api/mocks';
import { invoke, maskSensitiveData } from '../../services/tauriInvoke';

describe('tauriInvoke', () => {
  afterEach(() => {
    clearMocks();
  });

  it('masks nested sensitive fields', () => {
    expect(
      maskSensitiveData({
        apiKey: 'sk-1234567890',
        nested: { token: 'abcdefghi' },
        visible: 'hello',
      })
    ).toEqual({
      apiKey: 'sk-***...***7890',
      nested: { token: 'abc***...***ghi' },
      visible: 'hello',
    });
  });

  it('uses mocked tauri ipc commands', async () => {
    const handler = vi.fn((command: string, payload?: unknown) => ({
      command,
      payload,
      ok: true,
    }));

    mockIPC(handler);

    await expect(invoke('demo_command', { value: 42 })).resolves.toEqual({
      command: 'demo_command',
      payload: { value: 42 },
      ok: true,
    });

    expect(handler).toHaveBeenCalledWith('demo_command', { value: 42 });
  });
});
