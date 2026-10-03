import { act, renderHook } from '@testing-library/react';
import { TestProviders } from '../../test/renderWithProviders';
import { useTranslationFlow } from '../../hooks/useTranslationFlow';
import { useTranslationStore } from '../../store/useTranslationStore';
import { useSessionStore } from '../../store/useSessionStore';
import type { PODocument, POEntry, TranslationStats } from '../../types/tauri';
import type { TranslationCallbacks } from '../../hooks/useChannelTranslation';

const mocks = vi.hoisted(() => ({
  parse: vi.fn(),
  save: vi.fn(),
  openFile: vi.fn(),
  saveFile: vi.fn(),
  translateBatch: vi.fn(),
  cancelTranslation: vi.fn(),
  cancelAndWait: vi.fn(),
  reset: vi.fn(),
  detectLanguage: vi.fn(),
  getDefaultTargetLanguage: vi.fn(),
  mutate: vi.fn(),
  askTargetDocument: vi.fn(),
}));
vi.mock('swr', async (importOriginal) => ({
  ...(await importOriginal<typeof import('swr')>()),
  useSWRConfig: () => ({ mutate: mocks.mutate }),
}));
vi.mock('../../services/fileCommands', () => ({
  poFileCommands: { parse: mocks.parse, save: mocks.save },
  dialogCommands: { openFile: mocks.openFile, saveFile: mocks.saveFile },
}));
vi.mock('../../hooks/useChannelTranslation', () => ({
  useChannelTranslation: () => ({
    translateBatch: mocks.translateBatch,
    cancelTranslation: mocks.cancelTranslation,
    cancelAndWait: mocks.cancelAndWait,
    reset: mocks.reset,
  }),
}));
vi.mock('../../services/translationCommands', () => ({
  i18nCommands: {
    detectLanguage: mocks.detectLanguage,
    getDefaultTargetLanguage: mocks.getDefaultTargetLanguage,
  },
}));
vi.mock('@tauri-apps/api/webviewWindow', () => ({
  getCurrentWebviewWindow: () => ({
    onDragDropEvent: async () => vi.fn(),
    onCloseRequested: async () => vi.fn(),
    close: vi.fn(),
  }),
}));

function document(msgid: string): PODocument {
  const entry: POEntry = {
    comments: [],
    translator_comments: '',
    msgctxt: 'menu',
    msgid,
    msgstr: '',
    line_start: 3,
    msgid_plural: null,
    msgstr_plural: [],
    flags: [],
    occurrences: [],
    obsolete: false,
    previous_msgid: null,
    previous_msgid_plural: null,
    previous_msgctxt: null,
  };
  return {
    header: 'Header',
    metadata: { Language: 'fr', 'Plural-Forms': 'nplurals=2; plural=n>1;' },
    metadata_is_fuzzy: true,
    entries: [entry, { ...entry, msgid: 'Removed', obsolete: true }],
  };
}

