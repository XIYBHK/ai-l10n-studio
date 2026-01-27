use anyhow::{Result, anyhow};
use chrono;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

use crate::services::ai_translator::AIConfig;
use crate::utils::paths;

#[cfg(feature = "ts-rs")]
use ts_rs::TS;

// ========== Phase 1: 配置管理扩展 ==========

/// 配置版本信息（用于前后端同步验证）
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")] // 🔧 序列化时使用 camelCase 命名，与前端保持一致
#[cfg_attr(feature = "ts-rs", derive(TS))]
#[cfg_attr(feature = "ts-rs", ts(export, export_to = "../src/types/generated/"))]
pub struct ConfigVersionInfo {
    pub version: u64,
    pub timestamp: String,
    pub active_config_index: Option<usize>,
    pub config_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")] // 🔧 序列化时使用 camelCase 命名，与前端保持一致
#[cfg_attr(feature = "ts-rs", derive(TS))]
#[cfg_attr(feature = "ts-rs", ts(export, export_to = "../src/types/generated/"))]
pub struct AppConfig {
    // 原有字段（保持向后兼容）
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

    // Phase 1 新增字段
    #[serde(default)]
    pub ai_configs: Vec<AIConfig>, // 多个AI配置
    #[serde(default)]
    pub active_config_index: Option<usize>, // 当前启用的配置索引

    // Phase 3 新增字段
    #[serde(default)]
    pub system_prompt: Option<String>, // 自定义系统提示词（None使用默认）

    // Phase 9 新增字段：UI 配置
    #[serde(default)]
    pub theme_mode: Option<String>, // 主题模式：light/dark/system（None使用系统默认）
    #[serde(default)]
    pub language: Option<String>, // 界面语言：zh-CN/en等（None使用系统语言）

    // Phase 9 新增字段：日志配置
    #[serde(default)]
    pub log_retention_days: Option<u32>, // 日志保留天数（None表示永久保留）
    #[serde(default)]
    pub log_max_size: Option<u32>, // 单个日志文件最大大小（KB，None使用默认128KB）
    #[serde(default)]
    pub log_max_count: Option<u32>, // 最多保留日志文件数量（None使用默认8个）

    // 配置版本控制（前后端同步）
    #[serde(default)]
    pub config_version: u64, // 配置版本号，每次修改递增
    #[serde(default)]
    pub last_modified: Option<String>, // 最后修改时间
}

impl Default for AppConfig {
    fn default() -> Self {
        // 获取默认的翻译记忆库路径
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
            // Phase 1 新增字段默认值
            ai_configs: Vec::new(),
            active_config_index: None,
            // Phase 3 新增字段默认值
            system_prompt: None, // None表示使用内置默认提示词
            // Phase 9 新增字段默认值
            theme_mode: None,            // None表示使用系统主题
            language: None,              // None表示使用系统语言
            log_retention_days: Some(7), // 默认保留7天日志
            log_max_size: Some(128),     // 默认单个文件最大128KB
            log_max_count: Some(8),      // 默认保留8个文件
            // 配置版本控制
            config_version: 0,
            last_modified: None,
        }
    }
}

impl AppConfig {
    /// 获取默认的翻译记忆库路径
    /// 优先级：程序目录 > 用户目录
    fn get_default_tm_path() -> String {
        // 1. 优先使用程序目录（便携模式）
        if let Ok(exe_path) = std::env::current_exe() {
            if let Some(exe_dir) = exe_path.parent() {
                let portable_tm = exe_dir.join("data").join("translation_memory.json");
                // 检查便携路径是否存在或可创建
                if portable_tm.exists() || exe_dir.join("data").exists() {
                    return portable_tm.to_string_lossy().to_string();
                }
            }
        }

        // 2. 使用用户目录（标准模式）
        let mut path = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
        path.push(".po-translator");
        path.push("translation_memory.json");
        path.to_string_lossy().to_string()
    }

    // ========== Phase 1: AI 配置管理方法 ==========

    /// 获取当前启用的AI配置
    pub fn get_active_ai_config(&self) -> Option<&AIConfig> {
        self.active_config_index
            .and_then(|index| self.ai_configs.get(index))
    }

    /// 获取当前启用的AI配置（可变）
    pub fn get_active_ai_config_mut(&mut self) -> Option<&mut AIConfig> {
        if let Some(index) = self.active_config_index {
            self.ai_configs.get_mut(index)
        } else {
            None
        }
    }

