/**
 * 基于 Draft 模式的配置管理器（增强版）
 *
 * 参考 clash-verge-rev 设计，提供：
 * 1. 原子性配置更新
 * 2. 草稿模式（修改不会立即生效）
 * 3. 自动事件通知（配置变更时通知前端）
 * 4. 并发安全
 */
use crate::error::AppError;
use anyhow::{Result, anyhow};
use chrono; // For backup timestamp
use parking_lot::{
    MappedRwLockReadGuard, MappedRwLockWriteGuard, RwLock, RwLockReadGuard,
    RwLockUpgradableReadGuard, RwLockWriteGuard,
};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tokio::sync::OnceCell;
use tracing::instrument;

use crate::services::ai_translator::AIConfig;
use crate::utils::paths;

#[cfg(feature = "ts-rs")]
use ts_rs::TS;

/// 配置版本信息（用于前后端同步验证）
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "ts-rs", derive(TS))]
#[cfg_attr(feature = "ts-rs", ts(export, export_to = "../src/types/generated/"))]
pub struct ConfigVersionInfo {
    pub version: u64,
    pub timestamp: String,
    pub active_config_index: Option<usize>,
    pub config_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "ts-rs", derive(TS))]
#[cfg_attr(feature = "ts-rs", ts(export, export_to = "../src/types/generated/"))]
pub struct AppConfig {
    pub api_key: String,
    pub provider: String,
    pub model: String,
    pub base_url: Option<String>,
    pub use_translation_memory: bool,
    pub translation_memory_path: Option<String>,
    pub log_level: String,
    pub auto_save: bool,
    pub batch_size: usize,
    pub max_concurrent: usize,
    pub timeout_seconds: u64,

    #[serde(default)]
    pub ai_configs: Vec<AIConfig>,
    #[serde(default)]
    pub active_config_index: Option<usize>,

    #[serde(default)]
    pub system_prompt: Option<String>,

    #[serde(default)]
    pub theme_mode: Option<String>,
    #[serde(default)]
    pub language: Option<String>,

    #[serde(default)]
    pub log_retention_days: Option<u32>,
    #[serde(default)]
    pub log_max_size: Option<u32>,
    #[serde(default)]
    pub log_max_count: Option<u32>,

    #[serde(default)]
    pub config_version: u64,
    #[serde(default)]
    pub last_modified: Option<String>,
}

impl Default for AppConfig {
    fn default() -> Self {
        let default_tm_path = Self::get_default_tm_path();

        Self {
            api_key: String::new(),
            provider: "moonshot".to_string(),
            model: "moonshot-v1-auto".to_string(),
            base_url: Some("https://api.moonshot.cn/v1".to_string()),
            use_translation_memory: true,
            translation_memory_path: Some(default_tm_path),
            log_level: "info".to_string(),
            auto_save: true,
            batch_size: 10,
            max_concurrent: 3,
            timeout_seconds: 30,
            ai_configs: Vec::new(),
            active_config_index: None,
            system_prompt: None,
            theme_mode: None,
            language: None,
            log_retention_days: Some(7),
            log_max_size: Some(128),
            log_max_count: Some(8),
            config_version: 0,
            last_modified: None,
        }
    }
}

impl AppConfig {
    fn get_default_tm_path() -> String {
        if let Ok(exe_path) = std::env::current_exe() {
            if let Some(exe_dir) = exe_path.parent() {
                let portable_tm = exe_dir.join("data").join("translation_memory.json");
                if portable_tm.exists() || exe_dir.join("data").exists() {
                    return portable_tm.to_string_lossy().to_string();
                }
            }
        }

        let mut path = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
        path.push(".po-translator");
        path.push("translation_memory.json");
        path.to_string_lossy().to_string()
    }

    pub fn get_active_ai_config(&self) -> Option<&AIConfig> {
        self.active_config_index
            .and_then(|index| self.ai_configs.get(index))
    }

    pub fn get_active_ai_config_mut(&mut self) -> Option<&mut AIConfig> {
        if let Some(index) = self.active_config_index {
            self.ai_configs.get_mut(index)
        } else {
            None
        }
    }

    pub fn add_ai_config(&mut self, config: AIConfig) {
        self.ai_configs.push(config);
        if self.ai_configs.len() == 1 {
            self.active_config_index = Some(0);
        }
    }

    pub fn update_ai_config(&mut self, index: usize, config: AIConfig) -> Result<()> {
        if index < self.ai_configs.len() {
            self.ai_configs[index] = config;
            Ok(())
        } else {
            Err(anyhow!("配置索引超出范围: {}", index))
        }
    }

