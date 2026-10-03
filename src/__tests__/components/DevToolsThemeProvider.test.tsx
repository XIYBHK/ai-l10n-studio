import { act, render } from '@testing-library/react';
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
    const registrations: Array<() => void> = [];
    const unlisten = vi.fn();
    listenMock.mockImplementation(
      () => new Promise<() => void>((resolve) => registrations.push(() => resolve(unlisten)))
    );

    const { unmount } = render(
      <DevToolsThemeProvider>
        <div />
      </DevToolsThemeProvider>
    );
    unmount();
    registrations.forEach((resolve) => resolve());
    await Promise.resolve();

    expect(unlisten).toHaveBeenCalledTimes(2);
  });

  it('applies a theme event without writing back the main-window preference', () => {
    const setTheme = vi.spyOn(useAppStore.getState(), 'setTheme');
    let receiveTheme:
      | ((event: { payload: { theme: 'dark'; appliedTheme: 'dark' } }) => void)
      | undefined;
    listenMock.mockImplementation((name, callback) => {
      if (name === 'theme:changed') receiveTheme = callback;
      return Promise.resolve(vi.fn());
    });
    render(
      <DevToolsThemeProvider>
        <div />
      </DevToolsThemeProvider>
    );
    act(() => receiveTheme?.({ payload: { theme: 'dark', appliedTheme: 'dark' } }));
    expect(useAppStore.getState().theme).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(setTheme).not.toHaveBeenCalled();
  });
});
