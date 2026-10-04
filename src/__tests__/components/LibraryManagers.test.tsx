import { screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryManager } from '../../components/MemoryManager';
import { TermLibraryManager } from '../../components/TermLibraryManager';
import { renderWithProviders } from '../../test/renderWithProviders';
import type { TranslationMemory } from '../../types/tauri';
import { buildMemoryKey } from '../../utils/translationMemory';

const mocks = vi.hoisted(() => ({
  memory: null as TranslationMemory | null,
  save: vi.fn(),
  add: vi.fn(),
  remove: vi.fn(),
  mutate: vi.fn(),
}));
vi.mock('../../hooks/useTranslationMemory', () => ({
  useTranslationMemory: () => ({ tm: mocks.memory, isLoading: false, mutate: mocks.mutate }),
}));
vi.mock('../../hooks/useLanguage', () => ({ useSupportedLanguages: () => ({ languages: [] }) }));
vi.mock('../../hooks/useConfig', () => ({ useActiveAIConfig: () => ({ activeAIConfig: null }) }));
vi.mock('../../store', () => ({
  useTargetLanguage: () => 'fr',
  useStatsStore: { getState: () => ({ cumulativeStats: {}, setCumulativeStats: vi.fn() }) },
}));
vi.mock('../../services/termCommands', () => ({
  translationMemoryCommands: { save: mocks.save },
  termLibraryCommands: { addTerm: mocks.add, removeTerm: mocks.remove },
}));
vi.mock('../../hooks/useTermLibrary', () => ({
  useTermLibrary: () => ({
    refresh: mocks.mutate,
    mutate: mocks.mutate,
    termLibrary: {
      revision: 1,
      metadata: { total_terms: 2, terms_at_last_summary: 0 },
      terms: [
        {
          source: 'Open',
          user_translation: 'Open EN',
          ai_translation: 'AI EN',
          language: 'en',
          context: 'en-menu',
          frequency: 1,
          created_at: '2026-10-03T00:00:00Z',
        },
        {
          source: 'Open',
          user_translation: 'Ouvrir FR',
          ai_translation: 'AI FR',
          language: 'fr',
          context: 'fr-menu',
          frequency: 1,
          created_at: '2026-10-03T00:00:00Z',
        },
      ],
    },
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.memory = {
    revision: 1,
    memory: { [buildMemoryKey('Open', 'menu', 'fr')]: 'Before' },
    stats: { total_entries: 1, hits: 3, misses: 1 },
    last_updated: '2026-10-03T00:00:00Z',
  };
});

it('preserves manager drafts and their original revision when background memory changes', async () => {
  const user = userEvent.setup();
  const onClose = vi.fn();
  const view = renderWithProviders(<MemoryManager visible onClose={onClose} />);
  const input = await screen.findByDisplayValue('Before');
  await user.clear(input);
  await user.type(input, 'Human draft');
  mocks.memory = {
    ...mocks.memory!,
    revision: 2,
    memory: { [buildMemoryKey('Open', 'menu', 'fr')]: 'Background change' },
  };
  view.rerender(<MemoryManager visible onClose={onClose} />);
  expect(screen.getByDisplayValue('Human draft')).toBeInTheDocument();
  mocks.save.mockRejectedValueOnce(new Error('revision conflict'));
  await user.click(screen.getByRole('button', { name: /保.*存/ }));
  await waitFor(() => expect(mocks.save).toHaveBeenCalledOnce());
  expect(mocks.save.mock.calls[0][0].revision).toBe(1);
  expect(mocks.save.mock.calls[0][0].memory[buildMemoryKey('Open', 'menu', 'fr')]).toBe(
    'Human draft'
  );
  expect(onClose).not.toHaveBeenCalled();
  expect(screen.getByDisplayValue('Human draft')).toBeInTheDocument();
}, 15000);

it('asks before closing a dirty memory draft and keeps it when cancelled', async () => {
  const user = userEvent.setup();
  const onClose = vi.fn();
  renderWithProviders(<MemoryManager visible onClose={onClose} />);
  const input = await screen.findByDisplayValue('Before');
  await user.clear(input);
  await user.type(input, 'Draft');
  await user.click(screen.getByRole('button', { name: /取.*消|cancel/i }));

  const dialogs = await screen.findAllByRole('dialog');
  const dialog = dialogs[dialogs.length - 1];
  expect(onClose).not.toHaveBeenCalled();
  const dialogButtons = within(dialog).getAllByRole('button');
  await user.click(dialogButtons[0]);
  expect(onClose).not.toHaveBeenCalled();
  expect(screen.getByDisplayValue('Draft')).toBeInTheDocument();
});

it('discards a dirty memory draft only after confirmation', async () => {
  const user = userEvent.setup();
  const onClose = vi.fn();
  renderWithProviders(<MemoryManager visible onClose={onClose} />);
  const input = await screen.findByDisplayValue('Before');
  await user.clear(input);
  await user.type(input, 'Draft');
  await user.click(screen.getByRole('button', { name: /取.*消|cancel/i }));
  const dialogs = await screen.findAllByRole('dialog');
  const dialog = dialogs[dialogs.length - 1];
  const dialogButtons = within(dialog).getAllByRole('button');
  await user.click(dialogButtons[dialogButtons.length - 1]);
  expect(onClose).toHaveBeenCalledOnce();
});

it('closes a clean memory manager without a discard prompt', async () => {
  const user = userEvent.setup();
  const onClose = vi.fn();
  renderWithProviders(<MemoryManager visible onClose={onClose} />);
  await screen.findByDisplayValue('Before');
  await user.click(screen.getByRole('button', { name: /取.*消|cancel/i }));
  expect(onClose).toHaveBeenCalledOnce();
});

it('edits a same-source term only in the selected language and context', async () => {
  const user = userEvent.setup();
  mocks.add.mockResolvedValue(undefined);
  renderWithProviders(<TermLibraryManager visible onClose={vi.fn()} />);
  const cell = await screen.findByText('Ouvrir FR');
  const row = cell.closest('tr');
  expect(row).not.toBeNull();
  await user.click(within(row!).getByRole('button', { name: '编辑' }));
  const input = within(row!).getByRole('textbox');
  await user.clear(input);
  await user.paste('French revision');
  await user.click(within(row!).getByRole('button', { name: /保.*存/ }));
  await waitFor(() =>
    expect(mocks.add).toHaveBeenCalledWith({
      source: 'Open',
      userTranslation: 'French revision',
      aiTranslation: 'AI FR',
      language: 'fr',
      context: 'fr-menu',
      expectedRevision: 1,
    })
  );
  expect(screen.getByText('Open EN')).toBeInTheDocument();
}, 15000);