    pub fn remove_ai_config(&mut self, index: usize) -> Result<()> {
        if index >= self.ai_configs.len() {
            return Err(anyhow!("配置索引超出范围: {}", index));
        }

        self.ai_configs.remove(index);

        if let Some(active_index) = self.active_config_index {
            if active_index == index {
                self.active_config_index = if self.ai_configs.is_empty() {
                    None
                } else {
                    Some(0)
                };
            } else if active_index > index {
                self.active_config_index = Some(active_index - 1);
            }
        }

        Ok(())
    }

    pub fn set_active_ai_config(&mut self, index: usize) -> Result<()> {
        if index < self.ai_configs.len() {
            self.active_config_index = Some(index);
            Ok(())
        } else {
            Err(anyhow!("配置索引超出范围: {}", index))
        }
    }

    pub fn get_all_ai_configs(&self) -> &Vec<AIConfig> {
        &self.ai_configs
    }
}

#[derive(Debug, Clone)]
struct Draft<T: Clone> {
    inner: Arc<RwLock<(T, Option<T>)>>,
}

impl<T: Clone> From<T> for Draft<T> {
    fn from(data: T) -> Self {
        Self {
            inner: Arc::new(RwLock::new((data, None))),
        }
    }
}

impl<T: Clone> Draft<Box<T>> {
    fn data_mut(&self) -> MappedRwLockWriteGuard<'_, Box<T>> {
        RwLockWriteGuard::map(self.inner.write(), |inner| &mut inner.0)
    }

    fn data_ref(&self) -> MappedRwLockReadGuard<'_, Box<T>> {
        RwLockReadGuard::map(self.inner.read(), |inner| &inner.0)
    }

    fn draft_mut(&self) -> MappedRwLockWriteGuard<'_, Box<T>> {
        let guard = self.inner.upgradable_read();

        if guard.1.is_none() {
            let mut guard = RwLockUpgradableReadGuard::upgrade(guard);
            guard.1 = Some(guard.0.clone());
            #[allow(clippy::unwrap_used)]
            return RwLockWriteGuard::map(guard, |inner| inner.1.as_mut().unwrap());
        }

        #[allow(clippy::unwrap_used)]
        RwLockWriteGuard::map(RwLockUpgradableReadGuard::upgrade(guard), |inner| {
            inner.1.as_mut().unwrap()
        })
    }

    fn latest_ref(&self) -> MappedRwLockReadGuard<'_, Box<T>> {
        RwLockReadGuard::map(self.inner.read(), |inner| {
            inner.1.as_ref().unwrap_or(&inner.0)
        })
    }

    fn apply(&self) -> Option<Box<T>> {
        let mut inner = self.inner.write();
        inner
            .1
            .take()
            .map(|draft| std::mem::replace(&mut inner.0, draft))
    }

    fn discard(&self) -> Option<Box<T>> {
        self.inner.write().1.take()
    }

    fn has_draft(&self) -> bool {
        self.inner.read().1.is_some()
    }

    fn clone_data(&self) -> Box<T> {
        self.data_ref().clone()
    }

    fn clone_latest(&self) -> Box<T> {
        self.latest_ref().clone()
    }
}

/// 全局配置管理器单例
static GLOBAL_CONFIG: OnceCell<ConfigDraft> = OnceCell::const_new();

/// 基于 Draft 的配置管理器
#[derive(Clone)]
pub struct ConfigDraft {
    /// 配置文件路径
    config_path: Arc<PathBuf>,
    /// 密钥文件路径
    secrets_path: Arc<PathBuf>,
    /// Draft 配置数据
    config: Draft<Box<AppConfig>>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
struct ConfigSecrets {
    #[serde(default)]
    api_key: String,
    #[serde(default)]
    ai_api_keys: Vec<String>,
}

impl ConfigDraft {
    /// 获取全局配置管理器实例
    pub async fn global() -> &'static ConfigDraft {
        GLOBAL_CONFIG
            .get_or_init(|| async {
                match Self::new(None) {
                    Ok(instance) => {
                        log::info!("配置管理器初始化成功");
                        instance
                    }
                    Err(e) => {
                        log::error!("初始化配置管理器失败: {}, 尝试从旧路径迁移", e);

                        // 修复：即使加载失败，也尝试从旧路径迁移配置
                        let config_path = paths::app_home_dir()
                            .map(|dir| dir.join("config.json"))
                            .unwrap_or_else(|_| {
                                let mut path =
                                    dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
                                path.push(".po-translator");
                                path.push("config.json");
                                path
                            });

                        let mut config = AppConfig::default();

                        // 尝试从旧路径迁移
                        let legacy_path = Self::get_legacy_config_path();
                        if legacy_path.exists() {
                            log::info!("尝试从旧配置迁移: {:?}", legacy_path);
                            match Self::migrate_from_legacy(&legacy_path) {
                                Ok(migrated_config) => {
                                    log::info!("从旧配置迁移成功");
                                    config = migrated_config;
                                }
                                Err(migrate_err) => {
                                    log::warn!("旧配置迁移失败: {}, 使用默认配置", migrate_err);
                                }
                            }
                        }

                        // 确保配置目录存在
                        if let Some(parent) = config_path.parent() {
                            let _ = fs::create_dir_all(parent);
                        }

                        log::warn!("使用配置路径: {:?}", config_path);
                        if !config.ai_configs.is_empty() {
                            log::info!("成功迁移 {} 个 AI 配置", config.ai_configs.len());
                        } else {
                            log::warn!("未找到可迁移的配置，用户需重新配置AI供应商");
                        }

                        let secrets_path = Self::get_secrets_path(&config_path);
                        let instance = Self {
                            config_path: Arc::new(config_path),
                            secrets_path: Arc::new(secrets_path),
                            config: Draft::from(Box::new(config)),
                        };

                        // 尝试保存配置到正常路径
                        if let Err(save_err) = instance.save_to_disk() {
                            log::error!("保存配置失败: {}", save_err);
                        } else {
                            log::info!("配置已保存到磁盘");
                        }

                        instance
                    }
                }
            })
            .await
    }

