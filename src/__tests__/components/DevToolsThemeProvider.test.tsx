import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppStore } from '../../store/useAppStore';
import { DevToolsThemeProvider } from '../../components/DevToolsThemeProvider';

const listenMock = vi.hoisted(() => vi.fn());
vi.mock('@tauri-apps/api/event', () => ({ listen: listenMock }));

describe('DevToolsThemeProvider', () => {
  beforeEach(() => {
    useAppStore.setState({ theme: 'system', systemTheme: 'light' });
    listenMock.mockReset();
  });

  it('unlistens when async listen resolves after unmount', async () => {
    let resolveListen: (() => void) | undefined;
    const unlisten = vi.fn();
    listenMock.mockImplementation(
      () => new Promise<() => void>((resolve) => (resolveListen = () => resolve(unlisten)))
    );

    const { unmount } = render(
      <DevToolsThemeProvider>
        <div />
      </DevToolsThemeProvider>
    );
    unmount();
    resolveListen?.();
    await Promise.resolve();

    expect(unlisten).toHaveBeenCalledTimes(1);
  });
});
