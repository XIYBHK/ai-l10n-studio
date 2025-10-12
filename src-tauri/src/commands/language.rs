// ========== Phase 5: 语言检测命令 ==========

use crate::services::language_detector::{
    Language, LanguageInfo, detect_language, get_default_target_language, get_supported_languages,
};

/// 检测文本语言
#[tauri::command]
pub async fn detect_text_language(text: String) -> Result<LanguageInfo, String> {
    detect_language(&text).map(|lang| lang.into()).map_err(|e| {
        let error_msg = format!("检测语言失败: {}", e);
        crate::app_log!("❌ {}", error_msg);
        error_msg
    })
}

/// 获取默认目标语言
#[tauri::command]
pub async fn get_default_target_lang(source_lang_code: String) -> Result<LanguageInfo, String> {
    Language::from_code(&source_lang_code)
        .ok_or_else(|| format!("不支持的语言代码: {}", source_lang_code))
        .map(|source_lang| get_default_target_language(source_lang))
        .map(|target_lang| target_lang.into())
}

/// 获取所有支持的语言列表
#[tauri::command]
pub async fn get_supported_langs() -> Result<Vec<LanguageInfo>, String> {
    Ok(get_supported_languages())
}