    /// 创建新的配置管理器实例
    pub fn new(config_path: Option<PathBuf>) -> Result<Self, AppError> {
        let should_migrate_legacy = config_path.is_none();

        let config_path = config_path.unwrap_or_else(|| {
            paths::app_home_dir()
                .map(|dir| dir.join("config.json"))
                .unwrap_or_else(|_| {
                    let mut path = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
                    path.push(".po-translator");
                    path.push("config.json");
                    path
                })
        });

        let mut config = if config_path.exists() {
            // 加载现有配置
            let mut existing_config = Self::load_from_file(&config_path)?;

            // 智能迁移：如果新配置的 aiConfigs 为空，尝试从旧配置迁移
            if should_migrate_legacy && existing_config.ai_configs.is_empty() {
                let legacy_path = Self::get_legacy_config_path();
                if legacy_path.exists() {
                    log::info!(
                        "检测到新配置的 aiConfigs 为空，尝试从旧配置迁移: {:?}",
                        legacy_path
                    );
                    match Self::migrate_from_legacy(&legacy_path) {
                        Ok(legacy_config) => {
                            if !legacy_config.ai_configs.is_empty() {
                                log::info!(
                                    "从旧配置迁移成功，获得 {} 个 AI 配置",
                                    legacy_config.ai_configs.len()
                                );
                                // 只迁移 AI 配置相关字段，保留其他新配置
                                existing_config.ai_configs = legacy_config.ai_configs;
                                existing_config.active_config_index =
                                    legacy_config.active_config_index;
                            } else {
                                log::info!("旧配置中也没有 AI 配置，无需迁移");
                            }
                        }
                        Err(e) => {
                            log::warn!("从旧配置迁移失败: {}, 使用现有配置", e);
                        }
                    }
                }
            }

            existing_config
        } else {
            // 新路径不存在时，尝试从旧路径迁移配置
            let legacy_path = Self::get_legacy_config_path();
            if should_migrate_legacy && legacy_path.exists() {
                log::info!("检测到旧配置文件，尝试迁移: {:?}", legacy_path);
                match Self::migrate_from_legacy(&legacy_path) {
                    Ok(migrated_config) => {
                        log::info!("配置迁移成功");
                        migrated_config
                    }
                    Err(e) => {
                        log::warn!("配置迁移失败: {}, 使用默认配置", e);
                        AppConfig::default()
                    }
                }
            } else {
                AppConfig::default()
            }
        };

        // 确保配置目录存在
        if let Some(parent) = config_path.parent() {
            fs::create_dir_all(parent)?;
        }

        let secrets_path = Self::get_secrets_path(&config_path);

        let instance = Self {
            secrets_path: Arc::new(secrets_path),
            config_path: Arc::new(config_path),
            config: Draft::from(Box::new(config)),
        };

        instance.load_secrets_into_memory()?;

        // 保存初始配置
        instance.save_to_disk()?;

        Ok(instance)
    }

    /// 获取旧版配置文件路径
    fn get_legacy_config_path() -> PathBuf {
        let mut path = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
        path.push(".po-translator");
        path.push("config.json");
        path
    }

    fn get_secrets_path(config_path: &Path) -> PathBuf {
        let parent = config_path.parent().unwrap_or_else(|| Path::new("."));
        let stem = config_path
            .file_stem()
            .and_then(|value| value.to_str())
            .unwrap_or("config");
        parent.join(format!("{}.secrets.json", stem))
    }

