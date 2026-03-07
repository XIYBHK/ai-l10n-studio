import type { TranslationMemory } from '../types/tauri';
import type { TermLibrary } from '../types/termLibrary';
import { invoke } from './commandClient';
import { COMMANDS } from './commandKeys';

export const termLibraryCommands = {
  async get(): Promise<TermLibrary> {
    return invoke<TermLibrary>(COMMANDS.TERM_LIBRARY_GET, undefined, {
      errorMessage: '加载术语库失败',
    });
  },

  async addTerm(termData: {
    source: string;
    userTranslation: string;
    aiTranslation: string;
    context?: string | null;
  }): Promise<void> {
    return invoke<void>(COMMANDS.TERM_LIBRARY_ADD, termData, { errorMessage: '添加术语失败' });
  },

  async removeTerm(source: string): Promise<void> {
    return invoke<void>(COMMANDS.TERM_LIBRARY_REMOVE, { source }, { errorMessage: '删除术语失败' });
  },

  async generateStyleSummary(): Promise<string> {
    return invoke<string>(COMMANDS.TERM_LIBRARY_GENERATE_STYLE, undefined, {
      errorMessage: '生成风格总结失败',
    });
  },

  async shouldUpdateStyleSummary(): Promise<boolean> {
    return invoke<boolean>(COMMANDS.TERM_LIBRARY_SHOULD_UPDATE);
  },
};

export const translationMemoryCommands = {
  async get(): Promise<TranslationMemory> {
    return invoke<TranslationMemory>(COMMANDS.TM_GET, undefined, {
      errorMessage: '加载翻译记忆库失败',
    });
  },

  async getBuiltinPhrases(): Promise<TranslationMemory> {
    return invoke<TranslationMemory>(COMMANDS.TM_GET_BUILTIN, undefined, {
      errorMessage: '加载内置词库失败',
    });
  },

  async mergeBuiltinPhrases(): Promise<number> {
    return invoke<number>(COMMANDS.TM_MERGE_BUILTIN, undefined, {
      errorMessage: '合并内置词库失败',
    });
  },

  async save(memory: Record<string, unknown>): Promise<void> {
    return invoke<void>(COMMANDS.TM_SAVE, { memory }, { errorMessage: '保存翻译记忆库失败' });
  },
};
