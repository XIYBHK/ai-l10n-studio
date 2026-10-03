import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EditorPane } from '../../components/EditorPane';
import { useTranslationStore } from '../../store/useTranslationStore';
import { renderWithProviders } from '../../test/renderWithProviders';
import type { POEntry } from '../../types/tauri';

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
  msgid: 'Open project',
  msgstr: 'Ouvrir le projet',
  line_start: 42,
  ...overrides,
});

describe('EditorPane', () => {
  beforeEach(() => {
    useTranslationStore.getState().reset();
  });

  it('renders the current entry source and translation', () => {
    const entry = createEntry({
      comments: ['Shown in the file menu'],
      msgctxt: 'menu.file',
    });
    useTranslationStore.getState().setEntries([entry]);

    renderWithProviders(<EditorPane entry={entry} onConfirmEntries={async () => {}} />);

    expect(screen.getByText('Open project')).toBeInTheDocument();
    expect(screen.getByText('Shown in the file menu')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Ouvrir le projet')).toBeInTheDocument();
    expect(screen.getByText(/42/)).toBeInTheDocument();
  });

  it('saves edited translation changes through onEntryUpdate', async () => {
    const user = userEvent.setup();
    const entry = createEntry();
    const onConfirmEntries = vi.fn().mockResolvedValue(undefined);
    useTranslationStore.getState().setEntries([entry]);

    renderWithProviders(<EditorPane entry={entry} onConfirmEntries={onConfirmEntries} />);

    const translationInput = screen.getByDisplayValue('Ouvrir le projet');
    await user.clear(translationInput);
    await user.type(translationInput, 'Projet ouvert');

    await user.keyboard('{Control>}{Enter}{/Control}');

    expect(onConfirmEntries).toHaveBeenCalledWith([0]);
  });

  it('cancels unsaved edits from the toolbar and restores the original translation', async () => {
    const user = userEvent.setup();
    const entry = createEntry();
    const onConfirmEntries = vi.fn().mockResolvedValue(undefined);
    useTranslationStore.getState().setEntries([entry]);

    renderWithProviders(<EditorPane entry={entry} onConfirmEntries={onConfirmEntries} />);

    const translationInput = screen.getByDisplayValue('Ouvrir le projet');
    await user.clear(translationInput);
    await user.type(translationInput, 'Draft translation');
    expect(translationInput).toHaveValue('Draft translation');

    await user.click(screen.getByRole('button', { name: /Esc/ }));

    await waitFor(() => expect(translationInput).toHaveValue('Ouvrir le projet'));
    expect(onConfirmEntries).not.toHaveBeenCalled();
  });

  it('shows the empty editor state when no entry is selected', () => {
    renderWithProviders(<EditorPane entry={null} onConfirmEntries={async () => {}} />);

    expect(screen.getByText('Ctrl + O')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('Ouvrir le projet')).not.toBeInTheDocument();
  });

  it('edits the selected plural form without replacing the other forms', async () => {
    const user = userEvent.setup();
    const entry = createEntry({
      msgid: 'File',
      msgid_plural: 'Files',
      msgstr: '',
      msgstr_plural: ['Fichier', 'Fichiers'],
    });
    useTranslationStore.getState().setDocument(
      {
        header: null,
        metadata: { 'Plural-Forms': 'nplurals=2; plural=n>1;' },
        metadata_is_fuzzy: false,
        entries: [entry],
      },
      'plural.po'
    );
    const onConfirmEntries = vi.fn().mockResolvedValue(undefined);
    renderWithProviders(
      <EditorPane
        entry={useTranslationStore.getState().entries[0]}
        onConfirmEntries={onConfirmEntries}
      />
    );
    await user.selectOptions(screen.getByRole('combobox'), '1');
    const input = screen.getByDisplayValue('Fichiers');
    await user.clear(input);
    await user.type(input, 'Plusieurs fichiers');
    await user.keyboard('{Control>}{Enter}{/Control}');
    expect(onConfirmEntries).toHaveBeenCalledWith([0]);
  });
});
