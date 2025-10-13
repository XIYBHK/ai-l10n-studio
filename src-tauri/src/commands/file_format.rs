// ========== Phase 4: 文件格式检测命令 ==========

use crate::services::file_format::{FileFormat, FileMetadata};

/// 检测文件格式
#[tauri::command]
pub fn detect_file_format(file_path: String) -> Result<FileFormat, String> {
    crate::services::file_format::detect_file_format(&file_path)
        .inspect(|format| {
            crate::app_log!("[文件格式] {} → {:?}", file_path, format);
        })
        .map_err(|e| {
            let error_msg = format!("检测文件格式失败: {}", e);
            crate::app_log!("❌ {}", error_msg);
            error_msg
        })
}

/// 获取文件元数据
#[tauri::command]
pub fn get_file_metadata(file_path: String) -> Result<FileMetadata, String> {
    crate::services::file_format::get_file_metadata(&file_path).map_err(|e| {
        let error_msg = format!("获取文件元数据失败: {}", e);
        crate::app_log!("❌ {}", error_msg);
        error_msg
    })
}
