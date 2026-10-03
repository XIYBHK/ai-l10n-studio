import { useTranslationStore } from '../store/useTranslationStore';
import { isEntryTranslated, translationSlots } from '../utils/poDocument';
import { translationMemoryCommands } from './termCommands';

let confirmations: Promise<unknown> = Promise.resolve();

/** Persist the exact reviewed snapshot before marking it confirmed in the document. */
export function confirmDocumentEntries(indices: number[]): Promise<number> {
  const before = useTranslationStore.getState();
  before.commitDrafts(indices);
  const state = useTranslationStore.getState();
  const revision = state.documentRevision;
  const versions = new Map(indices.map((index) => [index, state.entryVersions[index]]));
  const pairs = translationSlots(
    state.entries,
    indices,
    state.document?.metadata ?? {},
    false
  ).flatMap((slot) => {
    const entry = state.entries[slot.entryIndex];
    const translation =
      slot.pluralIndex === null ? entry.msgstr : entry.msgstr_plural[slot.pluralIndex];
    return translation?.trim()
      ? [
          {
            source: slot.input.text,
            translation,
            context: slot.input.context,
            language: state.targetLanguage,
          },
        ]
      : [];
  });
  const operation = confirmations
    .catch(() => undefined)
    .then(async () => {
      const count = pairs.length ? await translationMemoryCommands.confirm(pairs) : 0;
      const current = useTranslationStore.getState();
      if (current.documentRevision === revision) {
        current.updateEntries(
          indices
            .filter(
              (index) =>
                current.entryVersions[index] === versions.get(index) &&
                current.entries[index] &&
                isEntryTranslated(current.entries[index], current.document?.metadata ?? {})
            )
            .map((index) => ({ index, updates: { needsReview: false } })),
          revision
        );
      }
      return count;
    });
  confirmations = operation;
  return operation;
}
