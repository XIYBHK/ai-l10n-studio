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
use chrono; // For backup timestamp
use serde::Deserialize;
use std::fs;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::OnceCell;

use super::config_manager::AppConfig;
use crate::utils::draft::Draft;
use crate::utils::paths;

/// 全局配置管理器单例
static GLOBAL_CONFIG: OnceCell<ConfigDraft> = OnceCell::const_new();

/// 基于 Draft 的配置管理器
#[derive(Clone)]
pub struct ConfigDraft {
    /// 配置文件路径
    config_path: Arc<PathBuf>,
    /// Draft 配置数据
    config: Draft<Box<AppConfig>>,
}

impl ConfigDraft {
    /// 获取全局配置管理器实例
    pub async fn global() -> &'static ConfigDraft {
        GLOBAL_CONFIG
            .get_or_init(|| async {
                match Self::new(None) {
                    Ok(instance) => {
                        log::info!("✅ 配置管理器初始化成功");
                        instance
                    }
                    Err(e) => {
                        log::error!("⚠️ 初始化配置管理器失败: {}, 尝试从旧路径迁移", e);

                        // 🔧 修复：即使加载失败，也尝试从旧路径迁移配置
                        let config_path = paths::app_home_dir()
                            .map(|dir| dir.join("config.json"))
                            .unwrap_or_else(|_| {
                                let mut path = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
                                path.push(".po-translator");
                                path.push("config.json");
                                path
                            });

                        let mut config = AppConfig::default();

                        // 尝试从旧路径迁移
                        let legacy_path = Self::get_legacy_config_path();
                        if legacy_path.exists() {
                            log::info!("🔄 尝试从旧配置迁移: {:?}", legacy_path);
                            match Self::migrate_from_legacy(&legacy_path) {
                                Ok(migrated_config) => {
                                    log::info!("✅ 从旧配置迁移成功");
                                    config = migrated_config;
                                }
                                Err(migrate_err) => {
                                    log::warn!("⚠️ 旧配置迁移失败: {}, 使用默认配置", migrate_err);
                                }
                            }
                        }

                        // 确保配置目录存在
                        if let Some(parent) = config_path.parent() {
                            let _ = fs::create_dir_all(parent);
                        }

                        log::warn!("📂 使用配置路径: {:?}", config_path);
                        if !config.ai_configs.is_empty() {
                            log::info!("✅ 成功迁移 {} 个 AI 配置", config.ai_configs.len());
                        } else {
                            log::warn!("🔄 未找到可迁移的配置，用户需重新配置AI供应商");
                        }

                        let instance = Self {
                            config_path: Arc::new(config_path),
                            config: Draft::from(Box::new(config)),
                        };

                        // 尝试保存配置到正常路径
                        if let Err(save_err) = instance.save_to_disk() {
                            log::error!("❌ 保存配置失败: {}", save_err);
                        } else {
                            log::info!("✅ 配置已保存到磁盘");
                        }

                        instance
                    }
                }
            })
            .await
    }

    /// 创建新的配置管理器实例
    pub fn new(config_path: Option<PathBuf>) -> Result<Self, AppError> {
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

            // 🔧 智能迁移：如果新配置的 aiConfigs 为空，尝试从旧配置迁移
            if existing_config.ai_configs.is_empty() {
                let legacy_path = Self::get_legacy_config_path();
                if legacy_path.exists() {
                    log::info!("🔄 检测到新配置的 aiConfigs 为空，尝试从旧配置迁移: {:?}", legacy_path);
                    match Self::migrate_from_legacy(&legacy_path) {
                        Ok(legacy_config) => {
                            if !legacy_config.ai_configs.is_empty() {
                                log::info!("✅ 从旧配置迁移成功，获得 {} 个 AI 配置", legacy_config.ai_configs.len());
                                // 只迁移 AI 配置相关字段，保留其他新配置
                                existing_config.ai_configs = legacy_config.ai_configs;
                                existing_config.active_config_index = legacy_config.active_config_index;
                            } else {
                                log::info!("ℹ️ 旧配置中也没有 AI 配置，无需迁移");
                            }
                        }
                        Err(e) => {
                            log::warn!("⚠️ 从旧配置迁移失败: {}, 使用现有配置", e);
                        }
                    }
                }
            }

            existing_config
        } else {
            // 🔧 新路径不存在时，尝试从旧路径迁移配置
            let legacy_path = Self::get_legacy_config_path();
            if legacy_path.exists() {
                log::info!("🔄 检测到旧配置文件，尝试迁移: {:?}", legacy_path);
                match Self::migrate_from_legacy(&legacy_path) {
                    Ok(migrated_config) => {
                        log::info!("✅ 配置迁移成功");
                        migrated_config
                    }
                    Err(e) => {
                        log::warn!("⚠️ 配置迁移失败: {}, 使用默认配置", e);
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

        let instance = Self {
            config_path: Arc::new(config_path),
            config: Draft::from(Box::new(config)),
        };

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

    /// 从旧版配置文件迁移配置
    fn migrate_from_legacy<P: AsRef<std::path::Path>>(path: P) -> Result<AppConfig, AppError> {
        let path_ref = path.as_ref();

        // 读取旧配置文件
        let content = fs::read_to_string(path_ref).map_err(AppError::from)?;

        // 尝试作为新格式（camelCase）解析
        let mut config = if let Ok(new_config) = serde_json::from_str::<AppConfig>(&content) {
            log::info!("✅ 旧配置文件已是新格式（camelCase）");
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

            fn default_true() -> bool { true }
            fn default_log_level() -> String { "info".to_string() }

            let legacy: LegacyAppConfig = serde_json::from_str(&content).map_err(|e| {
                log::error!("❌ 旧配置文件解析失败: {}", e);
                AppError::Config(format!("旧配置文件格式错误: {}", e))
            })?;

            log::info!("✅ 成功解析旧配置文件（snake_case）");

            // 转换为新格式
            let mut new_config = AppConfig::default();
            new_config.api_key = legacy.api_key;
            new_config.provider = legacy.provider;
            new_config.model = legacy.model;
            new_config.base_url = legacy.base_url;
            new_config.use_translation_memory = legacy.use_translation_memory;
            new_config.translation_memory_path = legacy.translation_memory_path;
            new_config.log_level = legacy.log_level;
            new_config.auto_save = legacy.auto_save;
            new_config.batch_size = legacy.batch_size;
            new_config.max_concurrent = legacy.max_concurrent;
            new_config.timeout_seconds = legacy.timeout_seconds;

            // 迁移 AI 配置
            if let Some(legacy_configs) = legacy.ai_configs_legacy {
                log::info!("🔄 迁移 {} 个 AI 配置", legacy_configs.len());
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
                "✅ 配置迁移完成: {} 个 AI 配置，启用索引: {:?}",
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
            log::error!("❌ 配置文件格式错误: {}", e);
            log::error!("📄 配置文件路径: {:?}", path_ref);

            // 备份损坏的配置文件
            if let Some(parent) = path_ref.parent() {
                let backup_path = parent.join(format!(
                    "config.backup.{}.json",
                    chrono::Local::now().format("%Y%m%d_%H%M%S")
                ));
                if let Err(backup_err) = fs::copy(path_ref, &backup_path) {
                    log::warn!("⚠️ 无法备份损坏的配置文件: {}", backup_err);
                } else {
                    log::info!("💾 已备份损坏的配置文件到: {:?}", backup_path);
                }
            }

            AppError::Config(format!(
                "配置文件解析失败: {}。已备份损坏的文件，将使用默认配置。",
                e
            ))
        })?;

        log::info!("✅ 配置文件加载成功: {:?}", path_ref);
        Ok(config)
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
        log::info!("🔄 [apply] 开始应用草稿");
        // 🔧 修复死锁问题：先 apply 并保存返回的配置，避免在持有写锁时再次调用 clone_latest
        let new_config = self.config.apply();
        log::info!("🔄 [apply] config.apply() 返回，有草稿: {}", new_config.is_some());
        if let Some(new_config) = new_config {
            // 保存到磁盘（使用克隆的配置，避免再次获取锁）
            log::info!("🔄 [apply] 准备调用 save_to_disk_with_config");
            self.save_to_disk_with_config(&new_config)?;
            log::info!("🔄 [apply] save_to_disk_with_config 完成");

            // 发送事件通知前端（异步执行，不阻塞当前线程）
            tokio::spawn(async move {
                if let Err(e) = Self::emit_config_updated(&new_config) {
                    log::warn!("发送配置更新事件失败: {}", e);
                }
            });

            log::info!("🔄 [apply] 完成");
            Ok(())
        } else {
            // 没有草稿需要提交
            log::info!("🔄 [apply] 没有草稿需要提交");
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
    /// ⚠️ 注意：这会跳过草稿机制，请谨慎使用
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
    fn save_to_disk(&self) -> Result<(), AppError> {
        log::info!("💾 [save_to_disk] 开始保存配置");
        let config = self.config.clone_latest();
        log::info!("💾 [save_to_disk] 已克隆配置");
        let json = serde_json::to_string_pretty(&*config).map_err(AppError::from)?;
        log::info!("💾 [save_to_disk] 已序列化配置，长度: {} bytes", json.len());
        log::info!("💾 [save_to_disk] 准备写入文件: {:?}", *self.config_path);
        fs::write(&*self.config_path, json).map_err(AppError::from)?;
        log::info!("💾 [save_to_disk] 文件写入成功");
        Ok(())
    }

    /// 保存指定配置到磁盘（避免死锁的版本）
    fn save_to_disk_with_config(&self, config: &Box<AppConfig>) -> Result<(), AppError> {
        log::info!("💾 [save_to_disk_with_config] 开始保存配置");
        let json = serde_json::to_string_pretty(&**config).map_err(AppError::from)?;
        log::info!("💾 [save_to_disk_with_config] 已序列化配置，长度: {} bytes", json.len());
        log::info!("💾 [save_to_disk_with_config] 准备写入文件: {:?}", *self.config_path);
        fs::write(&*self.config_path, json).map_err(AppError::from)?;
        log::info!("💾 [save_to_disk_with_config] 文件写入成功");
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
}