    /// 从旧版配置文件迁移配置
    fn migrate_from_legacy<P: AsRef<std::path::Path>>(path: P) -> Result<AppConfig, AppError> {
        let path_ref = path.as_ref();

        // 读取旧配置文件
        let content = fs::read_to_string(path_ref).map_err(AppError::from)?;

        // 尝试作为新格式（camelCase）解析
        let mut config = if let Ok(new_config) = serde_json::from_str::<AppConfig>(&content) {
            log::info!("旧配置文件已是新格式（camelCase）");
            new_config
        } else {
            // 尝试作为旧格式（snake_case）解析
            #[derive(Debug, Deserialize)]
            struct LegacyAppConfig {
                #[serde(default)]
                api_key: String,
                #[serde(default)]
                provider: String,
                #[serde(default)]
                model: String,
                #[serde(default)]
                base_url: Option<String>,
                #[serde(default = "default_true")]
                use_translation_memory: bool,
                #[serde(default)]
                translation_memory_path: Option<String>,
                #[serde(default = "default_log_level")]
                log_level: String,
                #[serde(default = "default_true")]
                auto_save: bool,
                #[serde(default)]
                batch_size: usize,
                #[serde(default)]
                max_concurrent: usize,
                #[serde(default)]
                timeout_seconds: u64,
                #[serde(default)]
                #[serde(rename = "ai_configs")]
                ai_configs_legacy: Option<Vec<LegacyAIConfig>>,
                #[serde(default)]
                active_config_index: Option<usize>,
            }

            #[derive(Debug, Deserialize, Clone)]
            struct LegacyAIConfig {
                #[serde(default)]
                provider: String,
                #[serde(default)]
                api_key: String,
                #[serde(default)]
                base_url: Option<String>,
                #[serde(default)]
                model: Option<String>,
                #[serde(default)]
                proxy: Option<crate::services::ProxyConfig>,
            }

            fn default_true() -> bool {
                true
            }
            fn default_log_level() -> String {
                "info".to_string()
            }

            let legacy: LegacyAppConfig = serde_json::from_str(&content).map_err(|e| {
                log::error!("旧配置文件解析失败: {}", e);
                AppError::Config(format!("旧配置文件格式错误: {}", e))
            })?;

            log::info!("成功解析旧配置文件（snake_case）");

            // 转换为新格式
            let mut new_config = AppConfig {
                api_key: legacy.api_key,
                provider: legacy.provider,
                model: legacy.model,
                base_url: legacy.base_url,
                use_translation_memory: legacy.use_translation_memory,
                translation_memory_path: legacy.translation_memory_path,
                log_level: legacy.log_level,
                auto_save: legacy.auto_save,
                batch_size: legacy.batch_size,
                max_concurrent: legacy.max_concurrent,
                timeout_seconds: legacy.timeout_seconds,
                ..Default::default()
            };

            // 迁移 AI 配置
            if let Some(legacy_configs) = legacy.ai_configs_legacy {
                log::info!("迁移 {} 个 AI 配置", legacy_configs.len());
                for legacy_config in legacy_configs {
                    // 旧格式的 provider 字段需要转换为 provider_id
                    let provider_id = if legacy_config.provider.eq_ignore_ascii_case("moonshot") {
                        "moonshot".to_string()
                    } else if legacy_config.provider.eq_ignore_ascii_case("openai") {
                        "openai".to_string()
                    } else if legacy_config.provider.eq_ignore_ascii_case("deepseek") {
                        "deepseek".to_string()
                    } else {
                        // 尝试直接使用
                        legacy_config.provider.clone()
                    };

                    let new_config_item = crate::services::AIConfig {
                        provider_id,
                        api_key: legacy_config.api_key,
                        base_url: legacy_config.base_url,
                        model: legacy_config.model,
                        proxy: legacy_config.proxy,
                    };
                    new_config.ai_configs.push(new_config_item);
                }
            }

            // 保持原有的 active_config_index
            new_config.active_config_index = legacy.active_config_index;

            new_config
        };

        // 验证迁移后的配置
        if !config.ai_configs.is_empty() {
            log::info!(
                "配置迁移完成: {} 个 AI 配置，启用索引: {:?}",
                config.ai_configs.len(),
                config.active_config_index
            );
        }

        Ok(config)
    }

