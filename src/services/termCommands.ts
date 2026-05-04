import type { TranslationMemory } from '../types/tauri';
import type { TermLibrary } from '../types/termLibrary';
import { invoke } from './apiClient';

export const termLibraryCommands = {
  async get(): Promise<TermLibrary> {
    return invoke<TermLibrary>('get_term_library', undefined, {
      errorMessage: '加载术语库失败',
    });
  },

  async addTerm(termData: {
    source: string;
    userTranslation: string;
    aiTranslation: string;
    context?: string | null;
  }): Promise<void> {
    return invoke<void>('add_term_to_library', termData, { errorMessage: '添加术语失败' });
  },

  async removeTerm(source: string): Promise<void> {
    return invoke<void>('remove_term_from_library', { source }, { errorMessage: '删除术语失败' });
  },

  async generateStyleSummary(): Promise<string> {
    return invoke<string>('generate_style_summary', undefined, {
      errorMessage: '生成风格总结失败',
    });
  },

  async shouldUpdateStyleSummary(): Promise<boolean> {
    return invoke<boolean>('should_update_style_summary');
  },
};

export const translationMemoryCommands = {
  async get(): Promise<TranslationMemory> {
    return invoke<TranslationMemory>('get_translation_memory', undefined, {
      errorMessage: '加载翻译记忆库失败',
    });
  },

  async getBuiltinPhrases(): Promise<TranslationMemory> {
    return invoke<TranslationMemory>('get_builtin_phrases', undefined, {
      errorMessage: '加载内置词库失败',
    });
  },

  async mergeBuiltinPhrases(): Promise<number> {
    return invoke<number>('merge_builtin_phrases', undefined, {
      errorMessage: '合并内置词库失败',
    });
  },

  async save(memory: Record<string, unknown>): Promise<void> {
    return invoke<void>(
      'save_translation_memory',
      { memory },
      { errorMessage: '保存翻译记忆库失败' }
    );
  },
};
