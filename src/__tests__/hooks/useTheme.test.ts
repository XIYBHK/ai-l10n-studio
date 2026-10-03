import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useTheme, useThemeRuntime } from '../../hooks/useTheme';
import { useAppStore } from '../../store/useAppStore';
const emitMock = vi.hoisted(() => vi.fn(async () => {}));
vi.mock('@tauri-apps/api/event', () => ({ emit: emitMock }));

describe('useTheme', () => {
  beforeEach(() => {
    emitMock.mockClear();
    useAppStore.setState({ theme: 'system', systemTheme: 'light' });
  });

  it('keeps pure consumers free of matchMedia listeners', () => {
    const media = {
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as unknown as MediaQueryList;
    vi.spyOn(window, 'matchMedia').mockReturnValue(media);
    const addSpy = vi.spyOn(media, 'addEventListener');

    renderHook(() => useTheme());

    expect(addSpy).not.toHaveBeenCalled();
  });

  it('installs one system listener and cleans it up at runtime boundary', () => {
    const media = {
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as unknown as MediaQueryList;
    vi.spyOn(window, 'matchMedia').mockReturnValue(media);
    const addSpy = vi.spyOn(media, 'addEventListener');
    const removeSpy = vi.spyOn(media, 'removeEventListener');
    const { unmount } = renderHook(() => {
      useTheme();
      useTheme();
      return useThemeRuntime();
    });

    expect(addSpy).toHaveBeenCalledTimes(1);
    expect(emitMock).toHaveBeenCalledTimes(1);
    act(() => unmount());
    expect(removeSpy).toHaveBeenCalledTimes(1);
  });

  it('updates the document atomically and releases transition suppression after paint', () => {
    const frames: FrameRequestCallback[] = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      frames.push(callback);
      return frames.length;
    });
    const cancel = vi.spyOn(window, 'cancelAnimationFrame');
    const { unmount } = renderHook(() => useThemeRuntime());
    act(() => useAppStore.setState({ theme: 'dark' }));
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(document.body.dataset.theme).toBe('dark');
    expect(document.documentElement).toHaveClass('theme-changing');
    act(() => frames.at(-1)?.(0));
    act(() => frames.at(-1)?.(16));
    expect(document.documentElement).not.toHaveClass('theme-changing');
    unmount();
    expect(cancel).toHaveBeenCalled();
  });
});
