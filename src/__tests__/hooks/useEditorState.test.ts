import { act, renderHook } from '@testing-library/react';
import { useEditorState } from '../../hooks/useEditorState';
import { useTranslationStore } from '../../store/useTranslationStore';
import type { POEntry } from '../../types/tauri';

const entry: POEntry = {
  msgid: 'Open',
  msgstr: 'Before',
  msgctxt: '',
  comments: [],
  translator_comments: '',
  msgid_plural: null,
  msgstr_plural: [],
  line_start: 1,
  flags: [],
  occurrences: [],
  obsolete: false,
  previous_msgid: null,
  previous_msgid_plural: null,
  previous_msgctxt: null,
};

it('preserves a dirty draft across external updates and resets on document revision', () => {
  useTranslationStore.getState().reset();
  useTranslationStore.getState().setEntries([entry]);
  const { result, rerender } = renderHook(({ saved }) => useEditorState(0, null, saved), {
    initialProps: { saved: 'Before' },
  });
  act(() => result.current.setTranslation('My draft'));
  rerender({ saved: 'Background AI result' });
  expect(result.current.translation).toBe('My draft');
  expect(result.current.hasUnsavedChanges).toBe(true);
  act(() => result.current.cancel());
  expect(result.current.translation).toBe('Background AI result');
  act(() => result.current.setTranslation('Another draft'));
  act(() => useTranslationStore.getState().setEntries([{ ...entry, msgstr: 'Reopened file' }]));
  rerender({ saved: 'Reopened file' });
  expect(result.current.translation).toBe('Reopened file');
  expect(result.current.hasUnsavedChanges).toBe(false);
});
