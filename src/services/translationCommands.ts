import type { ContextualRefineRequest } from '../types/tauri';
import { invoke } from './apiClient';

export const translatorCommands = {
  async translateEntry(text: string, targetLanguage?: string): Promise<string> {
    return invoke<string>(
      'translate_entry',
      { text, targetLanguage: targetLanguage || null },
      { errorMessage: '翻译失败', silent: false }
    );
  },

  async contextualRefine(
    requests: ContextualRefineRequest[],
    targetLanguage: string
  ): Promise<string[]> {
    return invoke<string[]>(
      'contextual_refine',
      { requests, targetLanguage },
      { errorMessage: 'Contextual Refine 失败', silent: false }
    );
  },
};

export const i18nCommands = {
  async getSupportedLanguages(): Promise<string[]> {
    return invoke<string[]>('get_supported_langs', undefined, {
      errorMessage: '获取支持的语言列表失败',
    });
  },

  async getSystemLocale(): Promise<string> {
    return invoke<string>('get_system_locale', undefined, {
      errorMessage: '获取系统语言失败',
    });
  },

  async detectLanguage(text: string): Promise<{ code: string; display_name: string }> {
    return invoke<{ code: string; display_name: string }>(
      'detect_text_language',
      { text },
      {
        errorMessage: '语言检测失败',
      }
    );
  },

  async getDefaultTargetLanguage(
    sourceLangCode: string
  ): Promise<{ code: string; display_name: string }> {
    return invoke<{ code: string; display_name: string }>(
      'get_default_target_lang',
      { sourceLangCode },
      { errorMessage: '获取默认目标语言失败' }
    );
  },
};
