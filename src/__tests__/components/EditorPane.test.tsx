import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EditorPane } from '../../components/EditorPane';
import { useTranslationStore } from '../../store/useTranslationStore';
import { renderWithProviders } from '../../test/renderWithProviders';
import type { POEntry } from '../../types/tauri';

vi.mock('../../hooks/useConfig', () => ({
  useAppData: () => ({
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

    renderWithProviders(<EditorPane entry={entry} onEntryUpdate={vi.fn()} />);

    expect(screen.getByText('Open project')).toBeInTheDocument();
    expect(screen.getByText('Shown in the file menu')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Ouvrir le projet')).toBeInTheDocument();
    expect(screen.getByText(/42/)).toBeInTheDocument();
  });

  it('saves edited translation changes through onEntryUpdate', async () => {
    const user = userEvent.setup();
    const entry = createEntry();
    const onEntryUpdate = vi.fn();
    useTranslationStore.getState().setEntries([entry]);

    renderWithProviders(<EditorPane entry={entry} onEntryUpdate={onEntryUpdate} />);

    const translationInput = screen.getByDisplayValue('Ouvrir le projet');
    await user.clear(translationInput);
    await user.type(translationInput, 'Projet ouvert');

    await user.keyboard('{Control>}{Enter}{/Control}');

    expect(onEntryUpdate).toHaveBeenCalledWith(0, {
      msgstr: 'Projet ouvert',
      needsReview: false,
    });
  });

  it('cancels unsaved edits from the toolbar and restores the original translation', async () => {
    const user = userEvent.setup();
    const entry = createEntry();
    const onEntryUpdate = vi.fn();
    useTranslationStore.getState().setEntries([entry]);

    renderWithProviders(<EditorPane entry={entry} onEntryUpdate={onEntryUpdate} />);

    const translationInput = screen.getByDisplayValue('Ouvrir le projet');
    await user.clear(translationInput);
    await user.type(translationInput, 'Draft translation');
    expect(translationInput).toHaveValue('Draft translation');

    await user.click(screen.getByRole('button', { name: /Esc/ }));

    await waitFor(() => expect(translationInput).toHaveValue('Ouvrir le projet'));
    expect(onEntryUpdate).not.toHaveBeenCalled();
  });

  it('shows the empty editor state when no entry is selected', () => {
    renderWithProviders(<EditorPane entry={null} onEntryUpdate={vi.fn()} />);

    expect(screen.getByText('Ctrl + O')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('Ouvrir le projet')).not.toBeInTheDocument();
  });
});