    /// 从文件加载配置
    fn load_from_file<P: AsRef<std::path::Path>>(path: P) -> Result<AppConfig, AppError> {
        let path_ref = path.as_ref();

        // 读取配置文件内容
        let content = fs::read_to_string(path_ref).map_err(AppError::from)?;

        // 尝试反序列化配置
        let config: AppConfig = serde_json::from_str(&content).map_err(|e| {
            log::error!("配置文件格式错误: {}", e);
            log::error!("配置文件路径: {:?}", path_ref);

            // 备份损坏的配置文件
            if let Some(parent) = path_ref.parent() {
                let backup_path = parent.join(format!(
                    "config.backup.{}.json",
                    chrono::Local::now().format("%Y%m%d_%H%M%S")
                ));
                if let Err(backup_err) = fs::copy(path_ref, &backup_path) {
                    log::warn!("无法备份损坏的配置文件: {}", backup_err);
                } else {
                    log::info!("已备份损坏的配置文件到: {:?}", backup_path);
                }
            }

            AppError::Config(format!(
                "配置文件解析失败: {}。已备份损坏的文件，将使用默认配置。",
                e
            ))
        })?;

        log::info!("配置文件加载成功: {:?}", path_ref);
        Ok(config)
    }

    fn split_config(config: &AppConfig) -> (AppConfig, ConfigSecrets) {
        let mut public_config = config.clone();
        let secrets = ConfigSecrets {
            api_key: config.api_key.clone(),
            ai_api_keys: config
                .ai_configs
                .iter()
                .map(|item| item.api_key.clone())
                .collect(),
        };

        public_config.api_key.clear();
        for ai_config in &mut public_config.ai_configs {
            ai_config.api_key.clear();
        }

        (public_config, secrets)
    }

    fn apply_secrets(config: &mut AppConfig, secrets: &ConfigSecrets) {
        if !secrets.api_key.is_empty() {
            config.api_key = secrets.api_key.clone();
        }

        for (i, ai_config) in config.ai_configs.iter_mut().enumerate() {
            if let Some(api_key) = secrets.ai_api_keys.get(i) {
                if !api_key.is_empty() {
                    ai_config.api_key = api_key.clone();
                }
            }
        }
    }

    fn load_secrets(&self) -> Result<Option<ConfigSecrets>, AppError> {
        if !self.secrets_path.exists() {
            return Ok(None);
        }

        let content = fs::read_to_string(&*self.secrets_path).map_err(AppError::from)?;
        let secrets = serde_json::from_str::<ConfigSecrets>(&content)
            .map_err(|error| AppError::Config(format!("密钥文件格式错误: {}", error)))?;

        Ok(Some(secrets))
    }

    fn load_secrets_into_memory(&self) -> Result<(), AppError> {
        if let Some(secrets) = self.load_secrets()? {
            let mut config = self.config.data_mut();
            Self::apply_secrets(&mut config, &secrets);
        }

        Ok(())
    }

    fn write_config_files(&self, config: &AppConfig) -> Result<(), AppError> {
        let (public_config, secrets) = Self::split_config(config);

        let public_json = serde_json::to_string_pretty(&public_config).map_err(AppError::from)?;
        fs::write(&*self.config_path, public_json).map_err(AppError::from)?;

        let secrets_json = serde_json::to_string_pretty(&secrets).map_err(AppError::from)?;
        fs::write(&*self.secrets_path, secrets_json).map_err(AppError::from)?;

        Ok(())
    }

