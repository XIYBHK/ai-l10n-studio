// Phase 6: 系统相关命令
use crate::app_log;

/// 检测系统语言
/// 返回 BCP 47 语言标签（如 "zh-CN", "en-US"）
#[tauri::command]
pub fn get_system_language() -> Result<String, String> {
    app_log!("[系统语言] 检测系统语言...");

    // 使用 sys-locale 检测系统语言
    match sys_locale::get_locale() {
        Some(locale) => {
            app_log!("[系统语言] 检测到: {}", locale);

            // 规范化语言代码
            let normalized = normalize_locale(&locale);
            app_log!("[系统语言] 规范化为: {}", normalized);

            Ok(normalized)
        }
        None => {
            app_log!("[系统语言] 无法检测，使用默认语言 zh-CN");
            Ok("zh-CN".to_string())
        }
    }
}

/// 规范化语言代码
/// 将系统语言代码转换为应用支持的标准格式
fn normalize_locale(locale: &str) -> String {
    // 转换为小写并处理
    let lower = locale.to_lowercase();

    // 常见语言映射
    if lower.starts_with("zh") {
        if lower.contains("hans") || lower.contains("cn") || lower.contains("sg") {
            return "zh-CN".to_string(); // 简体中文
        } else if lower.contains("hant") || lower.contains("tw") || lower.contains("hk") {
            return "zh-TW".to_string(); // 繁体中文
        }
        return "zh-CN".to_string(); // 默认简体
    }

    if lower.starts_with("en") {
        return "en-US".to_string();
    }

    if lower.starts_with("ja") {
        return "ja-JP".to_string();
    }

    if lower.starts_with("ko") {
        return "ko-KR".to_string();
    }

    if lower.starts_with("fr") {
        return "fr-FR".to_string();
    }

    if lower.starts_with("de") {
        return "de-DE".to_string();
    }

    if lower.starts_with("es") {
        return "es-ES".to_string();
    }

    if lower.starts_with("ru") {
        return "ru-RU".to_string();
    }

    if lower.starts_with("ar") {
        return "ar-SA".to_string();
    }

    // 未知语言，返回原值或默认中文
    if locale.len() >= 2 {
        locale.to_string()
    } else {
        "zh-CN".to_string()
    }
}

#[cfg(test)]
#[allow(clippy::unwrap_used)]
mod tests {
    use super::*;

    #[test]
    fn test_normalize_locale_chinese() {
        assert_eq!(normalize_locale("zh-CN"), "zh-CN");
        assert_eq!(normalize_locale("zh-Hans-CN"), "zh-CN");
        assert_eq!(normalize_locale("zh-TW"), "zh-TW");
        assert_eq!(normalize_locale("zh-Hant-TW"), "zh-TW");
        assert_eq!(normalize_locale("zh"), "zh-CN");
    }

    #[test]
    fn test_normalize_locale_other() {
        assert_eq!(normalize_locale("en-US"), "en-US");
        assert_eq!(normalize_locale("en-GB"), "en-US");
        assert_eq!(normalize_locale("ja-JP"), "ja-JP");
        assert_eq!(normalize_locale("ja"), "ja-JP");
    }
}
