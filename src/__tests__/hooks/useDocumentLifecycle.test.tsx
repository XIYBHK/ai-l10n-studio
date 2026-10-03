import { act, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useTranslationFlow } from '../../hooks/useTranslationFlow';
import { useTranslationStore, selectDocumentDirty } from '../../store/useTranslationStore';
import { confirmDocumentEntries } from '../../services/documentActions';
import { EditorPane } from '../../components/EditorPane';
import { renderWithProviders, TestProviders } from '../../test/renderWithProviders';
import type { PODocument, TranslationStats } from '../../types/tauri';
import type { TranslationCallbacks } from '../../hooks/useChannelTranslation';
import type { BatchResultWithTaskId } from '../../types/generated/BatchResultWithTaskId';

const mocks = vi.hoisted(() => ({
  parse: vi.fn(),
  save: vi.fn(),
  open: vi.fn(),
  saveDialog: vi.fn(),
  translate: vi.fn(),
  cancel: vi.fn(),
  confirm: vi.fn(),
  mutate: vi.fn(),
  unsaved: vi.fn(),
  target: vi.fn(),
  destroy: vi.fn(),
  closeHandler: null as null | ((event: { preventDefault: () => void }) => void),
}));
vi.mock('swr', async (original) => ({
  ...(await original<typeof import('swr')>()),
  useSWRConfig: () => ({ mutate: mocks.mutate }),
}));
vi.mock('../../services/fileCommands', () => ({
  poFileCommands: { parse: mocks.parse, save: mocks.save },
  dialogCommands: { openFile: mocks.open, saveFile: mocks.saveDialog },
}));
vi.mock('../../services/termCommands', () => ({
  translationMemoryCommands: { confirm: mocks.confirm },
}));
vi.mock('../../services/translationCommands', () => ({
  i18nCommands: { detectLanguage: async () => ({ code: 'en' }) },
}));
vi.mock('../../hooks/useChannelTranslation', () => ({
  useChannelTranslation: () => ({
    translateBatch: mocks.translate,
    cancelTranslation: mocks.cancel,
    cancelAndWait: mocks.cancel,
    reset: vi.fn(),
  }),
}));
vi.mock('../../components/UnsavedDocumentDialog', () => ({
  askUnsavedDocument: mocks.unsaved,
  askTargetDocument: mocks.target,
}));
vi.mock('@tauri-apps/api/webviewWindow', () => ({
  getCurrentWebviewWindow: () => ({
    onDragDropEvent: async () => vi.fn(),
    destroy: mocks.destroy,
    onCloseRequested: async (handler: typeof mocks.closeHandler) => {
      mocks.closeHandler = handler;
      return vi.fn();
    },
  }),
}));
vi.mock('../../store/tauriStore', () => ({
  tauriStore: { updateCumulativeStats: async () => {} },
}));
vi.mock('../../utils/notificationManager', () => ({
  notificationManager: {
    translationComplete: vi.fn(),
    translationError: vi.fn(),
  },
}));
vi.mock('../../hooks/useConfig', () => ({ useActiveAIConfig: () => ({ activeAIConfig: null }) }));
vi.mock('../../hooks/useTermLibrary', () => ({
  TERM_LIBRARY_KEY: 'term_library',
  useTermLibrary: () => ({ refresh: vi.fn() }),
}));

function document(name = 'Open'): PODocument {
  return {
    header: null,
    metadata: { Language: 'fr', 'Plural-Forms': 'nplurals=2; plural=n>1;' },
    metadata_is_fuzzy: false,
    entries: [0, 1].map((index) => ({
      comments: [],
      translator_comments: '',
      msgctxt: 'menu',
      msgid: `${name} ${index}`,
      msgstr: '',
      line_start: index + 3,
      msgid_plural: null,
      msgstr_plural: [],
      flags: [],
      occurrences: [],
      obsolete: false,
      previous_msgid: null,
      previous_msgid_plural: null,
      previous_msgctxt: null,
    })),
  };
}
const stats: TranslationStats = {
  total: 1,
  tm_hits: 0,
  deduplicated: 0,
  ai_translated: 1,
  tm_learned: 0,
  token_stats: {
    input_tokens: 1,
    output_tokens: 1,
    total_tokens: 2,
    cost: 0,
    unpriced_requests: 1,
  },
};
const batchResult: BatchResultWithTaskId = { task_id: 1, items: [], cancelled: true, stats };

