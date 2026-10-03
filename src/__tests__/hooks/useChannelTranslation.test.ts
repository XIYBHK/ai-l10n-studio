import { act, renderHook } from '@testing-library/react';
import { useChannelTranslation } from '../../hooks/useChannelTranslation';
import type { BatchProgressEvent } from '../../types/generated/BatchProgressEvent';
import type { BatchResultWithTaskId } from '../../types/generated/BatchResultWithTaskId';
import type { TranslationStats } from '../../types/tauri';

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock('../../services/tauriInvoke', () => ({ invoke }));

const stats: TranslationStats = {
  total: 2,
  tm_hits: 1,
  deduplicated: 0,
  ai_translated: 1,
  tm_learned: 1,
  token_stats: {
    input_tokens: 11,
    output_tokens: 3,
    total_tokens: 14,
    cost: 0.01,
    unpriced_requests: 0,
  },
};
const items: BatchResultWithTaskId['items'] = [
  { index: 0, translation: 'One', source: 'tm' },
  { index: 1, translation: 'Two', source: 'ai' },
];
function pendingRun() {
  let resolve!: (value: BatchResultWithTaskId) => void;
  let emit!: (event: BatchProgressEvent) => void;
  const promise = new Promise<BatchResultWithTaskId>((done) => {
    resolve = done;
  });
  invoke.mockImplementation((command, args) => {
    if (command === 'translate_batch_with_channel' || command === 'contextual_refine') {
      emit = args.progressChannel.onmessage;
      return promise;
    }
    return Promise.resolve();
  });
  return { resolve, emit: (event: BatchProgressEvent) => emit(event) };
}
const inputs = [
  { text: 'A', context: null },
  { text: 'B', context: 'menu' },
];

describe('useChannelTranslation', () => {
  beforeEach(() => invoke.mockReset());

  it('applies streamed items once and fills missing items from the authoritative result', async () => {
    const pending = pendingRun();
    let renders = 0;
    const { result } = renderHook(() => {
      renders++;
      return useChannelTranslation();
    });
    const onItems = vi.fn();
    let completion!: Promise<BatchResultWithTaskId>;
    act(() => {
      completion = result.current.translateBatch(inputs, 'fr', { onItems });
    });
    act(() => {
      pending.emit({ task_id: 7, processed: 1, total: 2, items: [items[0]], stats });
      pending.emit({ task_id: 7, processed: 0, total: 2, items: [items[0]], stats });
    });
    expect(renders).toBe(1);
    await act(async () => {
      pending.resolve({ task_id: 7, items, stats, cancelled: false });
      await completion;
    });
    expect(onItems.mock.calls).toEqual([[[items[0]]], [[items[1]]]]);
    expect(invoke.mock.calls[0][1]).not.toHaveProperty('statsChannel');
    expect(invoke.mock.calls[0][1].inputs).toEqual(inputs);
  });

  it('queues cancellation until the task id arrives and keeps partial completed results', async () => {
    const pending = pendingRun();
    const { result } = renderHook(useChannelTranslation);
    const onItems = vi.fn();
    let completion!: Promise<BatchResultWithTaskId>;
    act(() => {
      completion = result.current.translateBatch(inputs, 'fr', { onItems });
    });
    await act(() => result.current.cancelTranslation());
    expect(invoke).toHaveBeenCalledTimes(1);
    act(() => pending.emit({ task_id: 9, processed: 0, total: 2, items: [], stats }));
    expect(invoke).toHaveBeenCalledWith('cancel_translation', { taskId: 9 });
    await act(async () => {
      pending.resolve({ task_id: 9, items: [items[0]], stats, cancelled: true });
      await completion;
    });
    expect(onItems).toHaveBeenCalledWith([items[0]]);
  });

  it('isolates old callbacks after reset and still cancels a late task id after unmount', async () => {
    const pending = pendingRun();
    const { result, unmount } = renderHook(useChannelTranslation);
    const onItems = vi.fn();
    let completion!: Promise<BatchResultWithTaskId>;
    act(() => {
      completion = result.current.translateBatch(inputs, 'fr', { onItems });
    });
    act(() => result.current.reset());
    unmount();
    pending.emit({ task_id: 10, processed: 1, total: 2, items: [items[0]], stats });
    pending.resolve({ task_id: 10, items, stats, cancelled: true });
    await completion;
    expect(onItems).not.toHaveBeenCalled();
    expect(invoke).toHaveBeenCalledWith('cancel_translation', { taskId: 10 });
  });

  it('uses the same cancellation and authoritative items protocol for contextual refinement', async () => {
    const pending = pendingRun();
    const { result } = renderHook(useChannelTranslation);
    const onItems = vi.fn();
    const requests = [
      { msgid: 'A', msgctxt: 'menu', comment: null, previousEntry: null, nextEntry: null },
    ];
    let completion!: Promise<BatchResultWithTaskId>;
    act(() => {
      completion = result.current.translateBatch([inputs[0]], 'fr', { onItems }, requests);
    });
    await act(() => result.current.cancelTranslation());
    act(() => pending.emit({ task_id: 12, processed: 0, total: 1, items: [], stats }));
    expect(invoke.mock.calls[0][0]).toBe('contextual_refine');
    expect(invoke.mock.calls[0][1].requests).toEqual(requests);
    expect(invoke.mock.calls[0][1]).not.toHaveProperty('inputs');
    expect(invoke).toHaveBeenCalledWith('cancel_translation', { taskId: 12 });
    await act(async () => {
      pending.resolve({ task_id: 12, items: [items[0]], stats, cancelled: true });
      await completion;
    });
    expect(onItems).toHaveBeenCalledWith([items[0]]);
  });
});
