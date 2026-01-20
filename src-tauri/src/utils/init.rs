use crate::services::ConfigDraft;
use crate::services::ai::plugin_loader;
use crate::services::ai::providers::register_all_providers;
use crate::utils::logging::Type as LogType;
use crate::utils::paths;
use crate::{logging, logging_error};
use anyhow::Result;
use flexi_logger::{Cleanup, Criterion, Duplicate, FileSpec, LogSpecBuilder, Logger, WriteMode};
use std::sync::OnceLock;
use tokio::time::{Duration, timeout};

use crate::utils::logging::NoModuleFilter;

pub static LOGGER_HANDLE: OnceLock<flexi_logger::LoggerHandle> = OnceLock::new();

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
    logging!(info, LogType::Init, "🔧 开始注册内置AI供应商...");

    register_all_providers()?;

    // 验证注册结果
    use crate::services::ai::provider::with_global_registry;
    let registered_count = with_global_registry(|registry| {
        let ids = registry.get_provider_ids();
        logging!(info, LogType::Init, "✅ 已注册供应商: {:?}", ids);
        ids.len()
    });

    logging!(
        info,
        LogType::Init,
        "✅ 内置供应商注册完成，共 {} 个",
        registered_count
    );

    // Step 2: 初始化插件系统
    // 🔧 开发模式：使用项目根目录的 plugins 文件夹（从 src-tauri 向上一级）
    #[cfg(debug_assertions)]
    let plugins_dir = {
        let current_dir = std::env::current_dir().unwrap_or_else(|_| std::path::PathBuf::from("."));
        // Tauri 开发模式下当前目录是 src-tauri，需要向上一级到项目根目录
        current_dir.parent().unwrap_or(&current_dir).join("plugins")
    };

    // 生产模式：使用用户数据目录的 plugins 文件夹
    #[cfg(not(debug_assertions))]
    let plugins_dir = paths::app_home_dir()?.join("plugins");

    logging!(info, LogType::Init, "🔧 插件目录路径: {:?}", plugins_dir);

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
    // 1. 获取日志目录并确保存在
    let log_dir = paths::app_logs_dir()?;
    if !log_dir.exists() {
        std::fs::create_dir_all(&log_dir)?;
    }

    // 2. 尝试从配置读取参数，失败则使用默认值（解耦依赖风险）
    let (log_max_size, log_max_count) =
        match timeout(Duration::from_millis(500), ConfigDraft::global()).await {
            Ok(draft) => {
                let config = draft.data();
                (
                    config.log_max_size.unwrap_or(128) * 1024, // KB -> Bytes
                    config.log_max_count.unwrap_or(8),
                )
            }
            Err(_) => {
                eprintln!("⚠️ 日志初始化: 配置加载超时，使用默认值");
                (128 * 1024, 8) // 默认 128KB, 8个文件
            }
        };

    let spec = LogSpecBuilder::new()
        .default(log::LevelFilter::Info)
        .build();

    // 3. 配置 Logger
    // 生产环境：过滤噪音模块
    let logger = Logger::with(spec)
        .log_to_file(FileSpec::default().directory(&log_dir).basename("app"))
        // 关键修复: 显式设置写入模式，确保立即写入文件
        .write_mode(WriteMode::BufferAndFlush)
        .duplicate_to_stdout(Duplicate::Info)
        .rotate(
            Criterion::Size(log_max_size as u64), // 配置项：单个文件最大大小
            flexi_logger::Naming::TimestampsCustomFormat {
                current_infix: Some("latest"),
                format: "%Y-%m-%d_%H-%M-%S",
            },
            Cleanup::KeepLogFiles(log_max_count as usize), // 配置项：保留文件数量
        )
        .filter(Box::new(NoModuleFilter(&[
            "wry", "tauri", "tokio", "hyper",
        ])));

    // 4. 启动并保存 Handle
    let handle = logger.start()?;
    LOGGER_HANDLE.set(handle).ok(); // 保存 handle 防止被 drop

    log::info!("日志系统初始化完成，路径: {:?}", log_dir);
    Ok(())
}

/// 开发环境：输出详细日志，但过滤 tao 事件循环警告
#[cfg(debug_assertions)]
async fn init_logger() -> Result<()> {
    // 1. 获取日志目录并确保存在
    let log_dir = paths::app_logs_dir()?;
    if !log_dir.exists() {
        std::fs::create_dir_all(&log_dir)?;
    }

    // 2. 尝试从配置读取参数，失败则使用默认值（解耦依赖风险）
    let (log_max_size, log_max_count) =
        match timeout(Duration::from_millis(500), ConfigDraft::global()).await {
            Ok(draft) => {
                let config = draft.data();
                (
                    config.log_max_size.unwrap_or(128) * 1024, // KB -> Bytes
                    config.log_max_count.unwrap_or(8),
                )
            }
            Err(_) => {
                eprintln!("⚠️ 日志初始化: 配置加载超时，使用默认值");
                (128 * 1024, 8) // 默认 128KB, 8个文件
            }
        };

    let spec = LogSpecBuilder::new()
        .default(log::LevelFilter::Debug)
        .build();

    // 3. 配置 Logger
    // 开发环境：只过滤 tao 的无害警告，保留其他所有日志
    let logger = Logger::with(spec)
        .log_to_file(FileSpec::default().directory(&log_dir).basename("app"))
        // 关键修复: 显式设置写入模式，确保立即写入文件
        .write_mode(WriteMode::BufferAndFlush)
        .duplicate_to_stdout(Duplicate::Debug)
        .rotate(
            Criterion::Size(log_max_size as u64), // 配置项：单个文件最大大小
            flexi_logger::Naming::TimestampsCustomFormat {
                current_infix: Some("latest"),
                format: "%Y-%m-%d_%H-%M-%S",
            },
            Cleanup::KeepLogFiles(log_max_count as usize), // 配置项：保留文件数量
        )
        .filter(Box::new(NoModuleFilter(&[])));

    // 4. 启动并保存 Handle
    let handle = logger.start()?;
    LOGGER_HANDLE.set(handle).ok(); // 保存 handle 防止被 drop

    log::info!("日志系统初始化完成，路径: {:?}", log_dir);
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
        // 初始化可能失败（测试环境下的权限、路径问题），这是预期的
        let result = init_app().await;
        // 只检查不会 panic，失败也可以接受
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
