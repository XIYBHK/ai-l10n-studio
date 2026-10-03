import { TauriStore } from '../../store/tauriStore';

const mocks = vi.hoisted(() => ({ load: vi.fn(), runtime: vi.fn(() => true) }));
vi.mock('@tauri-apps/api/core', () => ({ isTauri: mocks.runtime }));
vi.mock('@tauri-apps/plugin-store', () => ({ Store: { load: mocks.load } }));

describe('Tauri 2 persistence and write order', () => {
  let disk: Map<string, unknown>;
  beforeEach(() => {
    vi.clearAllMocks();
    disk = new Map();
    mocks.load.mockImplementation(async () => ({
      get: async (key: string) => disk.get(key),
      set: async (key: string, value: unknown) => {
        disk.set(key, value);
      },
      save: async () => {},
    }));
  });

  it('uses the native store without a Tauri v1 global and restores saved preferences', async () => {
    const first = new TauriStore();
    await first.setTheme('dark');
    const restarted = new TauriStore();
    expect(await restarted.getTheme()).toBe('dark');
    expect(mocks.runtime).toHaveBeenCalled();
    expect(mocks.load).toHaveBeenCalledTimes(2);
  });

  it('serializes concurrent statistic updates and retains unknown cost provenance', async () => {
    let release!: () => void;
    let firstWrite = true;
    const save = vi.fn(async (key: string, value: unknown) => {
      if (firstWrite) {
        firstWrite = false;
        await new Promise<void>((resolve) => {
          release = resolve;
        });
      }
      disk.set(key, value);
    });
    mocks.load.mockResolvedValue({
      get: async (key: string) => disk.get(key),
      set: save,
      save: async () => {},
    });
    const store = new TauriStore();
    const first = store.updateCumulativeStats({ totalTranslated: 1, unpricedRequests: 1 });
    const second = store.updateCumulativeStats({ totalTranslated: 2, unpricedRequests: 2 });
    while (!release) await Promise.resolve();
    expect(save).toHaveBeenCalledTimes(1);
    release();
    await Promise.all([first, second]);
    expect((await store.getCumulativeStats()).totalTranslated).toBe(2);
    expect((await store.getCumulativeStats()).unpricedRequests).toBe(2);
  });

  it('can retry initialization after a transient native store failure', async () => {
    mocks.load.mockRejectedValueOnce(new Error('temporary storage failure'));
    const store = new TauriStore();
    await expect(store.init()).rejects.toThrow('temporary storage failure');
    await store.setTheme('dark');
    expect(await store.getTheme()).toBe('dark');
  });
});
