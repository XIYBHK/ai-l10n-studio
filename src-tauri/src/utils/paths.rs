use anyhow::Result;
use once_cell::sync::OnceCell;
use std::{fs, path::PathBuf};

pub static APP_ID: &str = "com.potranslator.gui";
pub static PORTABLE_FLAG: OnceCell<bool> = OnceCell::new();

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

pub fn app_home_dir() -> Result<PathBuf> {
    let flag = PORTABLE_FLAG.get().unwrap_or(&false);

    if *flag {
        use tauri::utils::platform::current_exe;
        let app_exe = current_exe()?;
        let app_exe = dunce::canonicalize(app_exe)?;
        let app_dir = app_exe
            .parent()
            .ok_or_else(|| anyhow::anyhow!("Failed to get portable app directory"))?;
        return Ok(PathBuf::from(app_dir).join(".config").join(APP_ID));
    }

    let data_dir =
        dirs::data_dir().ok_or_else(|| anyhow::anyhow!("Failed to get system data directory"))?;
    Ok(data_dir.join(APP_ID))
}

pub fn app_logs_dir() -> Result<PathBuf> {
    Ok(app_home_dir()?.join("logs"))
}

pub fn app_data_dir() -> Result<PathBuf> {
    Ok(app_home_dir()?.join("data"))
}

pub fn app_resources_dir() -> Result<PathBuf> {
    use tauri::utils::platform::current_exe;
    let app_exe = current_exe()?;
    if let Some(exe_dir) = app_exe.parent() {
        return Ok(PathBuf::from(exe_dir).join("resources"));
    }
    Err(anyhow::anyhow!("Failed to get resource directory"))
}

pub fn path_to_str(path: &PathBuf) -> Result<&str> {
    path.as_os_str()
        .to_str()
        .ok_or_else(|| anyhow::anyhow!("Failed to convert path to string: {:?}", path))
}

pub fn ensure_dir(path: &PathBuf) -> Result<()> {
    if !path.exists() {
        fs::create_dir_all(path)
            .map_err(|e| anyhow::anyhow!("Failed to create directory {:?}: {}", path, e))?;
    }
    Ok(())
}

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

pub fn ensure_tm_dir() -> std::io::Result<()> {
    let tm_path = get_translation_memory_path();
    if let Some(parent) = tm_path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    Ok(())
}

pub fn get_term_library_path() -> PathBuf {
    app_data_dir()
        .map(|dir| dir.join("term_library.json"))
        .unwrap_or_else(|_| {
            // 降级：使用程序目录
            let mut path = std::env::current_exe()
                .ok()
                .and_then(|p| p.parent().map(|p| p.to_path_buf()))
                .unwrap_or_else(|| PathBuf::from("."));
            path.push("data");
            path.push("term_library.json");
            path
        })
}

pub fn init_app_directories() -> Result<()> {
    ensure_dir(&app_home_dir()?)?;
    ensure_dir(&app_logs_dir()?)?;
    ensure_dir(&app_data_dir()?)?;
    Ok(())
}

#[cfg(test)]
#[allow(clippy::unwrap_used)]
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
