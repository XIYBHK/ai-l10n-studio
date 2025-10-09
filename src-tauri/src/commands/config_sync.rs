/// 配置同步命令
/// 用于前后端配置版本验证和同步

use crate::services::{ConfigManager, ConfigVersionInfo};

/// 获取配置版本信息
#[tauri::command]
pub fn get_config_version() -> Result<ConfigVersionInfo, String> {
    let manager = ConfigManager::new(None).map_err(|e| e.to_string())?;
    Ok(manager.get_config_version_info())
}

