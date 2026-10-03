import {
  isEntryTranslated,
  pluralCount,
  statsDelta,
  translationSlots,
} from '../../utils/poDocument';
import { useTranslationStore } from '../../store/useTranslationStore';
import type { PODocument, POEntry, TranslationStats } from '../../types/tauri';

export const entry = (overrides: Partial<POEntry> = {}): POEntry => ({
  comments: [],
  translator_comments: '',
  msgctxt: '',
  msgid: 'File',
  msgstr: '',
  line_start: 2,
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
const metadata = {
  'Plural-Forms': 'nplurals=3; plural=(n==1 ? 0 : n==2 ? 1 : 2);',
  Language: 'pl',
};

describe('PO document translation', () => {
  it('flattens only missing plural forms, retains context, and excludes obsolete entries', () => {
    const entries = [
      entry({ msgctxt: 'menu' }),
      entry({ msgctxt: 'verb' }),
      entry({ msgid_plural: 'Files', msgstr_plural: ['Plik'] }),
      entry({ obsolete: true }),
    ];
    const slots = translationSlots(entries, [0, 1, 2, 3], metadata);
    expect(slots.map((slot) => [slot.entryIndex, slot.pluralIndex])).toEqual([
      [0, null],
      [1, null],
      [2, 1],
      [2, 2],
    ]);
    expect(slots[0].input.context).not.toEqual(slots[1].input.context);
    expect(JSON.parse(slots[2].input.context!)).toEqual([
      '',
      [],
      'File',
      'Files',
      1,
      metadata['Plural-Forms'],
    ]);
    expect(slots[2].input.context).toContain(metadata['Plural-Forms']);
    expect(pluralCount(entries[2], metadata)).toBe(3);
    expect(isEntryTranslated(entries[2], metadata)).toBe(false);
    expect(() => translationSlots(entries, [2], {})).toThrow();
    expect(() =>
      translationSlots(entries, [2], { 'Plural-Forms': 'nplurals=2; plural= ;' })
    ).toThrow();
    const extraForms = entry({ msgid_plural: 'Files', msgstr_plural: ['', '', '', ''] });
    expect(pluralCount(extraForms, metadata)).toBe(4);
    expect(translationSlots([extraForms], [0], metadata)).toHaveLength(3);
    expect(() =>
      translationSlots(entries, [2], { 'Plural-Forms': 'nplurals=999999999; plural=n;' })
    ).toThrow();
  });

  it('updates a chunk atomically, bounds the index map and rejects updates for a reopened document', () => {
    const document: PODocument = {
      header: 'Keep header',
      metadata,
      metadata_is_fuzzy: true,
      entries: [entry(), entry({ obsolete: true }), entry({ msgid: 'Other' })],
    };
    const store = useTranslationStore;
    store.getState().setDocument(document, 'same.po');
    const revision = store.getState().documentRevision;
    const previous = store.getState().entries[0];
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    store.getState().updateEntries(
      [
        { index: 0, updates: { msgstr: 'First' } },
        { index: 2, updates: { msgstr: 'Second' } },
      ],
      revision
    );
    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.getState().entryIndexMap.size).toBe(3);
    expect(store.getState().entryIndexMap.has(previous)).toBe(false);
    expect(store.getState().currentEntry?.msgstr).toBe('First');
    expect(store.getState().document).toEqual(document);
    store.getState().setDocument(document, 'same.po');
    store.getState().updateEntries([{ index: 0, updates: { msgstr: 'Stale' } }], revision);
    expect(store.getState().entries[0].msgstr).toBe('');
    expect(store.getState().entries[1].obsolete).toBe(true);
    unsubscribe();
  });

  it('subtracts exact cumulative statistics without allocating rounded per-row tokens', () => {
    const stats: TranslationStats = {
      total: 3,
      tm_hits: 1,
      deduplicated: 0,
      ai_translated: 2,
      tm_learned: 2,
      token_stats: {
        input_tokens: 11,
        output_tokens: 7,
        total_tokens: 18,
        cost: 0.00013,
        unpriced_requests: 2,
      },
    };
    expect(statsDelta(stats, stats)).toEqual({
      total: 0,
      tm_hits: 0,
      deduplicated: 0,
      ai_translated: 0,
      tm_learned: 0,
      token_stats: {
        input_tokens: 0,
        output_tokens: 0,
        total_tokens: 0,
        cost: 0,
        unpriced_requests: 0,
      },
    });
    expect(statsDelta(stats, null)).toEqual(stats);
  });

  it('hydrates fuzzy review state and removes only fuzzy on confirmation', () => {
    useTranslationStore.getState().setDocument(
      {
        header: null,
        metadata: {},
        metadata_is_fuzzy: false,
        entries: [entry({ msgstr: 'Fichier', flags: ['fuzzy', 'c-format'] })],
      },
      'review.po'
    );
    expect(useTranslationStore.getState().entries[0].needsReview).toBe(true);
    useTranslationStore.getState().updateEntry(0, { needsReview: false });
    expect(useTranslationStore.getState().entries[0].flags).toEqual(['c-format']);
    useTranslationStore.getState().updateEntry(0, { needsReview: true });
    expect(useTranslationStore.getState().entries[0].flags).toEqual(['c-format', 'fuzzy']);
  });
});
