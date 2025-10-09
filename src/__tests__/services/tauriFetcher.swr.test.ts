// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { tauriFetcher } from '../../services/swr';

const invokeMock = vi.fn();
vi.mock('../../services/api', () => ({
  invoke: (...args: any[]) => invokeMock(...args),
}));

describe('tauriFetcher', () => {
  beforeEach(() => invokeMock.mockReset());

  it('calls invoke with string key', async () => {
    invokeMock.mockResolvedValueOnce('ok');
    const data = await tauriFetcher('get_app_config');
    expect(data).toBe('ok');
    const [cmd, args, opts] = invokeMock.mock.calls[0];
    expect(cmd).toBe('get_app_config');
    expect(args).toBeUndefined();
    expect(opts).toMatchObject({ showErrorMessage: false, silent: true, dedup: true });
  });

  it('calls invoke with tuple key', async () => {
    invokeMock.mockResolvedValueOnce({});
    await tauriFetcher(['get_file_metadata', { filePath: '/a.po' }]);
    const [cmd, args, opts] = invokeMock.mock.calls[0];
    expect(cmd).toBe('get_file_metadata');
    expect(args).toEqual({ filePath: '/a.po' });
    expect(opts).toMatchObject({ showErrorMessage: false, silent: true, dedup: true });
  });

  it('throws on invalid key', async () => {
    await expect(tauriFetcher(123 as unknown as any)).rejects.toThrow();
  });
});


