import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import enUS from './locales/en-US.json';
import zhCN from './locales/zh-CN.json';
import { systemApi } from '../services/api';

// Phase 6: 语言优先级
// 1. 用户手动设置（localStorage）
// 2. 系统语言检测
// 3. 默认中文
const DEFAULT_LANGUAGE = 'zh-CN';

/**
 * 获取初始语言
 * @returns Promise<string> 语言代码
 */
export async function getInitialLanguage(): Promise<string> {
  // 优先级1：用户手动设置
  const userLanguage = localStorage.getItem('app-language');
  if (userLanguage) {
    console.log('[i18n] 使用用户设置语言:', userLanguage);
    return userLanguage;
  }

  // 优先级2：系统语言
  try {
    const systemLanguage = await systemApi.getSystemLanguage();
    console.log('[i18n] 检测到系统语言:', systemLanguage);
    return systemLanguage;
  } catch (error) {
    console.warn('[i18n] 系统语言检测失败，使用默认语言:', error);
  }

  // 优先级3：默认中文
  console.log('[i18n] 使用默认语言:', DEFAULT_LANGUAGE);
  return DEFAULT_LANGUAGE;
}

/**
 * 异步初始化 i18n
 */
export async function initializeI18n() {
  const language = await getInitialLanguage();
  
  await i18n
    .use(initReactI18next)
    .init({
      resources: {
        'en-US': { translation: enUS },
        'zh-CN': { translation: zhCN },
      },
      lng: language,
      fallbackLng: DEFAULT_LANGUAGE,
      interpolation: {
        escapeValue: false,
      },
    });

  console.log('[i18n] 初始化完成，当前语言:', i18n.language);
  return i18n;
}

// 同步初始化（用于兼容性）
i18n
  .use(initReactI18next)
  .init({
    resources: {
      'en-US': { translation: enUS },
      'zh-CN': { translation: zhCN },
    },
    lng: DEFAULT_LANGUAGE, // 默认语言，会在 main.tsx 中异步更新
    fallbackLng: DEFAULT_LANGUAGE,
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;

