// ========== Phase 5: 语言检测服务 ==========

use anyhow::{Result, anyhow};
use serde::{Deserialize, Serialize};

/// 支持的语言枚举
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Language {
    #[serde(rename = "zh-Hans")]
    ChineseSimplified,
    #[serde(rename = "zh-Hant")]
    ChineseTraditional,
    #[serde(rename = "en")]
    English,
    #[serde(rename = "ja")]
    Japanese,
    #[serde(rename = "ko")]
    Korean,
    #[serde(rename = "fr")]
    French,
    #[serde(rename = "de")]
    German,
    #[serde(rename = "es")]
    Spanish,
    #[serde(rename = "ru")]
    Russian,
    #[serde(rename = "ar")]
    Arabic,
}

impl Language {
    /// 获取语言代码
    pub fn code(&self) -> &str {
        match self {
            Language::ChineseSimplified => "zh-Hans",
            Language::ChineseTraditional => "zh-Hant",
            Language::English => "en",
            Language::Japanese => "ja",
            Language::Korean => "ko",
            Language::French => "fr",
            Language::German => "de",
            Language::Spanish => "es",
            Language::Russian => "ru",
            Language::Arabic => "ar",
        }
    }
    
    /// 获取语言显示名称
    pub fn display_name(&self) -> &str {
        match self {
            Language::ChineseSimplified => "简体中文",
            Language::ChineseTraditional => "繁體中文",
            Language::English => "English",
            Language::Japanese => "日本語",
            Language::Korean => "한국어",
            Language::French => "Français",
            Language::German => "Deutsch",
            Language::Spanish => "Español",
            Language::Russian => "Русский",
            Language::Arabic => "العربية",
        }
    }
    
    /// 获取语言英文名称
    pub fn english_name(&self) -> &str {
        match self {
            Language::ChineseSimplified => "Chinese (Simplified)",
            Language::ChineseTraditional => "Chinese (Traditional)",
            Language::English => "English",
            Language::Japanese => "Japanese",
            Language::Korean => "Korean",
            Language::French => "French",
            Language::German => "German",
            Language::Spanish => "Spanish",
            Language::Russian => "Russian",
            Language::Arabic => "Arabic",
        }
    }
    
    /// 从语言代码创建
    pub fn from_code(code: &str) -> Option<Self> {
        match code.to_lowercase().as_str() {
            "zh-hans" | "zh_hans" | "zh-cn" | "zh_cn" | "chs" => Some(Language::ChineseSimplified),
            "zh-hant" | "zh_hant" | "zh-tw" | "zh_tw" | "cht" => Some(Language::ChineseTraditional),
            "en" | "en-us" | "en_us" | "english" => Some(Language::English),
            "ja" | "jp" | "japanese" => Some(Language::Japanese),
            "ko" | "kr" | "korean" => Some(Language::Korean),
            "fr" | "french" => Some(Language::French),
            "de" | "german" => Some(Language::German),
            "es" | "spanish" => Some(Language::Spanish),
            "ru" | "russian" => Some(Language::Russian),
            "ar" | "arabic" => Some(Language::Arabic),
            _ => None,
        }
    }
}

/// 语言信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LanguageInfo {
    pub code: String,
    pub display_name: String,
    pub english_name: String,
}

impl From<Language> for LanguageInfo {
    fn from(lang: Language) -> Self {
        LanguageInfo {
            code: lang.code().to_string(),
            display_name: lang.display_name().to_string(),
            english_name: lang.english_name().to_string(),
        }
    }
}

/// 检测文本的语言
pub fn detect_language(text: &str) -> Result<Language> {
    if text.trim().is_empty() {
        return Err(anyhow!("文本为空，无法检测语言"));
    }
    
    // 计算各语言字符数量
    let mut chinese_count = 0;
    let mut japanese_count = 0;
    let mut korean_count = 0;
    let mut english_count = 0;
    let mut arabic_count = 0;
    let mut cyrillic_count = 0;
    
    for c in text.chars() {
        if is_chinese_char(c) {
            chinese_count += 1;
        } else if is_japanese_char(c) {
            japanese_count += 1;
        } else if is_korean_char(c) {
            korean_count += 1;
        } else if is_english_char(c) {
            english_count += 1;
        } else if is_arabic_char(c) {
            arabic_count += 1;
        } else if is_cyrillic_char(c) {
            cyrillic_count += 1;
        }
    }
    
    // 找出最多的语言
    let max_count = chinese_count
        .max(japanese_count)
        .max(korean_count)
        .max(english_count)
        .max(arabic_count)
        .max(cyrillic_count);
    
    if max_count == 0 {
        // 默认为英文
        return Ok(Language::English);
    }
    
    if chinese_count == max_count {
        // 简化：默认简体中文（实际区分简繁需要更复杂的逻辑）
        Ok(Language::ChineseSimplified)
    } else if japanese_count == max_count {
        Ok(Language::Japanese)
    } else if korean_count == max_count {
        Ok(Language::Korean)
    } else if arabic_count == max_count {
        Ok(Language::Arabic)
    } else if cyrillic_count == max_count {
        Ok(Language::Russian)
    } else {
        Ok(Language::English)
    }
}