    /// 添加AI配置
    pub fn add_ai_config(&mut self, config: AIConfig) {
        self.ai_configs.push(config);
        // 如果是第一个配置，自动设为启用
        if self.ai_configs.len() == 1 {
            self.active_config_index = Some(0);
        }
    }

    /// 更新AI配置
    pub fn update_ai_config(&mut self, index: usize, config: AIConfig) -> Result<()> {
        if index < self.ai_configs.len() {
            self.ai_configs[index] = config;
            Ok(())
        } else {
            Err(anyhow!("配置索引超出范围: {}", index))
        }
    }

    /// 删除AI配置
    pub fn remove_ai_config(&mut self, index: usize) -> Result<()> {
        if index >= self.ai_configs.len() {
            return Err(anyhow!("配置索引超出范围: {}", index));
        }

        self.ai_configs.remove(index);

        // 调整启用索引
        if let Some(active_index) = self.active_config_index {
            if active_index == index {
                // 删除的是当前启用的，设为None或第一个
                self.active_config_index = if self.ai_configs.is_empty() {
                    None
                } else {
                    Some(0)
                };
            } else if active_index > index {
                // 启用索引在删除索引后面，需要调整
                self.active_config_index = Some(active_index - 1);
            }
        }

        Ok(())
    }

    /// 设置启用的AI配置
    pub fn set_active_ai_config(&mut self, index: usize) -> Result<()> {
        if index < self.ai_configs.len() {
            self.active_config_index = Some(index);
            Ok(())
        } else {
            Err(anyhow!("配置索引超出范围: {}", index))
        }
    }

    /// 获取所有AI配置
    pub fn get_all_ai_configs(&self) -> &Vec<AIConfig> {
        &self.ai_configs
    }
}

#[derive(Debug, Clone)]
pub struct ConfigManager {
    config_path: PathBuf,
    config: AppConfig,
}

