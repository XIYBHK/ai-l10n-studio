import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { invoke } from '../services/tauriInvoke';

/**
 * Phase 9: 增强版前端国际化配置
 *
 * 特性：
 * 1. 系统语言自动检测（调用后端 Rust API）
 * 2. 动态加载语言文件（按需加载，减少初始加载）
 * 3. 语言优先级：用户设置 > 系统语言 > 默认语言
 * 4. 支持多语言扩展
 *
 * 参考：clash-verge-rev/services/i18n.ts
 */

// 默认语言
const DEFAULT_LANGUAGE = 'zh-CN';

// 支持的语言列表
export const supportedLanguages = [
  'zh-CN', // 简体中文
  'en-US', // 英语
  'ja-JP', // 日语
  'ko-KR', // 韩语
  // 可扩展更多语言
];

// 语言代码映射（系统语言 -> 应用语言）
const languageCodeMap: Record<string, string> = {
  zh: 'zh-CN',
  'zh-cn': 'zh-CN',
  'zh-tw': 'zh-CN', // 暂时都用简体中文
  en: 'en-US',
  ja: 'ja-JP',
  ko: 'ko-KR',
};

/**
 * 标准化语言代码
 * 将系统返回的各种格式转换为应用内部统一格式
 */
function normalizeLanguageCode(code: string): string {
  const normalized = code.toLowerCase();
  return languageCodeMap[normalized] || code;
}

/**
 * 动态加载语言文件
 * 按需加载，避免初始化时加载所有语言文件
 */
export async function loadLanguage(language: string): Promise<Record<string, any>> {
  try {
    // 动态导入语言文件
    const module = await import(`./locales/${language}.json`);
    return module.default;
  } catch (error) {
    console.warn(
      `[i18n] Failed to load language ${language}, fallback to ${DEFAULT_LANGUAGE}:`,
      error
    );
    // 降级到默认语言
    try {
      const fallback = await import(`./locales/${DEFAULT_LANGUAGE}.json`);
      return fallback.default;
    } catch (fallbackError) {
      console.error(`[i18n] Failed to load fallback language ${DEFAULT_LANGUAGE}:`, fallbackError);
      return {};
    }
  }
}

/**
 * 获取系统语言（调用 Rust 后端）
 */
async function getSystemLanguage(): Promise<string> {
  try {
    // Phase 9: 调用新的后端 API
    const systemLang = await invoke<string>('get_system_locale');
    console.log('[i18n] System language detected:', systemLang);
    return normalizeLanguageCode(systemLang);
  } catch (error) {
    console.warn('[i18n] Failed to get system language:', error);

    // 降级：尝试使用浏览器语言
    const browserLang = navigator.language || 'zh-CN';
    console.log('[i18n] Using browser language:', browserLang);
    return normalizeLanguageCode(browserLang);
  }
}

/**
 * 获取初始语言
 * 优先级：用户设置 > 系统语言 > 默认语言
 */
export async function getInitialLanguage(): Promise<string> {
  // 优先级1：用户手动设置（从 TauriStore 读取，由 useAppStore 管理）
  // 这里只检测系统语言，用户设置在 useAppStore 中处理

  // 优先级2：系统语言
  try {
    const systemLanguage = await getSystemLanguage();

    // 检查是否支持
    if (supportedLanguages.includes(systemLanguage)) {
      console.log('[i18n] Using system language:', systemLanguage);
      return systemLanguage;
    }

    console.warn('[i18n] System language not supported:', systemLanguage);
  } catch (error) {
    console.warn('[i18n] System language detection failed:', error);
  }

  // 优先级3：默认中文
  console.log('[i18n] Using default language:', DEFAULT_LANGUAGE);
  return DEFAULT_LANGUAGE;
}

/**
 * 切换语言
 * 预加载主要语言，避免动态导入延迟
 */
export async function changeLanguage(language: string): Promise<void> {
  // 💡 优化：预加载的语言直接切换，未预加载的懒加载
  if (!i18n.hasResourceBundle(language, 'translation')) {
    console.log('[i18n] Loading language resources:', language);
    const resources = await loadLanguage(language);
    i18n.addResourceBundle(language, 'translation', resources);
  }

  await i18n.changeLanguage(language);
  console.log('[i18n] Language changed to:', language);
}

/**
 * 预加载主要语言资源
 * 应用启动时调用，避免切换时的动态导入
 */
async function preloadLanguageResources(): Promise<void> {
  try {
    // 💡 优化：预加载主要语言（zh-CN 和 en-US）
    const primaryLanguages = ['zh-CN', 'en-US'];

    console.log('[i18n] 🚀 开始预加载主要语言资源...');

    for (const lang of primaryLanguages) {
      try {
        const resources = await loadLanguage(lang);
        i18n.addResourceBundle(lang, 'translation', resources);
        console.log(`[i18n] ✅ 已预加载: ${lang}`);
      } catch (error) {
        console.warn(`[i18n] ⚠️ 预加载失败: ${lang}`, error);
      }
    }
  } catch (error) {
    console.warn('[i18n] 预加载语言资源失败:', error);
  }
}

/**
 * 初始化 i18n（异步版本）
 * 应用启动时调用，检测系统语言并预加载
 */
export async function initializeI18n(): Promise<typeof i18n> {
  // 1. 预加载主要语言资源
  await preloadLanguageResources();

  // 2. 获取初始语言
  const language = await getInitialLanguage();

  // 3. 加载初始语言资源（如果未预加载）
  if (!i18n.hasResourceBundle(language, 'translation')) {
    console.log(`[i18n] 加载初始语言资源: ${language}`);
    const resources = await loadLanguage(language);
    i18n.addResourceBundle(language, 'translation', resources);
  }

  await i18n.use(initReactI18next).init({
    resources: {
      [language]: { translation: i18n.getResourceBundle(language, 'translation') },
    },
    lng: language,
    fallbackLng: DEFAULT_LANGUAGE,
    interpolation: {
      escapeValue: false,
    },
    // 性能优化
    react: {
      useSuspense: false, // 避免 Suspense 边界问题
    },
  });

  console.log('[i18n] Initialized with language:', i18n.language);
  return i18n;
}

// 导出默认实例（由 initializeI18n() 初始化）
export default i18n;