describe('useTranslationFlow document boundaries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useTranslationStore.getState().reset();
    useSessionStore.getState().resetSessionStats();
    useSessionStore.getState().setTranslating(false);
    mocks.detectLanguage.mockResolvedValue({ code: 'en', display_name: 'English' });
    mocks.getDefaultTargetLanguage.mockResolvedValue({ code: 'zh-CN', display_name: 'Chinese' });
    mocks.cancelTranslation.mockResolvedValue(undefined);
    mocks.cancelAndWait.mockResolvedValue(undefined);
    mocks.askTargetDocument.mockResolvedValue(true);
  });

  it('ignores a stale parse and saves the complete newer document', async () => {
    let resolveFirst!: (value: PODocument) => void;
    mocks.parse
      .mockImplementationOnce(
        () =>
          new Promise<PODocument>((resolve) => {
            resolveFirst = resolve;
          })
      )
      .mockResolvedValueOnce(document('New'));
    mocks.openFile.mockResolvedValueOnce('old.po').mockResolvedValueOnce('new.po');
    const { result } = renderHook(useTranslationFlow, { wrapper: TestProviders });
    let first!: Promise<void>;
    await act(async () => {
      first = result.current.openFile();
      await Promise.resolve();
    });
    await act(() => result.current.openFile());
    await act(async () => {
      resolveFirst(document('Old'));
      await first;
    });
    expect(result.current.currentFilePath).toBe('new.po');
    expect(result.current.entries[0].msgid).toBe('New');
    expect(result.current.targetLanguage).toBe('fr');
    expect(mocks.getDefaultTargetLanguage).not.toHaveBeenCalled();
    await act(() => result.current.saveFile());
    expect(mocks.save).toHaveBeenCalledWith('new.po', document('New'));
  });

  it('maps plural slots in one update, counts cumulative stats once and isolates reopened files', async () => {
    const doc = document('File');
    doc.entries[0].msgid_plural = 'Files';
    doc.entries[0].msgstr_plural = [];
    useTranslationStore.getState().setDocument(doc, 'same.po');
    let callbacks!: TranslationCallbacks;
    let finish!: (value: { stats: TranslationStats }) => void;
    mocks.translateBatch.mockImplementation((_inputs, _language, cb) => {
      callbacks = cb;
      return new Promise<{ stats: TranslationStats }>((resolve) => {
        finish = resolve;
      });
    });
    const { result } = renderHook(useTranslationFlow, { wrapper: TestProviders });
    let completion!: Promise<void>;
    act(() => {
      completion = result.current.translateAll();
    });
    const stats: TranslationStats = {
      total: 2,
      tm_hits: 1,
      deduplicated: 0,
      ai_translated: 1,
      tm_learned: 1,
      token_stats: {
        input_tokens: 5,
        output_tokens: 2,
        total_tokens: 7,
        cost: 0.01,
        unpriced_requests: 0,
      },
    };
    const listener = vi.fn();
    const unsubscribe = useTranslationStore.subscribe(listener);
    act(() => {
      callbacks.onItems?.([
        { index: 0, translation: 'Fichier', source: 'tm' },
        { index: 1, translation: 'Fichiers', source: 'ai' },
      ]);
      callbacks.onStats?.(stats);
      callbacks.onStats?.(stats);
    });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(result.current.entries[0].msgstr_plural).toEqual(['Fichier', 'Fichiers']);
    expect(useSessionStore.getState().sessionStats).toEqual(stats);
    expect(mocks.translateBatch.mock.calls[0][0]).toHaveLength(2);
    mocks.openFile.mockResolvedValue('same.po');
    mocks.parse.mockResolvedValue(document('Reopened'));
    await act(() => result.current.openFile());
    await act(async () => {
      callbacks.onItems?.([{ index: 0, translation: 'Late', source: 'ai' }]);
      callbacks.onStats?.(stats);
      finish({ stats });
      await completion;
    });
    expect(result.current.entries[0].msgstr).toBe('');
    expect(result.current.entries[0].msgid).toBe('Reopened');
    expect(useSessionStore.getState().sessionStats.total).toBe(0);
    expect(result.current.isTranslating).toBe(false);
    unsubscribe();
  });

  it('accounts for contextual refinement using its generated result statistics', async () => {
    const doc = document('File');
    useTranslationStore.getState().setDocument(doc, 'refine.po');
    useTranslationStore.getState().updateEntry(0, { needsReview: true, msgstr: 'Old translation' });
    const stats: TranslationStats = {
      total: 1,
      tm_hits: 0,
      deduplicated: 0,
      ai_translated: 1,
      tm_learned: 1,
      token_stats: {
        input_tokens: 4,
        output_tokens: 2,
        total_tokens: 6,
        cost: 0.01,
        unpriced_requests: 0,
      },
    };
    mocks.translateBatch.mockImplementation(async (_inputs, _language, callbacks) => {
      callbacks.onItems([{ index: 0, translation: 'Fichier', source: 'ai' }]);
      callbacks.onStats(stats);
      return { task_id: 'task-1', items: [], cancelled: false, stats };
    });
    const { result } = renderHook(useTranslationFlow, { wrapper: TestProviders });
    await act(() => result.current.handleContextualRefine([0]));
    expect(result.current.entries[0].msgstr).toBe('Fichier');
    expect(useSessionStore.getState().sessionStats).toEqual(stats);
    expect(mocks.translateBatch.mock.calls[0][3][0].msgctxt).toContain('menu');
    expect(mocks.mutate).toHaveBeenCalledWith('translation_memory');
    expect(mocks.mutate).toHaveBeenCalledWith('term_library');
  });

  it('creates a fresh Japanese target document with one plural slot and no old translations', async () => {
    const doc = document('File');
    doc.entries[0].msgid_plural = 'Files';
    doc.entries[0].msgstr = 'Ancienne';
    doc.entries[0].msgstr_plural = ['Ancienne', 'Anciennes'];
    useTranslationStore.getState().setDocument(doc, 'source.po');
    const { result } = renderHook(useTranslationFlow, { wrapper: TestProviders });

    await act(async () => result.current.changeTargetLanguage('ja'));

    expect(mocks.askTargetDocument).toHaveBeenCalledOnce();
    expect(result.current.currentFilePath).toBeNull();
    expect(result.current.targetLanguage).toBe('ja');
    expect(result.current.entries[0].msgstr).toBe('');
    expect(result.current.entries[0].msgstr_plural).toEqual(['']);
    expect(useTranslationStore.getState().document?.metadata).toMatchObject({
      Language: 'ja',
      'Plural-Forms': 'nplurals=1; plural=0;',
    });
  });
});
vi.mock('../../services/documentActions', () => ({
  confirmDocumentEntries: vi.fn().mockResolvedValue(false),
}));
vi.mock('../../components/UnsavedDocumentDialog', () => ({
  askUnsavedDocument: vi.fn().mockResolvedValue('discard'),
  askTargetDocument: mocks.askTargetDocument,
}));
