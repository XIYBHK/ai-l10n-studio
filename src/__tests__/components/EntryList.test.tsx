import userEvent from '@testing-library/user-event';
import { act, screen, within } from '@testing-library/react';
import { renderWithProviders } from '../../test/renderWithProviders';
import { EntryList } from '../../components/EntryList';
import { useTranslationStore } from '../../store/useTranslationStore';
import type { POEntry } from '../../types/tauri';
import i18n from '../../i18n/config';

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

const createEntry = (overrides: Partial<POEntry> = {}): POEntry => ({
  comments: [],
  translator_comments: '',
  msgid_plural: null,
  msgstr_plural: [],
  flags: [],
  occurrences: [],
  obsolete: false,
  previous_msgid: null,
  previous_msgid_plural: null,
  previous_msgctxt: null,
  msgctxt: '',
  msgid: '',
  msgstr: '',
  line_start: 1,
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

describe('EntryList', () => {
  beforeEach(() => {
    useTranslationStore.getState().reset();
    useTranslationStore.getState().setEntries(entries);
  });

  it('localizes compact status filters and row descriptions in English', async () => {
    await i18n.changeLanguage('en-US');
    try {
      const user = userEvent.setup();
      renderWithProviders(
        <EntryList
          entries={entries}
          currentEntry={entries[0]}
          isTranslating={false}
          progress={0}
          onEntrySelect={vi.fn()}
          onTranslateSelected={vi.fn()}
        />
      );
      expect(screen.getByText('Pending')).toBeInTheDocument();
      expect(screen.getByRole('listitem', { name: 'Item 1: Untranslated' })).toBeInTheDocument();
      await user.click(screen.getByText('Review'));
      expect(screen.getByRole('listitem', { name: 'Item 2: Needs Review' })).toBeInTheDocument();
      await user.click(screen.getByText('Open project'));
      expect(screen.getByRole('group', { name: 'Batch actions' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Confirm selected entries/ })).toBeInTheDocument();
    } finally {
      await i18n.changeLanguage('zh-CN');
    }
  });

  it('hides obsolete rows and clears selection when the same file is reopened', async () => {
    const user = userEvent.setup();
    const allEntries = [...entries, createEntry({ msgid: 'Obsolete text', obsolete: true })];
    const document = { header: null, metadata: {}, metadata_is_fuzzy: false, entries: allEntries };
    useTranslationStore.getState().setDocument(document, 'same.po');
    renderWithProviders(
      <EntryList
        entries={allEntries}
        currentEntry={allEntries[0]}
        isTranslating={false}
        progress={0}
        onEntrySelect={vi.fn()}
        onTranslateSelected={vi.fn()}
      />
    );
    expect(screen.queryByText('Obsolete text')).not.toBeInTheDocument();
    await user.click(screen.getByText('Save file'));
    expect(screen.getByRole('button', { name: /翻译选中/ })).toBeInTheDocument();
    act(() => useTranslationStore.getState().setDocument(document, 'same.po'));
    expect(screen.queryByRole('button', { name: /翻译选中/ })).not.toBeInTheDocument();
  });

  it('groups entries and submits selected untranslated entries for translation', async () => {
    const user = userEvent.setup();
    const onEntrySelect = vi.fn();
    const onTranslateSelected = vi.fn();

    renderWithProviders(
      <EntryList
        entries={entries}
        currentEntry={entries[0]}
        isTranslating={false}
        progress={0}
        onEntrySelect={onEntrySelect}
        onTranslateSelected={onTranslateSelected}
      />
    );

    expect(screen.getByText('Save file')).toBeInTheDocument();
    expect(screen.queryByText('Open project')).not.toBeInTheDocument();
    await user.click(screen.getByText('待确认', { selector: 'span' }));
    expect(screen.getByText('Open project')).toBeInTheDocument();
    await user.click(screen.getByText('已翻译', { selector: 'span' }));
    expect(screen.getByText('Close window')).toBeInTheDocument();
    await user.click(screen.getByText('未翻译', { selector: 'span' }));

    await user.click(screen.getByText('Save file'));
    expect(onEntrySelect).toHaveBeenCalledWith(entries[0]);

    await user.click(screen.getByRole('button', { name: /翻译选中/ }));
    expect(onTranslateSelected).toHaveBeenCalledWith([0]);
  });

  it('confirms selected review entries through the store action', async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <EntryList
        entries={entries}
        currentEntry={entries[1]}
        isTranslating={false}
        progress={0}
        onEntrySelect={vi.fn()}
        onContextualRefine={vi.fn()}
        onConfirmEntries={async (indices) => {
          indices.forEach((index) =>
            useTranslationStore.getState().updateEntry(index, { needsReview: false })
          );
        }}
      />
    );

    await user.click(screen.getByText('Open project'));
    await user.click(screen.getByRole('button', { name: /确认选中条目/ }));

    expect(useTranslationStore.getState().entries[1].needsReview).toBe(false);
  });

  it('submits selected review entries for contextual refine', async () => {
    const user = userEvent.setup();
    const onContextualRefine = vi.fn();

    renderWithProviders(
      <EntryList
        entries={entries}
        currentEntry={entries[1]}
        isTranslating={false}
        progress={0}
        onEntrySelect={vi.fn()}
        onContextualRefine={onContextualRefine}
      />
    );

    await user.click(screen.getByText('Open project'));

    const selectionActions = screen.getByRole('group', { name: '批量操作' });
    await user.click(within(selectionActions).getByRole('button', { name: /精翻选中/ }));

    expect(onContextualRefine).toHaveBeenCalledWith([1]);
  });
});