    /// 获取最新配置的只读引用（包含草稿）
    pub fn latest(&self) -> parking_lot::MappedRwLockReadGuard<'_, Box<AppConfig>> {
        self.config.latest_ref()
    }

    /// 获取正式配置的只读引用（不包含草稿）
    pub fn data(&self) -> parking_lot::MappedRwLockReadGuard<'_, Box<AppConfig>> {
        self.config.data_ref()
    }

    /// 获取草稿的可写引用（自动创建草稿）
    ///
    /// 所有配置修改都应该在草稿上进行，最后调用 apply() 提交
    pub fn draft(&self) -> parking_lot::MappedRwLockWriteGuard<'_, Box<AppConfig>> {
        self.config.draft_mut()
    }

    /// 提交草稿并保存到磁盘
    ///
    /// 成功后会自动：
    /// 1. 保存配置到磁盘
    /// 2. 发送配置更新事件（通知前端）
    pub fn apply(&self) -> Result<(), AppError> {
        log::info!("[apply] 开始应用草稿");
        let applied = self.config.apply();
        log::info!("[apply] config.apply() 返回，有草稿: {}", applied.is_some());
        if applied.is_some() {
            let new_config = self.config.clone_data();

            // 保存到磁盘（使用最新正式配置，避免将旧值写回）
            log::info!("[apply] 准备调用 save_to_disk_with_config");
            self.save_to_disk_with_config(&new_config)?;
            log::info!("[apply] save_to_disk_with_config 完成");

            // 发送事件通知前端（异步执行，不阻塞当前线程）
            tokio::spawn(async move {
                if let Err(e) = Self::emit_config_updated(&new_config) {
                    log::warn!("发送配置更新事件失败: {}", e);
                }
            });

            log::info!("[apply] 完成");
            Ok(())
        } else {
            // 没有草稿需要提交
            log::info!("[apply] 没有草稿需要提交");
            Ok(())
        }
    }

    /// 丢弃草稿（放弃所有未提交的修改）
    pub fn discard(&self) {
        self.config.discard();
    }

    /// 检查是否有未提交的草稿
    pub fn has_draft(&self) -> bool {
        self.config.has_draft()
    }

    /// 直接修改正式配置并保存（不经过草稿）
    ///
    /// 注意：这会跳过草稿机制，请谨慎使用
    /// 推荐使用 draft() + apply() 的方式
    pub fn update_direct(&self, updater: impl FnOnce(&mut AppConfig)) -> Result<(), AppError> {
        {
            let mut config = self.config.data_mut();
            updater(&mut config);
        }
        self.save_to_disk()?;

        // 发送事件
        let config_clone = self.config.clone_data();
        tokio::spawn(async move {
            if let Err(e) = Self::emit_config_updated(&config_clone) {
                log::warn!("发送配置更新事件失败: {}", e);
            }
        });

        Ok(())
    }

    /// 保存配置到磁盘
    #[instrument(skip(self), fields(config_path = %self.config_path.display()))]
    fn save_to_disk(&self) -> Result<(), AppError> {
        log::info!("[save_to_disk] 开始保存配置");
        let config = self.config.clone_latest();
        log::info!("[save_to_disk] 已克隆配置");
        log::info!("[save_to_disk] 准备写入文件: {:?}", *self.config_path);
        self.write_config_files(&config)?;
        log::info!("[save_to_disk] 文件写入成功");
        Ok(())
    }

    /// 保存指定配置到磁盘（避免死锁的版本）
    #[instrument(skip(self, config), fields(config_path = %self.config_path.display()))]
    fn save_to_disk_with_config(&self, config: &AppConfig) -> Result<(), AppError> {
        log::info!("[save_to_disk_with_config] 开始保存配置");
        log::info!(
            "[save_to_disk_with_config] 准备写入文件: {:?}",
            *self.config_path
        );
        self.write_config_files(config)?;
        log::info!("[save_to_disk_with_config] 文件写入成功");
        Ok(())
    }

    /// 发送配置更新事件给前端
    ///
    /// TODO: 事件发送需要在 Tauri 命令上下文中实现
    /// 当前先保留为空实现，在 Phase 2 迁移时从命令层发送事件
    #[allow(unused_variables)]
    fn emit_config_updated(config: &AppConfig) -> Result<(), AppError> {
        // 事件发送逻辑将在 Phase 2 迁移时从命令层实现
        // 参考：src-tauri/src/commands/ai_config.rs 中的事件发送
        Ok(())
    }

    // ========================================
    // 便捷方法（基于 draft + apply 模式）
    // ========================================

    /// 更新配置（使用 draft + apply）
    pub fn update<F>(&self, updater: F) -> Result<(), AppError>
    where
        F: FnOnce(&mut AppConfig),
    {
        {
            let mut draft = self.draft();
            updater(&mut draft);
        }
        self.apply()
    }

    /// 批量更新配置（多个修改在同一个草稿中完成）
    pub fn batch_update<F>(&self, updates: Vec<F>) -> Result<(), AppError>
    where
        F: FnOnce(&mut AppConfig),
    {
        {
            let mut draft = self.draft();
            for update in updates {
                update(&mut draft);
            }
        }
        self.apply()
    }
}

