use crate::services::ConfigDraft;
use crate::services::ai::plugin_loader;
use crate::utils::logging::Type as LogType;
use crate::utils::paths;
use crate::{logging, logging_error};
use anyhow::{Context, Result};
use flexi_logger::{Cleanup, Criterion, Duplicate, FileSpec, LogSpecBuilder, Logger, WriteMode};
use std::sync::OnceLock;
use tokio::time::{Duration, timeout};

use crate::utils::logging::NoModuleFilter;

pub static LOGGER_HANDLE: OnceLock<flexi_logger::LoggerHandle> = OnceLock::new();

pub async fn init_app() -> Result<()> {
    paths::init_portable_flag()?;
    paths::init_app_directories()?;
    init_logger().await?;
    init_ai_providers()?;

    logging!(
        info,
        LogType::Init,
        "🚀 Application initialized successfully"
    );
    logging!(
        info,
        LogType::Init,
        "Portable mode: {}",
        *paths::PORTABLE_FLAG.get().unwrap_or(&false)
    );
    logging!(
        info,
        LogType::Init,
        "Home directory: {:?}",
        paths::app_home_dir()?
    );

    Ok(())
}

fn init_ai_providers() -> Result<()> {
    logging!(info, LogType::Init, "🔧 初始化 AI 供应商系统...");

    // 不再注册内置供应商，全部使用插件系统

    // 确定插件目录路径
    let plugins_dir = get_plugins_dir()?;

    logging!(info, LogType::Init, "🔧 插件目录路径: {:?}", plugins_dir);

    // 如果插件目录不存在，记录警告但不中断启动
    if !plugins_dir.exists() {
        logging!(
            info,
            LogType::Init,
            "⚠️ 插件目录不存在，请确保 plugins 目录已正确部署"
        );
        return Ok(());
    }

    plugin_loader::init_global_plugin_loader(&plugins_dir)?;

    match plugin_loader::load_all_plugins() {
        Ok(count) => {
            logging!(
                info,
                LogType::Init,
                "✅ 插件系统初始化完成，加载了 {} 个 AI 供应商",
                count
            );
        }
        Err(e) => {
            logging_error!(LogType::Init, "⚠️ 插件加载失败: {}", e);
        }
    }

    Ok(())
}

/// 获取插件目录路径
///
/// - 开发环境: 项目根目录的 plugins/
/// - 生产环境: 应用资源目录的 plugins/（由 Tauri bundle.resources 打包）
fn get_plugins_dir() -> anyhow::Result<std::path::PathBuf> {
    #[cfg(debug_assertions)]
    {
        // 开发环境：项目根目录的 plugins/
        let current_dir = std::env::current_dir().unwrap_or_else(|_| std::path::PathBuf::from("."));
        Ok(current_dir.parent().unwrap_or(&current_dir).join("plugins"))
    }

    #[cfg(not(debug_assertions))]
    {
        // 生产环境：从资源目录加载
        // Tauri bundle.resources 会将整个 plugins 目录打包到特定位置
        let exe_path = std::env::current_exe().context("获取可执行文件路径失败")?;

        // Windows: 可执行文件旁边的 plugins/
        // macOS: .app/Contents/Resources/plugins/
        // Linux: 可执行文件旁边的 plugins/
        #[cfg(target_os = "windows")]
        let plugins_dir = exe_path
            .parent()
            .map(|p| p.join("plugins"))
            .unwrap_or_else(|| exe_path.join("plugins"));

        #[cfg(target_os = "macos")]
        let plugins_dir = exe_path
            .parent()
            .and_then(|p| p.parent())
            .and_then(|p| p.parent())
            .and_then(|p| p.parent())
            .map(|p| p.join("Resources").join("plugins"))
            .unwrap_or_else(|| exe_path.join("plugins"));

        #[cfg(target_os = "linux")]
        let plugins_dir = exe_path
            .parent()
            .map(|p| p.join("plugins"))
            .unwrap_or_else(|| exe_path.join("plugins"));

        Ok(plugins_dir)
    }
}

