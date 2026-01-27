use crate::utils::paths;
use once_cell::sync::Lazy;
use serde_json::Value;
use std::{fs, path::PathBuf, sync::RwLock};

const DEFAULT_LANGUAGE: &str = "zh-CN";

fn get_locales_dir() -> Option<PathBuf> {
    paths::app_resources_dir()
        .map(|resource_path| resource_path.join("locales"))
        .ok()
}

pub fn get_supported_languages() -> Vec<String> {
    let mut languages = Vec::new();

    if let Some(locales_dir) = get_locales_dir()
        && let Ok(entries) = fs::read_dir(locales_dir)
    {
        for entry in entries.flatten() {
            if let Some(file_name) = entry.file_name().to_str()
                && let Some(lang) = file_name.strip_suffix(".json")
            {
                languages.push(lang.to_string());
            }
        }
    }

    if languages.is_empty() {
        languages.push(DEFAULT_LANGUAGE.to_string());
    }
    languages
}

/// 全局翻译缓存（语言 + 翻译数据）
static TRANSLATIONS: Lazy<RwLock<(String, Value)>> = Lazy::new(|| {
    let lang = get_system_language();
    let json = load_lang_file(&lang).unwrap_or_else(|| Value::Object(Default::default()));
    RwLock::new((lang, json))
});

fn load_lang_file(lang: &str) -> Option<Value> {
    let locales_dir = get_locales_dir()?;
    let file_path = locales_dir.join(format!("{lang}.json"));
    fs::read_to_string(file_path)
        .ok()
        .and_then(|content| serde_json::from_str(&content).ok())
}

/// 获取系统语言（使用 sys-locale 检测）
pub fn get_system_language() -> String {
    sys_locale::get_locale()
        .map(|locale| locale.to_lowercase())
        .and_then(|locale| {
            let supported = get_supported_languages();
            if supported.contains(&locale) {
                return Some(locale);
            }
            if let Some(short) = locale.split(['_', '-']).next() {
                let short = short.to_string();
                if supported.contains(&short) {
                    return Some(short);
                }
                let with_region = format!("{}-{}", short, short.to_uppercase());
                if supported.contains(&with_region) {
                    return Some(with_region);
                }
            }
            None
        })
        .unwrap_or_else(|| DEFAULT_LANGUAGE.to_string())
}

/// 异步翻译函数（简化版，不依赖配置）
#[allow(clippy::unused_async)]
pub async fn t(key: &str) -> String {
    t_with_lang(key, None)
}

/// 使用指定语言翻译（或使用系统语言）
pub fn t_with_lang(key: &str, lang: Option<&str>) -> String {
    let current_lang = lang.map(String::from).unwrap_or_else(get_system_language);

    if let Ok(cache) = TRANSLATIONS.read()
        && cache.0 == current_lang
        && let Some(text) = cache.1.get(key).and_then(|val| val.as_str())
    {
        return text.to_string();
    }

    if let Some(new_json) = load_lang_file(&current_lang)
        && let Ok(mut cache) = TRANSLATIONS.write()
    {
        *cache = (current_lang.clone(), new_json);

        if let Some(text) = cache.1.get(key).and_then(|val| val.as_str()) {
            return text.to_string();
        }
    }

    if current_lang != DEFAULT_LANGUAGE
        && let Some(default_json) = load_lang_file(DEFAULT_LANGUAGE)
        && let Ok(mut cache) = TRANSLATIONS.write()
    {
        *cache = (DEFAULT_LANGUAGE.to_string(), default_json);

        if let Some(text) = cache.1.get(key).and_then(|val| val.as_str()) {
            return text.to_string();
        }
    }

    key.to_string()
}

#[tauri::command]
pub fn get_system_locale() -> String {
    get_system_language()
}

#[tauri::command]
pub fn get_available_languages() -> Vec<String> {
    get_supported_languages()
}

#[cfg(test)]
#[allow(clippy::unwrap_used)]
mod tests {
    use super::*;

    #[test]
    fn test_get_system_language() {
        let lang = get_system_language();
        assert!(!lang.is_empty());
        println!("Detected system language: {}", lang);
    }

    #[test]
    fn test_get_supported_languages() {
        let languages = get_supported_languages();
        assert!(!languages.is_empty());
        assert!(languages.contains(&DEFAULT_LANGUAGE.to_string()));
    }

    #[tokio::test]
    async fn test_translation_fallback() {
        // 测试不存在的 key 返回原始 key
        let result = t("nonexistent.key").await;
        assert_eq!(result, "nonexistent.key");
    }
}
