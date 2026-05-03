import userEvent from '@testing-library/user-event';
import { screen, within } from '@testing-library/react';
import { renderWithProviders } from '../../test/renderWithProviders';
import { EntryList } from '../../components/EntryList';
import { useTranslationStore } from '../../store/useTranslationStore';
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

const createEntry = (overrides: Partial<POEntry> = {}): POEntry => ({
  comments: [],
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
    expect(screen.getByText('Open project')).toBeInTheDocument();
    expect(screen.getByText('Close window')).toBeInTheDocument();

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
