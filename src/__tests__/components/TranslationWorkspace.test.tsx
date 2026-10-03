import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TranslationWorkspace } from '../../components/TranslationWorkspace';
import { useTranslationStore } from '../../store/useTranslationStore';
import { renderWithProviders } from '../../test/renderWithProviders';
import type { POEntry } from '../../types/tauri';

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: vi.fn(({ count }: { count: number }) => ({
    getTotalSize: () => count * 80,
    getVirtualItems: () =>
      Array.from({ length: count }, (_, index) => ({
        index,
        size: 80,
        start: index * 80,
      })),
  })),
}));

vi.mock('../../components/AIWorkspace', () => ({
  AIWorkspace: ({ onResetStats }: { onResetStats: () => void }) => (
    <aside aria-label="AI workspace">
      <button type="button" onClick={onResetStats}>
        Reset stats
      </button>
    </aside>
  ),
}));

vi.mock('../../hooks/useConfig', () => ({
  useActiveAIConfig: () => ({
    activeAIConfig: null,
  }),
}));

vi.mock('../../hooks/useTermLibrary', () => ({
  useTermLibrary: () => ({
    refresh: vi.fn(),
  }),
}));

vi.mock('../../hooks/useFileFormat', () => ({
  useFileFormat: () => ({
    format: 'po',
    isLoading: false,
  }),
  useFileMetadata: () => ({
    metadata: {
      total_entries: 3,
    },
    isLoading: false,
  }),
}));

const createEntry = (overrides: Partial<POEntry> = {}): POEntry => ({
  comments: [],
  msgctxt: '',
  msgid: '',
  msgstr: '',
  line_start: 1,
  translator_comments: '',
  msgid_plural: null,
  msgstr_plural: [],
  flags: [],
  occurrences: [],
  obsolete: false,
  previous_msgid: null,
  previous_msgid_plural: null,
  previous_msgctxt: null,
  ...overrides,
});

const entries: POEntry[] = [
  createEntry({ msgid: 'Save file', line_start: 10 }),
  createEntry({
    msgid: 'Open project',
    msgstr: 'Ouvrir le projet',
    needsReview: true,
    translationSource: 'ai',
    line_start: 20,
  }),
  createEntry({ msgid: 'Close window', msgstr: 'Fermer la fenetre', line_start: 30 }),
];

const renderWorkspace = (overrides: Partial<Parameters<typeof TranslationWorkspace>[0]> = {}) => {
  const props = {
    entries,
    currentEntry: entries[1],
    isTranslating: false,
    progress: 0,
    currentFilePath: 'C:\\projects\\messages.po',
    onEntrySelect: vi.fn(),
    onTranslateSelected: vi.fn(),
    onContextualRefine: vi.fn(),
    onConfirmEntries: vi.fn().mockResolvedValue(undefined),
    onResetStats: vi.fn(),
    ...overrides,
  };

  useTranslationStore.getState().setEntries(entries);
  useTranslationStore.getState().setCurrentEntry(props.currentEntry);

  renderWithProviders(<TranslationWorkspace {...props} />);

  return props;
};

describe('TranslationWorkspace', () => {
  beforeEach(() => {
    useTranslationStore.getState().reset();
  });

  it('offers file import before a document is opened', async () => {
    const user = userEvent.setup();
    const onOpenFile = vi.fn();
    renderWorkspace({ entries: [], currentEntry: null, currentFilePath: null, onOpenFile });
    expect(screen.getByRole('heading', { name: '让文字，自在跨越语言。' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /导入/ }));
    expect(onOpenFile).toHaveBeenCalledOnce();
  });

  it('renders the list, editor, AI panel, and file info together', async () => {
    renderWorkspace();

    expect(screen.queryByText('Save file')).not.toBeInTheDocument();
    expect(screen.getAllByText('Open project')).toHaveLength(2);
    expect(screen.getByDisplayValue('Ouvrir le projet')).toBeInTheDocument();
    expect(await screen.findByRole('complementary', { name: 'AI workspace' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'messages.po' })).toBeInTheDocument();
    expect(screen.getByText('共 3 条条目')).toBeInTheDocument();
  });

  it('routes list selections and selected translation actions to workspace callbacks', async () => {
    const user = userEvent.setup();
    const props = renderWorkspace();

    await user.click(screen.getByText('未翻译', { selector: 'span' }));
    await user.click(screen.getByText('Save file'));
    expect(props.onEntrySelect).toHaveBeenCalledWith(entries[0]);

    await user.click(screen.getByRole('button', { name: /翻译选中/ }));
    expect(props.onTranslateSelected).toHaveBeenCalledWith([0]);
  });

  it('routes editor saves and stats reset to workspace callbacks', async () => {
    const user = userEvent.setup();
    const props = renderWorkspace({ currentEntry: entries[2] });

    const translationInput = screen.getByDisplayValue('Fermer la fenetre');
    await user.clear(translationInput);
    await user.type(translationInput, 'Fermer la fenetre active');
    await user.keyboard('{Control>}{Enter}{/Control}');

    expect(props.onConfirmEntries).toHaveBeenCalledWith([2]);

    const aiPanel = await screen.findByRole('complementary', { name: 'AI workspace' });
    await user.click(within(aiPanel).getByRole('button', { name: 'Reset stats' }));

    expect(props.onResetStats).toHaveBeenCalled();
  });
});