async fn load_log_config() -> (usize, usize) {
    match timeout(Duration::from_millis(500), ConfigDraft::global()).await {
        Ok(draft) => {
            let config = draft.data();
            (
                config.log_max_size.unwrap_or(128) as usize * 1024,
                config.log_max_count.unwrap_or(8) as usize,
            )
        }
        Err(_) => {
            eprintln!("⚠️ 日志初始化: 配置加载超时，使用默认值");
            (128 * 1024, 8)
        }
    }
}

async fn init_logger() -> Result<()> {
    let log_dir = paths::app_logs_dir()?;
    if !log_dir.exists() {
        std::fs::create_dir_all(&log_dir)?;
    }

    let (log_max_size, log_max_count) = load_log_config().await;

    // 初始化 tracing 日志系统
    crate::utils::logger::init_tracing();

    let level = if cfg!(debug_assertions) {
        log::LevelFilter::Debug
    } else {
        log::LevelFilter::Info
    };

    let duplicate = if cfg!(debug_assertions) {
        Duplicate::Debug
    } else {
        Duplicate::Info
    };

    let filters = if cfg!(debug_assertions) {
        &[][..]
    } else {
        &["wry", "tauri", "tokio", "hyper"]
    };

    let spec = LogSpecBuilder::new().default(level).build();

    let logger = Logger::with(spec)
        .log_to_file(FileSpec::default().directory(&log_dir).basename("app"))
        .write_mode(WriteMode::BufferAndFlush)
        .duplicate_to_stdout(duplicate)
        .rotate(
            Criterion::Size(log_max_size as u64),
            flexi_logger::Naming::TimestampsCustomFormat {
                current_infix: Some("latest"),
                format: "%Y-%m-%d_%H-%M-%S",
            },
            Cleanup::KeepLogFiles(log_max_count),
        )
        .filter(Box::new(NoModuleFilter(filters)));

    let handle = logger.start()?;
    LOGGER_HANDLE.set(handle).ok();

    log::info!("日志系统初始化完成，路径: {:?}", log_dir);
    Ok(())
}

pub async fn delete_old_logs(retention_days: Option<u32>) -> Result<()> {
    let Some(days) = retention_days else {
        logging!(
            info,
            LogType::Init,
            "Log retention disabled, skipping cleanup"
        );
        return Ok(());
    };

    let log_dir = paths::app_logs_dir()?;
    if !log_dir.exists() {
        return Ok(());
    }

    logging!(
        info,
        LogType::Init,
        "Cleaning logs older than {} days",
        days
    );

    let now = chrono::Local::now();
    let cutoff = now - chrono::Duration::days(days as i64);

    let mut deleted_count = 0;
    let mut entries = tokio::fs::read_dir(&log_dir).await?;

    while let Some(entry) = entries.next_entry().await? {
        if let Ok(metadata) = entry.metadata().await
            && metadata.is_file()
            && let Ok(modified) = metadata.modified()
        {
            let modified_time: chrono::DateTime<chrono::Local> = modified.into();
            if modified_time < cutoff {
                if let Err(e) = tokio::fs::remove_file(entry.path()).await {
                    logging_error!(
                        LogType::Init,
                        "Failed to delete log file {:?}: {}",
                        entry.path(),
                        e
                    );
                } else {
                    deleted_count += 1;
                }
            }
        }
    }

    if deleted_count > 0 {
        logging!(
            info,
            LogType::Init,
            "Deleted {} old log files",
            deleted_count
        );
    }

    Ok(())
}

#[cfg(test)]
#[allow(clippy::unwrap_used)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_init_app() {
        let result = init_app().await;
        if result.is_err() {
            println!("Init failed (expected in test env): {:?}", result);
        }
    }

    #[tokio::test]
    async fn test_delete_old_logs() {
        let result = delete_old_logs(Some(7)).await;
        assert!(result.is_ok());
    }
}
