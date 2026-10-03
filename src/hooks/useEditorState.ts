import { useTranslationStore, editorDraftKey } from '../store/useTranslationStore';

/** Drafts belong to the document, so navigation and file saves cannot lose them. */
export function useEditorState(
  index: number,
  pluralIndex: number | null,
  savedTranslation: string
) {
  const draft = useTranslationStore((state) => state.drafts[editorDraftKey(index, pluralIndex)]);
  const setDraft = useTranslationStore((state) => state.setDraft);
  const discardDraft = useTranslationStore((state) => state.discardDraft);
  return {
    translation: draft?.value ?? savedTranslation,
    hasUnsavedChanges: draft !== undefined,
    setTranslation: (value: string) => setDraft(index, pluralIndex, value),
    cancel: () => discardDraft(index, pluralIndex),
  };
}