/// 获取默认目标语言
pub fn get_default_target_language(source_language: Language) -> Language {
    match source_language {
        Language::ChineseSimplified | Language::ChineseTraditional => Language::English,
        Language::English => Language::ChineseSimplified,
        _ => Language::English, // 其他语言默认目标为英文
    }
}

/// 获取所有支持的语言
pub fn get_supported_languages() -> Vec<LanguageInfo> {
    vec![
        Language::ChineseSimplified.into(),
        Language::ChineseTraditional.into(),
        Language::English.into(),
        Language::Japanese.into(),
        Language::Korean.into(),
        Language::French.into(),
        Language::German.into(),
        Language::Spanish.into(),
        Language::Russian.into(),
        Language::Arabic.into(),
    ]
}

// ========== 字符判断辅助函数 ==========

fn is_chinese_char(c: char) -> bool {
    matches!(c,
        '\u{4E00}'..='\u{9FFF}' |  // CJK统一汉字
        '\u{3400}'..='\u{4DBF}' |  // CJK扩展A
        '\u{20000}'..='\u{2A6DF}'  // CJK扩展B
    )
}

fn is_japanese_char(c: char) -> bool {
    matches!(c,
        '\u{3040}'..='\u{309F}' |  // 平假名
        '\u{30A0}'..='\u{30FF}'    // 片假名
    )
}

fn is_korean_char(c: char) -> bool {
    matches!(c,
        '\u{AC00}'..='\u{D7AF}' |  // 韩文音节
        '\u{1100}'..='\u{11FF}'    // 韩文字母
    )
}

fn is_english_char(c: char) -> bool {
    c.is_ascii_alphabetic()
}

fn is_arabic_char(c: char) -> bool {
    matches!(c, '\u{0600}'..='\u{06FF}')
}

fn is_cyrillic_char(c: char) -> bool {
    matches!(c, '\u{0400}'..='\u{04FF}')
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_detect_chinese() {
        let text = "这是一段中文文本";
        let lang = detect_language(text).unwrap();
        assert_eq!(lang, Language::ChineseSimplified);
    }

    #[test]
    fn test_detect_english() {
        let text = "This is an English text";
        let lang = detect_language(text).unwrap();
        assert_eq!(lang, Language::English);
    }

    #[test]
    fn test_detect_japanese() {
        let text = "これは日本語のテキストです";
        let lang = detect_language(text).unwrap();
        assert_eq!(lang, Language::Japanese);
    }

    #[test]
    fn test_detect_korean() {
        let text = "이것은 한국어 텍스트입니다";
        let lang = detect_language(text).unwrap();
        assert_eq!(lang, Language::Korean);
    }

    #[test]
    fn test_default_target_language() {
        assert_eq!(
            get_default_target_language(Language::ChineseSimplified),
            Language::English
        );
        assert_eq!(
            get_default_target_language(Language::English),
            Language::ChineseSimplified
        );
        assert_eq!(
            get_default_target_language(Language::Japanese),
            Language::English
        );
    }

    #[test]
    fn test_language_from_code() {
        assert_eq!(Language::from_code("zh-Hans"), Some(Language::ChineseSimplified));
        assert_eq!(Language::from_code("zh-CN"), Some(Language::ChineseSimplified));
        assert_eq!(Language::from_code("en"), Some(Language::English));
        assert_eq!(Language::from_code("EN-US"), Some(Language::English));
        assert_eq!(Language::from_code("ja"), Some(Language::Japanese));
        assert_eq!(Language::from_code("unknown"), None);
    }

    #[test]
    fn test_language_info() {
        let info: LanguageInfo = Language::ChineseSimplified.into();
        assert_eq!(info.code, "zh-Hans");
        assert_eq!(info.display_name, "简体中文");
        assert_eq!(info.english_name, "Chinese (Simplified)");
    }

    #[test]
    fn test_get_supported_languages() {
        let langs = get_supported_languages();
        assert_eq!(langs.len(), 10);
        assert_eq!(langs[0].code, "zh-Hans");
    }
}

