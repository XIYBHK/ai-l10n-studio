import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

const commands = vi.hoisted(() => ({
  get: vi.fn(),
  getPromptLogs: vi.fn(),
  clear: vi.fn(),
  clearPromptLogs: vi.fn(),
}));

vi.mock('../../services/logCommands', () => ({ logCommands: commands }));

import {
  clearBackendLogs,
  fetchBackendLogs,
  startBackendLogMonitoring,
  stopBackendLogMonitoring,
  useGlobalLogStore,
} from '../../services/logService';

describe('logService lifecycle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    useGlobalLogStore.setState({
      backendLogs: [],
      backendEnabled: false,
      backendError: false,
      promptLogs: '',
      promptEnabled: false,
      promptError: false,
    });
  });

  afterEach(() => {
    stopBackendLogMonitoring();
    vi.useRealTimers();
  });

  it('exposes a read failure, stops polling, and recovers on retry', async () => {
    commands.get.mockRejectedValueOnce(new Error('offline'));
    await expect(startBackendLogMonitoring()).resolves.toBe(false);
    expect(useGlobalLogStore.getState()).toMatchObject({
      backendError: true,
      backendEnabled: false,
    });

    commands.get.mockResolvedValueOnce(['recovered']);
    await expect(startBackendLogMonitoring()).resolves.toBe(true);
    expect(useGlobalLogStore.getState()).toMatchObject({
      backendError: false,
      backendEnabled: true,
      backendLogs: ['recovered'],
    });
  });

  it('drops a result that belongs to a paused monitoring generation', async () => {
    let resolve: (logs: string[]) => void = () => undefined;
    commands.get.mockImplementationOnce(
      () =>
        new Promise<string[]>((done) => {
          resolve = done;
        })
    );
    const pending = startBackendLogMonitoring();
    stopBackendLogMonitoring();
    resolve(['stale']);
    await expect(pending).resolves.toBe(false);
    expect(useGlobalLogStore.getState().backendLogs).toEqual([]);
  });

  it('keeps frontend logs when clear fails and invalidates an old read after success', async () => {
    useGlobalLogStore.setState({ backendLogs: ['before'] });
    commands.clear.mockRejectedValueOnce(new Error('denied'));
    await expect(clearBackendLogs()).rejects.toThrow('denied');
    expect(useGlobalLogStore.getState().backendLogs).toEqual(['before']);

    let resolve: (logs: string[]) => void = () => undefined;
    commands.get.mockImplementationOnce(
      () =>
        new Promise<string[]>((done) => {
          resolve = done;
        })
    );
    const pending = fetchBackendLogs();
    commands.clear.mockResolvedValueOnce(undefined);
    await clearBackendLogs();
    resolve(['stale']);
    await pending;
    expect(useGlobalLogStore.getState().backendLogs).toEqual([]);
  });
});