describe('document lifecycle regressions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useTranslationStore.getState().reset();
    useTranslationStore.getState().setDocument(document(), 'current.po');
    mocks.open.mockResolvedValue('next.po');
    mocks.parse.mockResolvedValue(document('Next'));
    mocks.save.mockResolvedValue(undefined);
    mocks.saveDialog.mockResolvedValue('output.po');
    mocks.confirm.mockImplementation(async (pairs: unknown[]) => pairs.length);
    mocks.unsaved.mockResolvedValue('cancel');
    mocks.target.mockResolvedValue(true);
    mocks.cancel.mockResolvedValue(undefined);
    mocks.destroy.mockReset().mockResolvedValue(undefined);
  });

  it('saves text still focused in the real editor and retains drafts across entry navigation', async () => {
    const user = userEvent.setup();
    const { result } = renderHook(useTranslationFlow, { wrapper: TestProviders });
    const entry = useTranslationStore.getState().entries[0];
    const view = renderWithProviders(
      <EditorPane entry={entry} onConfirmEntries={result.current.confirmEntries} />
    );
    const input = screen.getByRole('textbox', { name: '译文编辑' });
    await user.type(input, 'Human draft');
    view.rerender(
      <EditorPane
        entry={useTranslationStore.getState().entries[1]}
        onConfirmEntries={result.current.confirmEntries}
      />
    );
    view.rerender(<EditorPane entry={entry} onConfirmEntries={result.current.confirmEntries} />);
    expect(screen.getByRole('textbox', { name: '译文编辑' })).toHaveValue('Human draft');
    await user.click(screen.getByRole('textbox', { name: '译文编辑' }));
    expect(screen.getByRole('textbox', { name: '译文编辑' })).toHaveFocus();
    await act(() => result.current.saveFile());
    expect(mocks.save.mock.calls[0][1].entries[0].msgstr).toBe('Human draft');
    expect(mocks.confirm).toHaveBeenCalledWith([
      { source: 'Open 0', translation: 'Human draft', context: 'menu', language: 'fr' },
    ]);
    expect(selectDocumentDirty(useTranslationStore.getState())).toBe(false);
  });

  it('keeps the original dirty document on cancel or failed save, and switches on discard', async () => {
    useTranslationStore.getState().updateEntry(0, { msgstr: 'Human edit' });
    const { result } = renderHook(useTranslationFlow, { wrapper: TestProviders });
    await act(() => result.current.openFile());
    expect(result.current.currentFilePath).toBe('current.po');
    expect(mocks.parse).not.toHaveBeenCalled();
    mocks.unsaved.mockResolvedValue('save');
    mocks.save.mockRejectedValueOnce(new Error('Disk full'));
    await act(() => result.current.openFile());
    expect(result.current.entries[0].msgstr).toBe('Human edit');
    expect(mocks.parse).not.toHaveBeenCalled();
    mocks.unsaved.mockResolvedValue('discard');
    await act(() => result.current.openFile());
    expect(result.current.currentFilePath).toBe('next.po');
  });

  it('captures edits made while the save dialog or confirmation transaction is pending', async () => {
    let choose!: (path: string) => void;
    mocks.saveDialog.mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          choose = resolve;
        })
    );
    const { result } = renderHook(useTranslationFlow, { wrapper: TestProviders });
    let saved!: Promise<boolean>;
    act(() => {
      saved = result.current.saveAsFile();
    });
    act(() => useTranslationStore.getState().setDraft(0, null, 'During dialog'));
    let confirm!: (count: number) => void;
    mocks.confirm.mockImplementation(
      () =>
        new Promise<number>((resolve) => {
          confirm = resolve;
        })
    );
    await act(async () => {
      choose('brand-new.po');
      await Promise.resolve();
    });
    act(() => useTranslationStore.getState().setDraft(0, null, 'During memory write'));
    await act(async () => {
      confirm(1);
      await saved;
    });
    const file = mocks.save.mock.calls[0][1];
    expect(file.entries[0].msgstr).toBe('During memory write');
    expect(file.entries[0].flags).toContain('fuzzy');
    expect(result.current.currentFilePath).toBe('brand-new.po');
  });

  it.each(['draft', 'committed'])('protects %s human edits from a late AI result', async (kind) => {
    let callback!: TranslationCallbacks;
    let finish!: (value: BatchResultWithTaskId) => void;
    mocks.translate.mockImplementation((_inputs, _language, callbacks) => {
      callback = callbacks;
      return new Promise<BatchResultWithTaskId>((resolve) => {
        finish = resolve;
      });
    });
    const { result } = renderHook(useTranslationFlow, { wrapper: TestProviders });
    let running!: Promise<void>;
    act(() => {
      running = result.current.handleTranslateSelected([0]);
    });
    act(() => {
      if (kind === 'draft') useTranslationStore.getState().setDraft(0, null, 'Human');
      else useTranslationStore.getState().updateEntry(0, { msgstr: 'Human', needsReview: false });
      callback.onItems?.([{ index: 0, translation: 'Late AI', source: 'ai' }]);
    });
    expect(useTranslationStore.getState().entries[0].msgstr).toBe(kind === 'draft' ? '' : 'Human');
    await act(async () => {
      finish(batchResult);
      await running;
    });
    if (kind === 'draft')
      expect(Object.values(useTranslationStore.getState().drafts)[0].value).toBe('Human');
  });

  it('does not mark newer edits confirmed after a pending memory write', async () => {
    useTranslationStore.getState().setDraft(0, null, 'Reviewed');
    let finish!: (count: number) => void;
    mocks.confirm.mockImplementation(
      () =>
        new Promise<number>((resolve) => {
          finish = resolve;
        })
    );
    const confirming = confirmDocumentEntries([0]);
    await Promise.resolve();
    await Promise.resolve();
    useTranslationStore.getState().setDraft(0, null, 'New draft');
    finish(1);
    await confirming;
    expect(useTranslationStore.getState().entries[0].needsReview).toBe(true);
    expect(Object.values(useTranslationStore.getState().drafts)[0].value).toBe('New draft');
  });

  it('prevents closing a dirty window until the chosen save has succeeded', async () => {
    useTranslationStore.getState().setDraft(0, null, 'Keep me');
    renderHook(useTranslationFlow, { wrapper: TestProviders });
    const preventDefault = vi.fn();
    await act(async () => {
      mocks.closeHandler?.({ preventDefault });
      await Promise.resolve();
    });
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(mocks.destroy).not.toHaveBeenCalled();
    mocks.unsaved.mockResolvedValue('save');
    await act(async () => {
      mocks.closeHandler?.({ preventDefault });
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(mocks.destroy).toHaveBeenCalledOnce();
    expect(mocks.save.mock.calls[0][1].entries[0].msgstr).toBe('Keep me');
  });

  it('destroys a clean window without a second close request', async () => {
    renderHook(useTranslationFlow, { wrapper: TestProviders });
    const preventDefault = vi.fn();
    await act(async () => {
      mocks.closeHandler?.({ preventDefault });
    });
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(mocks.unsaved).not.toHaveBeenCalled();
    expect(mocks.destroy).toHaveBeenCalledOnce();
  });

  it('prevents repeated close requests from bypassing a pending unsaved prompt', async () => {
    useTranslationStore.getState().setDraft(0, null, 'Keep me');
    let choose!: (choice: 'cancel' | 'discard') => void;
    mocks.unsaved.mockImplementationOnce(
      () =>
        new Promise<'cancel' | 'discard'>((resolve) => {
          choose = resolve;
        })
    );
    renderHook(useTranslationFlow, { wrapper: TestProviders });
    const preventDefault = vi.fn();
    await act(async () => {
      mocks.closeHandler?.({ preventDefault });
      mocks.closeHandler?.({ preventDefault });
    });
    expect(preventDefault).toHaveBeenCalledTimes(2);
    expect(mocks.unsaved).toHaveBeenCalledOnce();
    expect(mocks.destroy).not.toHaveBeenCalled();
    await act(async () => choose('cancel'));
    expect(Object.values(useTranslationStore.getState().drafts)[0].value).toBe('Keep me');
    expect(mocks.destroy).not.toHaveBeenCalled();
    mocks.unsaved.mockResolvedValueOnce('discard');
    await act(async () => mocks.closeHandler?.({ preventDefault }));
    expect(mocks.destroy).toHaveBeenCalledOnce();
  });

  it('shows a native destroy failure and permits retry instead of silently allowing a close', async () => {
    mocks.destroy.mockRejectedValueOnce(new Error('native close denied'));
    renderHook(useTranslationFlow, { wrapper: TestProviders });
    const preventDefault = vi.fn();
    await act(async () => mocks.closeHandler?.({ preventDefault }));
    expect(await screen.findByText(/native close denied/)).toBeInTheDocument();
    await act(async () => mocks.closeHandler?.({ preventDefault }));
    expect(preventDefault).toHaveBeenCalledTimes(2);
    expect(mocks.destroy).toHaveBeenCalledTimes(2);
  });

  it('waits for cancellation of a running translation before destroying the window', async () => {
    let finish!: (value: BatchResultWithTaskId) => void;
    mocks.translate.mockImplementationOnce(
      () =>
        new Promise<BatchResultWithTaskId>((resolve) => {
          finish = resolve;
        })
    );
    let releaseCancellation!: () => void;
    mocks.cancel.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          releaseCancellation = () => {
            finish(batchResult);
            resolve();
          };
        })
    );
    const { result } = renderHook(useTranslationFlow, { wrapper: TestProviders });
    let translating!: Promise<void>;
    act(() => {
      translating = result.current.handleTranslateSelected([0]);
    });
    const preventDefault = vi.fn();
    await act(async () => mocks.closeHandler?.({ preventDefault }));
    expect(mocks.cancel).toHaveBeenCalledOnce();
    expect(mocks.destroy).not.toHaveBeenCalled();
    await act(async () => {
      releaseCancellation();
      await translating;
    });
    expect(mocks.destroy).toHaveBeenCalledOnce();
  });
});
