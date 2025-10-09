/// 提示词日志相关的 Tauri 命令

/// 获取提示词日志（格式化的文本）
#[tauri::command]
pub fn get_prompt_logs() -> Result<String, String> {
    Ok(crate::services::format_prompt_logs())
}

/// 清空提示词日志
#[tauri::command]
pub fn clear_prompt_logs() -> Result<(), String> {
    crate::services::clear_prompt_logs();
    Ok(())
}

