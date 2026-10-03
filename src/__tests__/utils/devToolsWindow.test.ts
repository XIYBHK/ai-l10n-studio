import { beforeEach, describe, expect, it, vi } from 'vitest';
import { openDevToolsWindow } from '../../utils/devToolsWindow';

const native = vi.hoisted(() => ({
  getByLabel: vi.fn(),
  callbacks: new Map<string, (event: { payload: unknown }) => void>(),
  dispose: vi.fn(),
  create: vi.fn(),
}));

vi.mock('@tauri-apps/api/webviewWindow', () => ({
  WebviewWindow: Object.assign(
    function () {
      native.create();
      return {
        once: async (name: string, callback: (event: { payload: unknown }) => void) => {
          native.callbacks.set(name, callback);
          return native.dispose;
        },
      };
    },
    { getByLabel: native.getByLabel }
  ),
}));

describe('developer window lifecycle', () => {
  beforeEach(() => {
    native.getByLabel.mockReset().mockResolvedValue(null);
    native.create.mockClear();
    native.dispose.mockClear();
    native.callbacks.clear();
  });

  it('rejects a native creation failure and permits a later retry', async () => {
    const failed = expect(openDevToolsWindow()).rejects.toThrow('creation denied');
    await vi.waitFor(() => expect(native.callbacks.has('tauri://error')).toBe(true));
    native.callbacks.get('tauri://error')?.({ payload: 'creation denied' });
    await failed;
    native.callbacks.clear();
    const retry = openDevToolsWindow();
    await vi.waitFor(() => expect(native.callbacks.has('tauri://created')).toBe(true));
    native.callbacks.get('tauri://created')?.({ payload: null });
    await retry;
    expect(native.create).toHaveBeenCalledTimes(2);
    expect(native.dispose).toHaveBeenCalledTimes(4);
  });

  it('coalesces repeated clicks while creation is pending', async () => {
    const first = openDevToolsWindow();
    expect(openDevToolsWindow()).toBe(first);
    await vi.waitFor(() => expect(native.callbacks.has('tauri://created')).toBe(true));
    native.callbacks.get('tauri://created')?.({ payload: null });
    await first;
    expect(native.create).toHaveBeenCalledTimes(1);
  });

  it('propagates an existing-window focus error to the UI caller', async () => {
    native.getByLabel.mockResolvedValue({
      show: vi.fn().mockResolvedValue(undefined),
      setFocus: vi.fn().mockRejectedValue(new Error('focus denied')),
    });
    await expect(openDevToolsWindow()).rejects.toThrow('focus denied');
    expect(native.create).not.toHaveBeenCalled();
  });
});
