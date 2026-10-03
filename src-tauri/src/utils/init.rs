use crate::services::ai::plugin_loader;
use crate::services::{AppConfig, ConfigDraft};
use crate::utils::logging::NoModuleFilter;
use crate::utils::logging::Type as LogType;
use crate::utils::paths;
use crate::{logging, logging_error};
#[cfg(not(debug_assertions))]
use anyhow::Context;
use anyhow::Result;
use flexi_logger::{
    Cleanup, Criterion, Duplicate, FileSpec, LogSpecBuilder, LogSpecification, Logger, WriteMode,
};
use std::path::{Path, PathBuf};
use std::sync::OnceLock;

pub static LOGGER_HANDLE: OnceLock<flexi_logger::LoggerHandle> = OnceLock::new();

pub async fn init_app(resource_dir: Option<&Path>) -> Result<()> {
    paths::init_portable_flag()?;
    paths::init_app_directories()?;
    let config = (**ConfigDraft::global().await.data()).clone();
    init_logger(&config)?;
    delete_old_logs(config.log_retention_days).await?;
    init_ai_providers(resource_dir)?;

    logging!(info, LogType::Init, "Application initialized successfully");
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

fn init_ai_providers(resource_dir: Option<&Path>) -> Result<()> {
    logging!(info, LogType::Init, "Initializing AI providers...");

    let plugins_dir = get_plugins_dir(resource_dir)?;

    logging!(info, LogType::Init, "Plugin directory: {:?}", plugins_dir);

    if !plugins_dir.exists() {
        anyhow::bail!("Plugin directory is missing: {:?}", plugins_dir);
    }

    plugin_loader::init_global_plugin_loader(&plugins_dir)?;

    let count = plugin_loader::load_all_plugins()?;
    anyhow::ensure!(
        count > 0,
        "No AI providers were loaded from {:?}",
        plugins_dir
    );
    logging!(info, LogType::Init, "Loaded {} AI providers", count);

    Ok(())
}

fn get_plugins_dir(resource_dir: Option<&Path>) -> anyhow::Result<PathBuf> {
    #[cfg(debug_assertions)]
    {
        let _ = resource_dir;
        let manifest_dir = Path::new(env!("CARGO_MANIFEST_DIR"));
        Ok(manifest_dir.join("..").join("plugins"))
    }

    #[cfg(not(debug_assertions))]
    {
        let resource_dir = resource_dir.context("resource_dir is required in release builds")?;
        Ok(resource_dir.join("_up_").join("plugins"))
    }
}

pub fn validate_log_settings(config: &AppConfig) -> Result<()> {
    if !matches!(
        config.log_level.as_str(),
        "trace" | "debug" | "info" | "warn" | "error"
    ) {
        anyhow::bail!("invalid log level: {}", config.log_level);
    }
    if config.log_max_size.unwrap_or(128) == 0 || config.log_max_count.unwrap_or(8) == 0 {
        anyhow::bail!("log size and count must be positive");
    }
    if config.log_retention_days.is_some_and(|days| days > 365) {
        anyhow::bail!("log retention must be between 0 and 365 days");
    }
    Ok(())
}

pub fn apply_log_settings(config: &AppConfig) -> Result<()> {
    validate_log_settings(config)?;
    let Some(handle) = LOGGER_HANDLE.get() else {
        return Ok(());
    };
    let spec = LogSpecification::parse(&config.log_level)
        .map_err(|error| anyhow::anyhow!("invalid log level: {error}"))?;
    handle.set_new_spec(spec);
    Ok(())
}

fn init_logger(config: &AppConfig) -> Result<()> {
    let log_dir = paths::app_logs_dir()?;
    if !log_dir.exists() {
        std::fs::create_dir_all(&log_dir)?;
    }

    validate_log_settings(config)?;
    let log_max_size = config.log_max_size.unwrap_or(128) as usize * 1024;
    let log_max_count = config.log_max_count.unwrap_or(8) as usize;

    crate::utils::logger::init_tracing();

    let level = config
        .log_level
        .parse::<log::LevelFilter>()
        .unwrap_or(log::LevelFilter::Info);

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

    let handle = logger
        .start()
        .map_err(|error| anyhow::anyhow!("logger.start failed: {error:?}"))?;
    LOGGER_HANDLE.set(handle).ok();

    log::info!("Logger initialized at {:?}", log_dir);
    Ok(())
}

pub async fn delete_old_logs(retention_days: Option<u32>) -> Result<()> {
    delete_old_logs_in(&paths::app_logs_dir()?, retention_days).await
}

async fn delete_old_logs_in(log_dir: &Path, retention_days: Option<u32>) -> Result<()> {
    let Some(days) = retention_days else {
        logging!(
            info,
            LogType::Init,
            "Log retention disabled, skipping cleanup"
        );
        return Ok(());
    };
    if days == 0 {
        return Ok(());
    }

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
            let file_name = entry.file_name().to_string_lossy().to_string();
            let is_app_log = file_name.starts_with("app_");
            let is_current_log = file_name.contains("latest");
            if modified_time < cutoff && is_app_log && !is_current_log {
                if let Err(error) = tokio::fs::remove_file(entry.path()).await {
                    logging_error!(
                        LogType::Init,
                        "Failed to delete log file {:?}: {}",
                        entry.path(),
                        error
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
    async fn test_delete_old_logs() {
        let dir = tempfile::tempdir().unwrap();
        for file in ["app_old.log", "app_latest.log", "unrelated.log"] {
            let path = dir.path().join(file);
            std::fs::write(&path, "log").unwrap();
            let handle = std::fs::File::options().write(true).open(path).unwrap();
            handle
                .set_modified(std::time::SystemTime::UNIX_EPOCH)
                .unwrap();
        }
        delete_old_logs_in(dir.path(), Some(0)).await.unwrap();
        assert!(dir.path().join("app_old.log").exists());
        delete_old_logs_in(dir.path(), Some(7)).await.unwrap();
        assert!(!dir.path().join("app_old.log").exists());
        assert!(dir.path().join("app_latest.log").exists());
        assert!(dir.path().join("unrelated.log").exists());
    }

    #[cfg(debug_assertions)]
    #[test]
    fn debug_plugins_dir_is_repository_plugins() {
        let manifest_dir = Path::new(env!("CARGO_MANIFEST_DIR"));
        let expected = manifest_dir.join("..").join("plugins");
        assert_eq!(get_plugins_dir(None).unwrap(), expected);
    }

    #[test]
    fn default_log_settings_are_valid() {
        assert!(validate_log_settings(&AppConfig::default()).is_ok());
    }
}
