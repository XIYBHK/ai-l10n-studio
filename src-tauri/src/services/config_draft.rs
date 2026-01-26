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
                Self::new(None).unwrap_or_else(|e| {
                    log::error!("⚠️ 初始化配置管理器失败: {}, 使用默认配置", e);

                    // 🔧 修复：即使加载失败，也使用正常的配置路径（而不是临时路径）
                    // 这样可以确保用户的新配置能够持久化
                    let config_path = paths::app_home_dir()
                        .map(|dir| dir.join("config.json"))
                        .unwrap_or_else(|_| {
                            let mut path = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
                            path.push(".po-translator");
                            path.push("config.json");
                            path
                        });

                    // 确保配置目录存在
                    if let Some(parent) = config_path.parent() {
                        let _ = fs::create_dir_all(parent);
                    }

                    log::warn!("📂 使用配置路径: {:?}", config_path);
                    log::warn!("🔄 已重置为默认配置，用户可重新配置AI供应商");

                    let instance = Self {
                        config_path: Arc::new(config_path),
                        config: Draft::from(Box::new(AppConfig::default())),
                    };

                    // 尝试保存默认配置到正常路径
                    if let Err(e) = instance.save_to_disk() {
                        log::error!("❌ 保存默认配置失败: {}", e);
                    } else {
                        log::info!("✅ 默认配置已保存到磁盘");
                    }

                    instance
                })
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

        let config = if config_path.exists() {
            Self::load_from_file(&config_path)?
        } else {
            let default_config = AppConfig::default();
            // 确保配置目录存在
            if let Some(parent) = config_path.parent() {
                fs::create_dir_all(parent)?;
            }
            default_config
        };

        let instance = Self {
            config_path: Arc::new(config_path),
            config: Draft::from(Box::new(config)),
        };

        // 保存初始配置
        instance.save_to_disk()?;

        Ok(instance)
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
        if let Some(_old_config) = self.config.apply() {
            // 保存到磁盘
            self.save_to_disk()?;

            // 发送事件通知前端（异步执行，不阻塞当前线程）
            let config_clone = self.config.clone_latest();
            tokio::spawn(async move {
                if let Err(e) = Self::emit_config_updated(&config_clone) {
                    log::warn!("发送配置更新事件失败: {}", e);
                }
            });

            Ok(())
        } else {
            // 没有草稿需要提交
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
        let config = self.config.clone_latest();
        let json = serde_json::to_string_pretty(&*config).map_err(AppError::from)?;
        fs::write(&*self.config_path, json).map_err(AppError::from)?;
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
