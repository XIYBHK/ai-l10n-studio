import type { TranslationMemory } from '../types/tauri';
import type { TermLibrary } from '../types/termLibrary';
import { invoke } from './apiClient';
import type { ConfirmedTranslation } from '../types/generated/ConfirmedTranslation';
import i18n from '../i18n/config';
import type { BuiltinPhrases } from '../types/generated/BuiltinPhrases';

export const termLibraryCommands = {
  async get(): Promise<TermLibrary> {
    return invoke<TermLibrary>('get_term_library', undefined, {
      errorMessage: i18n.t('terms.loadFailed'),
    });
  },

  async addTerm(termData: {
    source: string;
    userTranslation: string;
    aiTranslation: string;
    context?: string | null;
    language: string;
    expectedRevision?: number;
  }): Promise<void> {
    return invoke<void>(
      'add_term_to_library',
      { ...termData, expectedRevision: termData.expectedRevision ?? null },
      { showErrorMessage: false }
    );
  },

  async removeTerm(
    source: string,
    context: string | null,
    language: string,
    expectedRevision?: number
  ): Promise<void> {
    return invoke<void>(
      'remove_term_from_library',
      { source, context, language, expectedRevision: expectedRevision ?? null },
      { showErrorMessage: false }
    );
  },

  async generateStyleSummary(language: string, context: string | null): Promise<string> {
    return invoke<string>(
      'generate_style_summary',
      { language, context },
      {
        showErrorMessage: false,
      }
    );
  },

  async shouldUpdateStyleSummary(language: string, context: string | null): Promise<boolean> {
    return invoke<boolean>('should_update_style_summary', { language, context });
  },
};

export const translationMemoryCommands = {
  async confirm(pairs: ConfirmedTranslation[]): Promise<number> {
    return invoke<number>('confirm_translations', { pairs }, { showErrorMessage: false });
  },
  async get(): Promise<TranslationMemory> {
    return invoke<TranslationMemory>('get_translation_memory', undefined, {
      errorMessage: i18n.t('memoryManager.loadFailed'),
    });
  },

  async getBuiltinPhrases(): Promise<BuiltinPhrases> {
    return invoke<BuiltinPhrases>('get_builtin_phrases', undefined, {
      showErrorMessage: false,
    });
  },

  async mergeBuiltinPhrases(): Promise<number> {
    return invoke<number>('merge_builtin_phrases', undefined, {
      showErrorMessage: false,
    });
  },

  async save(memory: TranslationMemory): Promise<TranslationMemory> {
    return invoke<TranslationMemory>(
      'save_translation_memory',
      { memory },
      { showErrorMessage: false }
    );
  },
};
