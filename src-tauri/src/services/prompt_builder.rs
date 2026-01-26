//! 提示词构建器
//!
//! 负责构建翻译系统提示词和用户提示词

use crate::services::term_library::TermLibrary;

/// 默认系统提示词
pub const DEFAULT_SYSTEM_PROMPT: &str = r"专业游戏本地化翻译。
规则:
1. 术语保留英文: Actor/Blueprint/Component/Transform/Mesh/Material/Widget/Collision/Array/Float/Integer
2. 固定翻译: Asset→资产, Unique→去重, Slice→截取, Primitives→基础类型, Constant Speed→匀速, Stream→流送, Ascending→升序, Descending→降序
3. Category: 保持XTools等命名空间和|符号, 如 XTools|Sort|Actor → XTools|排序|Actor
4. 保留所有特殊符号: |、{}、%%、[]、()、\n、\t、{0}、{1}等
5. 特殊表达: in-place→原地, by value→按值, True/False保持原样";

/// 构建系统提示词
///
/// # 参数
/// - `custom_prompt`: 用户自定义的基础提示词（None则使用DEFAULT_SYSTEM_PROMPT）
/// - `term_library`: 术语库（用于拼接风格总结）
///
/// # 返回
/// 完整的系统提示词字符串
pub fn build_system_prompt(
    custom_prompt: Option<&str>,
    term_library: Option<&TermLibrary>,
) -> String {
    // 使用自定义提示词或默认提示词
    let base_prompt = custom_prompt.unwrap_or(DEFAULT_SYSTEM_PROMPT);

    // 如果有术语库的风格总结，注入到提示词中
    if let Some(library) = term_library {
        if let Some(style_summary) = &library.style_summary {
            return format!(
                "{}\n\n【用户翻译风格偏好】（基于{}条术语学习）\n{}",
                base_prompt, style_summary.based_on_terms, style_summary.prompt
            );
        }
    }

    base_prompt.to_string()
}

/// 构建翻译用户提示词
///
/// # 参数
/// - `texts`: 待翻译的文本列表
/// - `target_language`: 目标语言代码（如 "zh-Hans", "en" 等）
///
/// # 返回
/// 格式化的用户提示词字符串
pub fn build_translation_prompt(texts: &[String], target_language: Option<&str>) -> String {
    // 根据目标语言生成提示词
    let target_lang_instruction = match target_language {
        Some("zh-Hans") => "简体中文",
        Some("zh-Hant") => "繁体中文",
        Some("en") => "English",
        Some("ja") => "日本語",
        Some("ko") => "한국어",
        Some("fr") => "Français",
        Some("de") => "Deutsch",
        Some("es") => "Español",
        Some("ru") => "Русский",
        Some("ar") => "العربية",
        Some("pt") => "Português",
        Some("it") => "Italiano",
        Some("th") => "ไทย",
        Some("vi") => "Tiếng Việt",
        Some(lang) => lang,
        None => "目标语言", // 默认（未指定语言）
    };

    // 精简提示词：移除冗余说明和空行
    let mut prompt = format!("翻译为{}（每行一条，带序号）:\n", target_lang_instruction);
    for (i, text) in texts.iter().enumerate() {
        prompt.push_str(&format!("{}. {}\n", i + 1, text));
    }
    prompt
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_build_system_prompt_default() {
        let prompt = build_system_prompt(None, None);
        assert_eq!(prompt, DEFAULT_SYSTEM_PROMPT);
    }

    #[test]
    fn test_build_system_prompt_custom() {
        let custom = "自定义提示词";
        let prompt = build_system_prompt(Some(custom), None);
        assert_eq!(prompt, custom);
    }

    #[test]
    fn test_build_translation_prompt() {
        let texts = vec!["Hello".to_string(), "World".to_string()];
        let prompt = build_translation_prompt(&texts, Some("zh-Hans"));
        assert!(prompt.contains("简体中文"));
        assert!(prompt.contains("1. Hello"));
        assert!(prompt.contains("2. World"));
    }
}
