import i18n from '../i18n/config';
import { invoke } from './apiClient';
import type { LanguageInfo } from '../types/generated/LanguageInfo';

export const i18nCommands = {
  async getSupportedLanguages(): Promise<LanguageInfo[]> {
    return invoke<LanguageInfo[]>('get_supported_langs', undefined, {
      errorMessage: i18n.t('errors.ipc.supportedLanguages'),
    });
  },

  async getSystemLocale(): Promise<string> {
    return invoke<string>('get_system_locale', undefined, {
      errorMessage: i18n.t('errors.ipc.systemLocale'),
    });
  },

  async detectLanguage(text: string): Promise<LanguageInfo> {
    return invoke<LanguageInfo>(
      'detect_text_language',
      { text },
      {
        errorMessage: i18n.t('errors.ipc.detectLanguage'),
      }
    );
  },

  async getDefaultTargetLanguage(sourceLangCode: string): Promise<LanguageInfo> {
    return invoke<LanguageInfo>(
      'get_default_target_lang',
      { sourceLangCode },
      { errorMessage: i18n.t('errors.ipc.targetLanguage') }
    );
  },
};
