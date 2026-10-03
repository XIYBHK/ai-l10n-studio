// 日志相关命令 - 读取实际日志文件而非内存缓冲区
#[tauri::command]
pub fn get_app_logs() -> Result<Vec<String>, String> {
    use std::fs;

    // 优先读取实际的日志文件，而不是内存缓冲区
    match crate::utils::paths::app_logs_dir() {
        Ok(log_dir) => {
            // 查找最新的应用日志文件（按修改时间排序）
            if let Ok(entries) = fs::read_dir(&log_dir) {
                let mut app_log_files: Vec<_> = entries
                    .filter_map(|entry| entry.ok())
                    .filter(|entry| {
                        entry.file_name().to_string_lossy().starts_with("app")
                            && entry.file_name().to_string_lossy().ends_with(".log")
                    })
                    .collect();

                // 按修改时间排序，最新的在前
                app_log_files.sort_by_key(|entry| {
                    entry
                        .metadata()
                        .and_then(|m| m.modified())
                        .unwrap_or(std::time::SystemTime::UNIX_EPOCH)
                });
                app_log_files.reverse();

                // 只读取最新的日志文件（最清晰简洁）
                if let Some(latest_log) = app_log_files.first() {
                    if let Ok(content) = fs::read_to_string(latest_log.path()) {
                        let lines: Vec<String> = content
                            .lines()
                            .filter(|line| !line.trim().is_empty()) // 过滤空行
                            .map(|line| line.to_string())
                            .collect();

                        if !lines.is_empty() {
                            return Ok(lines);
                        }
                    }
                }
            }

            // 降级：如果没有找到日志文件，使用内存缓冲区
            Ok(crate::utils::logger::get_logs())
        }
        Err(_) => {
            // 降级：如果无法获取日志目录，使用内存缓冲区
            Ok(crate::utils::logger::get_logs())
        }
    }
}

#[tauri::command]
pub fn clear_app_logs() -> Result<(), crate::error::AppError> {
    clear_log_files(
        &crate::utils::paths::app_logs_dir()
            .map_err(|error| crate::error::AppError::config(error.to_string()))?,
    )?;
    crate::utils::logger::clear_logs();
    Ok(())
}

fn clear_log_files(directory: &std::path::Path) -> Result<(), crate::error::AppError> {
    let entries = match std::fs::read_dir(directory) {
        Ok(entries) => entries,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(()),
        Err(error) => return Err(error.into()),
    };
    for entry in entries {
        let entry = entry?;
        let path = entry.path();
        if entry.file_type()?.is_file() && path.extension().is_some_and(|ext| ext == "log") {
            std::fs::write(path, "")?;
        }
    }
    Ok(())
}

// 获取前端日志文件内容（优先从统一日志目录读取）
#[tauri::command]
pub fn get_frontend_logs() -> Result<Vec<String>, String> {
    use std::fs;

    crate::app_log!("[前端日志] 开始读取前端日志文件");

    // 优先尝试从统一日志目录读取
    let mut log_directories = Vec::new();

    // 1. 统一日志目录（优先）
    if let Ok(log_dir) = crate::utils::paths::app_logs_dir() {
        log_directories.push((log_dir, "统一日志目录"));
    }

    // 2. AppData/data 目录（回退）
    if let Ok(data_dir) = crate::utils::paths::app_data_dir() {
        log_directories.push((data_dir, "AppData数据目录"));
    }

    let mut all_lines = Vec::new();
    let mut found_files = 0;

    // 尝试从各个目录读取前端日志
    for (dir_path, dir_name) in log_directories {
        if !dir_path.exists() {
            crate::app_log!("[前端日志] {} 不存在: {:?}", dir_name, dir_path);
            continue;
        }

        crate::app_log!("[前端日志] 检查 {}: {:?}", dir_name, dir_path);

        // 查找前端日志文件
        match fs::read_dir(&dir_path) {
            Ok(entries) => {
                let mut frontend_log_files: Vec<_> = entries
                    .filter_map(|entry| entry.ok())
                    .filter(|entry| {
                        let file_name = entry.file_name();
                        let name = file_name.to_string_lossy();
                        name.starts_with("frontend-") && name.ends_with(".log")
                    })
                    .collect();

                if frontend_log_files.is_empty() {
                    crate::app_log!("[前端日志] {} 中没有前端日志文件", dir_name);
                    continue;
                }

                // 按修改时间排序，最新的在前
                frontend_log_files.sort_by_key(|entry| {
                    entry
                        .metadata()
                        .and_then(|m| m.modified())
                        .unwrap_or(std::time::SystemTime::UNIX_EPOCH)
                });
                frontend_log_files.reverse();

                crate::app_log!(
                    "[前端日志] {} 找到 {} 个前端日志文件",
                    dir_name,
                    frontend_log_files.len()
                );

                // 读取最多3个最新的前端日志文件
                for (i, entry) in frontend_log_files.iter().take(3).enumerate() {
                    if found_files > 0 || i > 0 {
                        all_lines.push(format!(
                            "========== {} ==========",
                            entry.file_name().to_string_lossy()
                        ));
                    }

                    if let Ok(content) = fs::read_to_string(entry.path()) {
                        let lines: Vec<String> =
                            content.lines().map(|line| line.to_string()).collect();
                        let lines_count = lines.len(); // 在移动前保存长度
                        all_lines.extend(lines);
                        found_files += 1;

                        crate::app_log!(
                            "[前端日志] 读取文件: {} ({} 行)",
                            entry.file_name().to_string_lossy(),
                            lines_count
                        );
                    }
                }

                // 如果找到了文件，就不再继续查找其他目录
                if found_files > 0 {
                    break;
                }
            }
            Err(e) => {
                crate::app_log!("[前端日志] 无法读取 {}: {}", dir_name, e);
            }
        }
    }

    if found_files == 0 {
        crate::app_log!("[前端日志] 所有目录都没有找到前端日志文件");
        return Ok(Vec::new());
    }

    crate::app_log!(
        "[前端日志] 读取完成，共 {} 个文件，{} 行",
        found_files,
        all_lines.len()
    );
    Ok(all_lines)
}

#[cfg(test)]
#[allow(clippy::unwrap_used)]
mod tests {
    use super::clear_log_files;
    #[test]
    fn clears_log_contents_without_removing_files_or_other_data() {
        let dir = tempfile::tempdir().unwrap();
        let log = dir.path().join("app.log");
        let other = dir.path().join("config.json");
        std::fs::write(&log, "record").unwrap();
        std::fs::write(&other, "keep").unwrap();
        clear_log_files(dir.path()).unwrap();
        assert_eq!(std::fs::read(&log).unwrap(), b"");
        assert_eq!(std::fs::read_to_string(other).unwrap(), "keep");
    }
    #[test]
    fn clear_propagates_directory_errors_and_accepts_missing_directory() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("file");
        std::fs::write(&file, "keep").unwrap();
        assert!(clear_log_files(&file).is_err());
        assert!(clear_log_files(&dir.path().join("missing")).is_ok());
    }
}
