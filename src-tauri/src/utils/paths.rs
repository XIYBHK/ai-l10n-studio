use anyhow::Result;
use once_cell::sync::OnceCell;
use std::{fs, path::PathBuf};

// ========== 应用标识符 ==========
// 用于配置文件路径（如 Windows: %APPDATA%/com.potranslator.gui）
pub static APP_ID: &str = "com.potranslator.gui";

// ========== 便携模式标志 ==========
// 全局便携模式标志（检测 .config/PORTABLE 文件）
pub static PORTABLE_FLAG: OnceCell<bool> = OnceCell::new();

/// 初始化便携模式标志
/// 在应用启动时调用，检测程序目录是否存在 .config/PORTABLE 文件
pub fn init_portable_flag() -> Result<()> {
    use tauri::utils::platform::current_exe;

    let app_exe = current_exe()?;
    if let Some(dir) = app_exe.parent() {
        let portable_marker = PathBuf::from(dir).join(".config/PORTABLE");

        if portable_marker.exists() {
            PORTABLE_FLAG.get_or_init(|| true);
            return Ok(());
        }
    }
    PORTABLE_FLAG.get_or_init(|| false);
    Ok(())
}

// ========== 核心路径获取函数 ==========

/// 获取应用主目录
/// - 便携模式：程序目录/.config/com.potranslator.gui
/// - 标准模式：系统数据目录/com.potranslator.gui
///   - Windows: %APPDATA%/com.potranslator.gui
///   - macOS: ~/Library/Application Support/com.potranslator.gui
///   - Linux: ~/.local/share/com.potranslator.gui
pub fn app_home_dir() -> Result<PathBuf> {
    let flag = PORTABLE_FLAG.get().unwrap_or(&false);
    
    if *flag {
        // 便携模式：使用程序目录
        use tauri::utils::platform::current_exe;
        let app_exe = current_exe()?;
        let app_exe = dunce::canonicalize(app_exe)?;
        let app_dir = app_exe
            .parent()
            .ok_or_else(|| anyhow::anyhow!("Failed to get portable app directory"))?;
        return Ok(PathBuf::from(app_dir).join(".config").join(APP_ID));
    }

    // 标准模式：使用系统数据目录
    let data_dir = dirs::data_dir()
        .ok_or_else(|| anyhow::anyhow!("Failed to get system data directory"))?;
    Ok(data_dir.join(APP_ID))
}

/// 获取日志目录
/// 路径：app_home_dir/logs
pub fn app_logs_dir() -> Result<PathBuf> {
    Ok(app_home_dir()?.join("logs"))
}

/// 获取数据目录（翻译记忆库、术语库等）
/// 路径：app_home_dir/data
pub fn app_data_dir() -> Result<PathBuf> {
    Ok(app_home_dir()?.join("data"))
}

/// 获取资源目录（语言文件等）
/// 标准模式下，资源文件打包在应用内部
pub fn app_resources_dir() -> Result<PathBuf> {
    // 简化实现：资源文件在便携模式和标准模式下都使用相对路径
    // Tauri 会自动处理资源打包
    use tauri::utils::platform::current_exe;
    let app_exe = current_exe()?;
    if let Some(exe_dir) = app_exe.parent() {
        return Ok(PathBuf::from(exe_dir).join("resources"));
    }
    Err(anyhow::anyhow!("Failed to get resource directory"))
}

// ========== 辅助函数 ==========

/// 将 PathBuf 转换为 &str
pub fn path_to_str(path: &PathBuf) -> Result<&str> {
    path.as_os_str()
        .to_str()
        .ok_or_else(|| anyhow::anyhow!("Failed to convert path to string: {:?}", path))
}

/// 确保目录存在，如果不存在则创建
pub fn ensure_dir(path: &PathBuf) -> Result<()> {
    if !path.exists() {
        fs::create_dir_all(path)
            .map_err(|e| anyhow::anyhow!("Failed to create directory {:?}: {}", path, e))?;
    }
    Ok(())
}

// ========== 专用路径函数（兼容现有代码）==========

/// 获取翻译记忆库路径
/// 路径：app_data_dir/translation_memory.json
pub fn get_translation_memory_path() -> PathBuf {
    app_data_dir()
        .map(|dir| dir.join("translation_memory.json"))
        .unwrap_or_else(|_| {
            // 降级：使用旧的用户目录路径
            let mut path = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
            path.push(".po-translator");
            path.push("translation_memory.json");
            path
        })
}

/// 确保翻译记忆库目录存在
pub fn ensure_tm_dir() -> std::io::Result<()> {
    let tm_path = get_translation_memory_path();
    if let Some(parent) = tm_path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    Ok(())
}

// ========== 初始化函数 ==========

/// 初始化应用目录结构
/// 创建必要的目录：logs, data
pub fn init_app_directories() -> Result<()> {
    ensure_dir(&app_home_dir()?)?;
    ensure_dir(&app_logs_dir()?)?;
    ensure_dir(&app_data_dir()?)?;
    Ok(())
}

// ========== 测试 ==========

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_portable_flag_init() {
        let result = init_portable_flag();
        assert!(result.is_ok());
        assert!(PORTABLE_FLAG.get().is_some());
    }

    #[test]
    fn test_app_home_dir() {
        let _ = init_portable_flag();
        let result = app_home_dir();
        assert!(result.is_ok());
        let path = result.unwrap();
        assert!(path.to_string_lossy().contains(APP_ID));
    }

    #[test]
    fn test_app_logs_dir() {
        let _ = init_portable_flag();
        let result = app_logs_dir();
        assert!(result.is_ok());
        let path = result.unwrap();
        assert!(path.to_string_lossy().contains("logs"));
    }

    #[test]
    fn test_app_data_dir() {
        let _ = init_portable_flag();
        let result = app_data_dir();
        assert!(result.is_ok());
        let path = result.unwrap();
        assert!(path.to_string_lossy().contains("data"));
    }
}