#[cfg(test)]
#[allow(clippy::unwrap_used)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[tokio::test]
    async fn test_config_draft_basic() {
        let temp_dir = std::env::temp_dir();
        let config_path = temp_dir.join("test_config_draft.json");

        // 清理旧文件
        let _ = fs::remove_file(&config_path);

        let manager = ConfigDraft::new(Some(config_path.clone())).unwrap();

        // 读取初始配置
        assert_eq!(manager.latest().provider, "moonshot");

        // 修改草稿
        {
            let mut draft = manager.draft();
            draft.provider = "openai".to_string();
            draft.model = "gpt-4".to_string();
        }

        // 正式配置未变
        assert_eq!(manager.data().provider, "moonshot");

        // 草稿已变
        assert_eq!(manager.latest().provider, "openai");
        assert!(manager.has_draft());

        // 提交草稿
        manager.apply().unwrap();

        // 正式配置已更新
        assert_eq!(manager.data().provider, "openai");
        assert_eq!(manager.data().model, "gpt-4");
        assert!(!manager.has_draft());

        // 清理
        let _ = fs::remove_file(&config_path);
    }

    #[tokio::test]
    async fn test_config_draft_discard() {
        let temp_dir = std::env::temp_dir();
        let config_path = temp_dir.join("test_config_discard.json");

        let _ = fs::remove_file(&config_path);

        let manager = ConfigDraft::new(Some(config_path.clone())).unwrap();

        // 修改草稿
        {
            let mut draft = manager.draft();
            draft.provider = "claude".to_string();
        }

        assert!(manager.has_draft());

        // 丢弃草稿
        manager.discard();

        // 正式配置未变
        assert_eq!(manager.data().provider, "moonshot");
        assert!(!manager.has_draft());

        let _ = fs::remove_file(&config_path);
    }

    #[tokio::test]
    async fn test_config_update_helper() {
        let temp_dir = std::env::temp_dir();
        let config_path = temp_dir.join("test_config_update.json");

        let _ = fs::remove_file(&config_path);

        let manager = ConfigDraft::new(Some(config_path.clone())).unwrap();

        // 使用便捷更新方法
        manager
            .update(|config| {
                config.provider = "gemini".to_string();
                config.model = "gemini-pro".to_string();
            })
            .unwrap();

        assert_eq!(manager.data().provider, "gemini");
        assert_eq!(manager.data().model, "gemini-pro");

        let _ = fs::remove_file(&config_path);
    }

    #[tokio::test]
    async fn test_secrets_are_stored_outside_public_config() {
        let temp_dir = std::env::temp_dir();
        let config_path = temp_dir.join("test_config_secrets.json");
        let secrets_path = temp_dir.join("test_config_secrets.secrets.json");

        let _ = fs::remove_file(&config_path);
        let _ = fs::remove_file(&secrets_path);

        fs::write(
            &config_path,
            serde_json::to_string(&AppConfig::default()).unwrap(),
        )
        .unwrap();

        let manager = ConfigDraft::new(Some(config_path.clone())).unwrap();

        manager
            .update(|config| {
                config.api_key = "legacy-secret".to_string();
                config.ai_configs = vec![crate::services::AIConfig {
                    provider_id: "openai".to_string(),
                    api_key: "real-secret-key".to_string(),
                    base_url: Some("https://api.openai.com/v1".to_string()),
                    model: Some("gpt-4o-mini".to_string()),
                    proxy: None,
                }];
                config.active_config_index = Some(0);
            })
            .unwrap();

        let public_content = fs::read_to_string(&config_path).unwrap();
        let secrets_content = fs::read_to_string(&secrets_path).unwrap();

        assert!(!public_content.contains("real-secret-key"));
        assert!(!public_content.contains("legacy-secret"));
        assert!(secrets_content.contains("real-secret-key"));
        assert!(secrets_content.contains("legacy-secret"));

        let reloaded = ConfigDraft::new(Some(config_path.clone())).unwrap();
        let active = reloaded.data().get_active_ai_config().cloned().unwrap();
        assert_eq!(active.api_key, "real-secret-key");

        let _ = fs::remove_file(&config_path);
        let _ = fs::remove_file(&secrets_path);
    }

    #[tokio::test]
    async fn config_manager_stores_secrets_separately() {
        let temp_dir = tempdir().unwrap();
        let config_path = temp_dir.path().join("config.json");
        let secrets_path = temp_dir.path().join("config.secrets.json");

        let manager = ConfigDraft::new(Some(config_path.clone())).unwrap();
        manager
            .update(|config| {
                config.api_key = "legacy-secret".to_string();
                config.ai_configs.push(AIConfig {
                    provider_id: "openai".to_string(),
                    api_key: "real-secret-key".to_string(),
                    base_url: None,
                    model: Some("gpt-4o-mini".to_string()),
                    proxy: None,
                });
                config.active_config_index = Some(0);
            })
            .unwrap();

        let public_content = fs::read_to_string(&config_path).unwrap();
        let secrets_content = fs::read_to_string(&secrets_path).unwrap();

        assert!(!public_content.contains("legacy-secret"));
        assert!(!public_content.contains("real-secret-key"));
        assert!(secrets_content.contains("legacy-secret"));
        assert!(secrets_content.contains("real-secret-key"));

        let reloaded = ConfigDraft::new(Some(config_path.clone())).unwrap();
        assert_eq!(reloaded.data().api_key, "legacy-secret");
        assert_eq!(reloaded.data().ai_configs[0].api_key, "real-secret-key");
    }

    #[tokio::test]
    async fn config_manager_exports_and_imports_with_secrets() {
        let temp_dir = tempdir().unwrap();
        let config_path = temp_dir.path().join("config.json");
        let export_path = temp_dir.path().join("exported.json");
        let export_secrets_path = temp_dir.path().join("exported.secrets.json");

        let manager = ConfigDraft::new(Some(config_path.clone())).unwrap();
        manager
            .update(|config| {
                config.api_key = "root-secret".to_string();
                config.ai_configs.push(AIConfig {
                    provider_id: "openai".to_string(),
                    api_key: "provider-secret".to_string(),
                    base_url: Some("https://api.openai.com/v1".to_string()),
                    model: Some("gpt-4o-mini".to_string()),
                    proxy: None,
                });
                config.active_config_index = Some(0);
            })
            .unwrap();

        fs::copy(&config_path, &export_path).unwrap();
        fs::copy(
            config_path.with_extension("secrets.json"),
            &export_secrets_path,
        )
        .unwrap();

        let public_export = fs::read_to_string(&export_path).unwrap();
        let secrets_export = fs::read_to_string(&export_secrets_path).unwrap();

        assert!(!public_export.contains("root-secret"));
        assert!(!public_export.contains("provider-secret"));
        assert!(secrets_export.contains("root-secret"));
        assert!(secrets_export.contains("provider-secret"));

        let import_target = temp_dir.path().join("imported.json");
        let import_secrets = temp_dir.path().join("imported.secrets.json");
        fs::copy(&export_path, &import_target).unwrap();
        fs::copy(&export_secrets_path, &import_secrets).unwrap();

        let imported = ConfigDraft::new(Some(import_target.clone())).unwrap();
        assert_eq!(imported.data().api_key, "root-secret");
        assert_eq!(imported.data().ai_configs[0].api_key, "provider-secret");
        assert_eq!(imported.data().active_config_index, Some(0));
    }

    #[test]
    fn config_manager_loads_legacy_inline_secrets() {
        let temp_dir = tempdir().unwrap();
        let config_path = temp_dir.path().join("legacy.json");

        let legacy_config = serde_json::json!({
            "apiKey": "legacy-root-secret",
            "provider": "moonshot",
            "model": "moonshot-v1-auto",
            "baseUrl": "https://api.moonshot.cn/v1",
            "useTranslationMemory": true,
            "translationMemoryPath": null,
            "logLevel": "info",
            "autoSave": true,
            "batchSize": 10,
            "maxConcurrent": 3,
            "timeoutSeconds": 30,
            "aiConfigs": [
                {
                    "providerId": "openai",
                    "apiKey": "legacy-provider-secret",
                    "baseUrl": "https://api.openai.com/v1",
                    "model": "gpt-4o-mini",
                    "proxy": null
                }
            ],
            "activeConfigIndex": 0,
            "systemPrompt": null,
            "themeMode": null,
            "language": null,
            "logRetentionDays": 7,
            "logMaxSize": 128,
            "logMaxCount": 8,
            "configVersion": 0,
            "lastModified": null
        });

        fs::write(
            &config_path,
            serde_json::to_string_pretty(&legacy_config).unwrap(),
        )
        .unwrap();

        let loaded = ConfigDraft::new(Some(config_path.clone())).unwrap();

        assert_eq!(loaded.data().api_key, "legacy-root-secret");
        assert_eq!(
            loaded.data().ai_configs[0].api_key,
            "legacy-provider-secret"
        );
        assert_eq!(loaded.data().active_config_index, Some(0));
    }

    #[derive(Debug, Clone, PartialEq)]
    struct TestConfig {
        value: i32,
        name: String,
    }

    #[test]
    fn test_draft_basic() {
        let config = Box::new(TestConfig {
            value: 100,
            name: "initial".to_string(),
        });
        let draft = Draft::from(config);

        assert_eq!(draft.data_ref().value, 100);
        assert_eq!(draft.data_ref().name, "initial");

        {
            let mut d = draft.draft_mut();
            d.value = 200;
            d.name = "modified".to_string();
        }

        assert_eq!(draft.data_ref().value, 100);
        assert_eq!(draft.data_ref().name, "initial");

        assert_eq!(draft.latest_ref().value, 200);
        assert_eq!(draft.latest_ref().name, "modified");

        let old = draft.apply();
        assert!(old.is_some());
        assert_eq!(old.unwrap().value, 100);

        assert_eq!(draft.data_ref().value, 200);
        assert_eq!(draft.data_ref().name, "modified");
        assert!(!draft.has_draft());
    }

    #[test]
    fn test_draft_discard() {
        let config = Box::new(TestConfig {
            value: 100,
            name: "initial".to_string(),
        });
        let draft = Draft::from(config);

        {
            let mut d = draft.draft_mut();
            d.value = 200;
        }

        assert!(draft.has_draft());

        let discarded = draft.discard();
        assert!(discarded.is_some());
        assert_eq!(discarded.unwrap().value, 200);

        assert_eq!(draft.data_ref().value, 100);
        assert!(!draft.has_draft());
    }

    #[test]
    fn test_draft_multiple_apply() {
        let config = Box::new(TestConfig {
            value: 100,
            name: "initial".to_string(),
        });
        let draft = Draft::from(config);

        draft.draft_mut().value = 200;
        draft.apply();

        draft.draft_mut().value = 300;
        draft.apply();

        assert_eq!(draft.data_ref().value, 300);
    }
}