impl ConfigManager {
    pub fn new(config_path: Option<PathBuf>) -> Result<Self> {
        let config_path = config_path.unwrap_or_else(|| {
            // Phase 9: 使用新的 paths.rs 统一路径管理
            // 支持便携模式：程序目录/.config/ 或 系统目录
            paths::app_home_dir()
                .map(|dir| dir.join("config.json"))
                .unwrap_or_else(|_| {
                    // 降级：使用旧的用户目录路径
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
            // 保存默认配置
            let manager = Self {
                config_path: config_path.clone(),
                config: default_config.clone(),
            };
            manager.save()?;
            default_config
        };

        Ok(Self {
            config_path,
            config,
        })
    }

    pub fn load_from_file<P: AsRef<Path>>(path: P) -> Result<AppConfig> {
        let content = fs::read_to_string(path).map_err(|e| anyhow!("无法读取配置文件: {}", e))?;

        let config: AppConfig =
            serde_json::from_str(&content).map_err(|e| anyhow!("配置文件格式错误: {}", e))?;

        Ok(config)
    }

    pub fn save(&self) -> Result<()> {
        let content = serde_json::to_string_pretty(&self.config)
            .map_err(|e| anyhow!("序列化配置失败: {}", e))?;

        fs::write(&self.config_path, content).map_err(|e| anyhow!("保存配置文件失败: {}", e))?;

        Ok(())
    }

    /// 保存配置并递增版本号（用于配置修改）
    fn save_with_version_increment(&mut self) -> Result<()> {
        // 递增版本号
        self.config.config_version = self.config.config_version.wrapping_add(1);

        // 更新时间戳
        let now = chrono::Local::now().to_rfc3339();
        self.config.last_modified = Some(now);

        self.save()
    }

    pub fn get_config(&self) -> &AppConfig {
        &self.config
    }

    pub fn get_config_mut(&mut self) -> &mut AppConfig {
        &mut self.config
    }

    pub fn update_config<F>(&mut self, updater: F) -> Result<()>
    where
        F: FnOnce(&mut AppConfig),
    {
        updater(&mut self.config);
        self.save_with_version_increment()?;
        Ok(())
    }

    /// 获取配置版本信息（用于前后端同步）
    pub fn get_config_version_info(&self) -> ConfigVersionInfo {
        ConfigVersionInfo {
            version: self.config.config_version,
            timestamp: self
                .config
                .last_modified
                .clone()
                .unwrap_or_else(|| "unknown".to_string()),
            active_config_index: self.config.active_config_index,
            config_count: self.config.ai_configs.len(),
        }
    }

    pub fn set_api_key(&mut self, api_key: String) -> Result<()> {
        self.config.api_key = api_key;
        self.save()
    }

    pub fn set_provider(&mut self, provider: String) -> Result<()> {
        self.config.provider = provider;
        self.save()
    }

    pub fn set_model(&mut self, model: String) -> Result<()> {
        self.config.model = model;
        self.save()
    }

    pub fn set_base_url(&mut self, base_url: Option<String>) -> Result<()> {
        self.config.base_url = base_url;
        self.save()
    }

    pub fn set_batch_size(&mut self, batch_size: usize) -> Result<()> {
        self.config.batch_size = batch_size;
        self.save()
    }

    pub fn set_max_concurrent(&mut self, max_concurrent: usize) -> Result<()> {
        self.config.max_concurrent = max_concurrent;
        self.save()
    }

    pub fn set_timeout(&mut self, timeout_seconds: u64) -> Result<()> {
        self.config.timeout_seconds = timeout_seconds;
        self.save()
    }

    pub fn toggle_translation_memory(&mut self) -> Result<()> {
        self.config.use_translation_memory = !self.config.use_translation_memory;
        self.save()
    }

    pub fn toggle_auto_save(&mut self) -> Result<()> {
        self.config.auto_save = !self.config.auto_save;
        self.save()
    }

    pub fn reset_to_default(&mut self) -> Result<()> {
        self.config = AppConfig::default();
        self.save()
    }

    pub fn get_config_path(&self) -> &Path {
        &self.config_path
    }

    pub fn export_config<P: AsRef<Path>>(&self, export_path: P) -> Result<()> {
        let content = serde_json::to_string_pretty(&self.config)
            .map_err(|e| anyhow!("序列化配置失败: {}", e))?;

        fs::write(export_path, content).map_err(|e| anyhow!("导出配置文件失败: {}", e))?;

        Ok(())
    }

    pub fn import_config<P: AsRef<Path>>(&mut self, import_path: P) -> Result<()> {
        let content =
            fs::read_to_string(import_path).map_err(|e| anyhow!("读取导入配置文件失败: {}", e))?;

        let imported_config: AppConfig =
            serde_json::from_str(&content).map_err(|e| anyhow!("导入配置文件格式错误: {}", e))?;

        self.config = imported_config;
        self.save()?;

        Ok(())
    }

    pub fn validate_config(&self) -> Result<()> {
        if self.config.api_key.is_empty() {
            return Err(anyhow!("API密钥不能为空"));
        }

        if self.config.batch_size == 0 {
            return Err(anyhow!("批量大小必须大于0"));
        }

        if self.config.max_concurrent == 0 {
            return Err(anyhow!("最大并发数必须大于0"));
        }

        if self.config.timeout_seconds == 0 {
            return Err(anyhow!("超时时间必须大于0"));
        }

        // 验证provider和model的组合
        match self.config.provider.as_str() {
            "moonshot" => {
                if !self.config.model.starts_with("moonshot") {
                    return Err(anyhow!("Moonshot provider必须使用moonshot模型"));
                }
            }
            "openai" => {
                if !self.config.model.starts_with("gpt") {
                    return Err(anyhow!("OpenAI provider必须使用GPT模型"));
                }
            }
            _ => {
                return Err(anyhow!("不支持的provider: {}", self.config.provider));
            }
        }

        Ok(())
    }

    pub fn get_provider_configs() -> Vec<ProviderConfig> {
        vec![
            ProviderConfig {
                name: "moonshot".to_string(),
                display_name: "Moonshot AI".to_string(),
                base_url: "https://api.moonshot.cn/v1".to_string(),
                models: vec![
                    "moonshot-v1-auto".to_string(),
                    "moonshot-v1-8k".to_string(),
                    "moonshot-v1-32k".to_string(),
                    "moonshot-v1-128k".to_string(),
                ],
            },
            ProviderConfig {
                name: "openai".to_string(),
                display_name: "OpenAI".to_string(),
                base_url: "https://api.openai.com/v1".to_string(),
                models: vec![
                    "gpt-3.5-turbo".to_string(),
                    "gpt-4".to_string(),
                    "gpt-4-turbo".to_string(),
                ],
            },
        ]
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderConfig {
    pub name: String,
    pub display_name: String,
    pub base_url: String,
    pub models: Vec<String>,
}
