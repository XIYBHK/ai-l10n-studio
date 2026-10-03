/// 配置同步命令
/// 用于前后端配置版本验证和同步
use crate::services::{ConfigDraft, ConfigVersionInfo};

/// 获取配置版本信息
#[tauri::command]
pub async fn get_config_version() -> Result<ConfigVersionInfo, String> {
    let draft = ConfigDraft::global().await;
    let config = draft.data();
    let cfg = &**config; // 解引用 Box<AppConfig>

    Ok(ConfigVersionInfo {
        version: cfg.config_version,
        timestamp: cfg.last_modified.clone().unwrap_or_default(),
        default_model: cfg.default_model.clone(),
        config_count: cfg.model_providers.len(),
    })
}
