use crate::services::ConfigDraft;
use crate::services::ai::plugin_loader;
use crate::services::ai::providers::register_all_providers;
use crate::utils::logging::Type as LogType;
use crate::utils::paths;
use crate::{logging, logging_error};
use anyhow::Result;
use flexi_logger::{Cleanup, Criterion, Duplicate, FileSpec, LogSpecBuilder, Logger};

#[cfg(not(debug_assertions))]
use crate::utils::logging::NoModuleFilter;

/// 初始化应用程序
/// 步骤：
/// 1. 初始化便携模式标志
/// 2. 创建目录结构
/// 3. 初始化日志系统
pub async fn init_app() -> Result<()> {
    // Step 1: 初始化便携模式（检测 .config/PORTABLE 文件）
    paths::init_portable_flag()?;

    // Step 2: 创建必要的目录结构
    paths::init_app_directories()?;

    // Step 3: 初始化日志系统
    init_logger().await?;

    // Step 4: 初始化 AI 供应商系统
    init_ai_providers().await?;

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

/// 初始化 AI 供应商系统
/// 步骤：
/// 1. 注册内置供应商（向后兼容）
/// 2. 初始化插件加载器
/// 3. 加载所有插件供应商
async fn init_ai_providers() -> Result<()> {
    // Step 1: 注册内置供应商（Phase 1-2 兼容）
    register_all_providers()?;
    
    // Step 2: 初始化插件系统
    // 🔧 开发模式：使用项目根目录的 plugins 文件夹（从 src-tauri 向上一级）
    #[cfg(debug_assertions)]
    let plugins_dir = {
        let current_dir = std::env::current_dir().unwrap_or_else(|_| {
            std::path::PathBuf::from(".")
        });
        // Tauri 开发模式下当前目录是 src-tauri，需要向上一级到项目根目录
        current_dir.parent().unwrap_or(&current_dir).join("plugins")
    };
    
    // 生产模式：使用用户数据目录的 plugins 文件夹
    #[cfg(not(debug_assertions))]
    let plugins_dir = paths::app_home_dir()?.join("plugins");
    
    logging!(
        info,
        LogType::Init,
        "🔧 插件目录路径: {:?}",
        plugins_dir
    );
    
    plugin_loader::init_global_plugin_loader(&plugins_dir)?;
    
    // Step 3: 加载所有插件供应商
    match plugin_loader::load_all_plugins() {
        Ok(count) => {
            logging!(
                info,
                LogType::Init,
                "🔌 插件系统初始化完成，加载了 {} 个插件供应商",
                count
            );
        }
        Err(e) => {
            logging_error!(
                LogType::Init,
                "⚠️ 插件加载部分失败: {}，将继续使用内置供应商",
                e
            );
        }
    }

    Ok(())
}

/// 初始化日志系统（使用 flexi_logger）
/// 配置：
/// - 日志级别：DEBUG（开发）/ INFO（生产）
/// - 日志文件：app_logs_dir/latest.log
/// - 日志轮转：从配置读取大小和文件数
/// - 日志清理：保留最近 N 天的日志
#[cfg(not(debug_assertions))]
async fn init_logger() -> Result<()> {
    // 从配置读取日志参数（参考 clash-verge-rev）
    let (log_max_size, log_max_count) = {
        let draft = ConfigDraft::global().await;
        let config = draft.data();
        (
            config.log_max_size.unwrap_or(128), // 默认 128KB
            config.log_max_count.unwrap_or(8),  // 默认 8 个文件
        )
    };

    let log_dir = paths::app_logs_dir()?;
    let spec = LogSpecBuilder::new()
        .default(log::LevelFilter::Info)
        .build();

    // 生产环境：过滤噪音模块
    let logger = Logger::with(spec)
        .log_to_file(FileSpec::default().directory(&log_dir).basename("app"))
        .duplicate_to_stdout(Duplicate::Info)
        .rotate(
            Criterion::Size((log_max_size * 1024) as u64), // 配置项：单个文件最大大小
            flexi_logger::Naming::TimestampsCustomFormat {
                current_infix: Some("latest"),
                format: "%Y-%m-%d_%H-%M-%S",
            },
            Cleanup::KeepLogFiles(log_max_count as usize), // 配置项：保留文件数量
        )
        .filter(Box::new(NoModuleFilter(&[
            "wry", "tauri", "tokio", "hyper",
        ])));

    logger.start()?;
    Ok(())
}

/// 开发环境：不过滤模块，输出更详细的日志
#[cfg(debug_assertions)]
async fn init_logger() -> Result<()> {
    // 从配置读取日志参数（参考 clash-verge-rev）
    let (log_max_size, log_max_count) = {
        let draft = ConfigDraft::global().await;
        let config = draft.data();
        (
            config.log_max_size.unwrap_or(128), // 默认 128KB
            config.log_max_count.unwrap_or(8),  // 默认 8 个文件
        )
    };

    let log_dir = paths::app_logs_dir()?;
    let spec = LogSpecBuilder::new()
        .default(log::LevelFilter::Debug)
        .build();

    let logger = Logger::with(spec)
        .log_to_file(FileSpec::default().directory(&log_dir).basename("app"))
        .duplicate_to_stdout(Duplicate::Debug)
        .rotate(
            Criterion::Size((log_max_size * 1024) as u64), // 配置项：单个文件最大大小
            flexi_logger::Naming::TimestampsCustomFormat {
                current_infix: Some("latest"),
                format: "%Y-%m-%d_%H-%M-%S",
            },
            Cleanup::KeepLogFiles(log_max_count as usize), // 配置项：保留文件数量
        );

    logger.start()?;
    Ok(())
}

// ========== 日志清理工具 ==========

/// 清理旧日志文件（根据配置的保留天数）
/// 参数：retention_days - 保留天数（None 表示不清理）
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

// ========== 测试 ==========

#[cfg(test)]
#[allow(clippy::unwrap_used)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_init_app() {
        let result = init_app().await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_delete_old_logs() {
        let result = delete_old_logs(Some(7)).await;
        assert!(result.is_ok());
    }
}
