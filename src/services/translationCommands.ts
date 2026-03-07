import type { ContextualRefineRequest } from '../types/tauri';
import { invoke } from './commandClient';
import { COMMANDS } from './commandKeys';

export const translatorCommands = {
  async translateEntry(text: string, targetLanguage?: string): Promise<string> {
    return invoke<string>(
      COMMANDS.TRANSLATE_ENTRY,
      { text, targetLanguage: targetLanguage || null },
      { errorMessage: '翻译失败', silent: false }
    );
  },

  async contextualRefine(
    requests: ContextualRefineRequest[],
    targetLanguage: string
  ): Promise<string[]> {
    return invoke<string[]>(
      COMMANDS.CONTEXTUAL_REFINE,
      { requests, targetLanguage },
      { errorMessage: 'Contextual Refine 失败', silent: false }
    );
  },
};

export const i18nCommands = {
  async getSupportedLanguages(): Promise<string[]> {
    return invoke<string[]>(COMMANDS.I18N_GET_SUPPORTED, undefined, {
      errorMessage: '获取支持的语言列表失败',
    });
  },

  async getSystemLocale(): Promise<string> {
    return invoke<string>(COMMANDS.I18N_GET_SYSTEM_LOCALE, undefined, {
      errorMessage: '获取系统语言失败',
    });
  },

  async detectLanguage(text: string): Promise<{ code: string; display_name: string }> {
    return invoke<{ code: string; display_name: string }>(COMMANDS.LANGUAGE_DETECT, { text }, {
      errorMessage: '语言检测失败',
    });
  },

  async getDefaultTargetLanguage(
    sourceLangCode: string
  ): Promise<{ code: string; display_name: string }> {
    return invoke<{ code: string; display_name: string }>(
      COMMANDS.LANGUAGE_GET_DEFAULT_TARGET,
      { sourceLangCode },
      { errorMessage: '获取默认目标语言失败' }
    );
  },
};
