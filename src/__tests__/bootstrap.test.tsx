import { waitFor } from '@testing-library/react';
import { isValidElement } from 'react';

const mocks = vi.hoisted(() => ({ initialize: vi.fn(), render: vi.fn(), show: vi.fn() }));
vi.mock('react-dom/client', () => ({ default: { createRoot: () => ({ render: mocks.render }) } }));
vi.mock('../store', () => ({ initializeStores: mocks.initialize }));
vi.mock('@tauri-apps/api/window', () => ({ getCurrentWindow: () => ({ show: mocks.show }) }));
vi.mock('../App', () => ({ default: () => null }));

describe('application bootstrap', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    document.body.innerHTML = '<div id="root"></div>';
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      callback(0);
      return 1;
    });
    mocks.show.mockResolvedValue(undefined);
  });

  it('waits for persisted preferences before mounting interactive UI', async () => {
    let release!: () => void;
    mocks.initialize.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        })
    );
    await import('../main');
    expect(mocks.render).not.toHaveBeenCalled();
    expect(mocks.show).not.toHaveBeenCalled();
    release();
    await waitFor(() => expect(mocks.render).toHaveBeenCalledOnce());
    await waitFor(() => expect(mocks.show).toHaveBeenCalledOnce());
  });

  it('mounts a recoverable error after initialization fails', async () => {
    mocks.initialize.mockRejectedValue(new Error('storage unavailable'));
    await import('../main');
    await waitFor(() => expect(mocks.render).toHaveBeenCalledOnce());
    const tree: unknown = mocks.render.mock.calls[0][0];
    expect(isValidElement<{ children: unknown }>(tree)).toBe(true);
    if (!isValidElement<{ children: unknown }>(tree)) throw new Error('Missing root element');
    const child = tree.props.children;
    if (!isValidElement<{ initError: string }>(child)) throw new Error('Missing app element');
    expect(child.props.initError).toContain('storage unavailable');
    await waitFor(() => expect(mocks.show).toHaveBeenCalledOnce());
  });
});
