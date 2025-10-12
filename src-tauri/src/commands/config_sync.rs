/// 配置同步命令
/// 用于前后端配置版本验证和同步

use crate::services::{ConfigManager, ConfigVersionInfo, ConfigDraft};

/// 获取配置版本信息
#[tauri::command]
pub async fn get_config_version() -> Result<ConfigVersionInfo, String> {
    let draft = ConfigDraft::global().await;
    let config = draft.data();
    let active_config_index = config.get_active_ai_config_index();
    let config_count = config.get_all_ai_configs().len();
    
    Ok(ConfigVersionInfo {
        version: config.version,
        timestamp: config.last_modified.clone(),
        active_config_index,
        config_count,
    })
}

