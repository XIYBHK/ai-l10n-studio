use crate::services::language_detector::{
    Language, LanguageInfo, detect_language, get_default_target_language, get_supported_languages,
};

#[tauri::command]
pub fn detect_text_language(text: String) -> Result<LanguageInfo, String> {
    detect_language(&text).map(|lang| lang.into()).map_err(|e| {
        let error_msg = format!("检测语言失败: {}", e);
        crate::app_log!("❌ {}", error_msg);
        error_msg
    })
}

#[tauri::command]
pub fn get_default_target_lang(source_lang_code: String) -> Result<LanguageInfo, String> {
    let source_lang = Language::from_code(&source_lang_code).ok_or_else(|| {
        crate::app_log!("❌ [语言检测] 不支持的语言代码: {}", source_lang_code);
        format!("不支持的语言代码: {}", source_lang_code)
    })?;

    let target_lang = get_default_target_language(source_lang);
    let target_info: LanguageInfo = target_lang.into();

    crate::app_log!(
        "✅ [语言检测] 推荐目标语言: {} ({})",
        target_info.display_name,
        target_info.code
    );

    Ok(target_info)
}

#[tauri::command]
pub fn get_supported_langs() -> Result<Vec<LanguageInfo>, String> {
    Ok(get_supported_languages())
}
