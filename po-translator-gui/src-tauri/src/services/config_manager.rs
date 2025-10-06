use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize)]
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
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            api_key: String::new(),
            provider: "moonshot".to_string(),
            model: "moonshot-v1-auto".to_string(),
            base_url: Some("https://api.moonshot.cn/v1".to_string()),
            use_translation_memory: true,
            translation_memory_path: Some("data/translation_memory.json".to_string()),
            log_level: "info".to_string(),
            auto_save: true,
            batch_size: 10,
            max_concurrent: 3,
            timeout_seconds: 30,
        }
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
            let mut path = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
            path.push(".po-translator");
            path.push("config.json");
            path
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
        let content = fs::read_to_string(path)
            .map_err(|e| anyhow!("无法读取配置文件: {}", e))?;
        
        let config: AppConfig = serde_json::from_str(&content)
            .map_err(|e| anyhow!("配置文件格式错误: {}", e))?;
        
        Ok(config)
    }

    pub fn save(&self) -> Result<()> {
        let content = serde_json::to_string_pretty(&self.config)
            .map_err(|e| anyhow!("序列化配置失败: {}", e))?;
        
        fs::write(&self.config_path, content)
            .map_err(|e| anyhow!("保存配置文件失败: {}", e))?;
        
        Ok(())
    }

    pub fn get_config(&self) -> &AppConfig {
        &self.config
    }

    pub fn update_config<F>(&mut self, updater: F) -> Result<()>
    where
        F: FnOnce(&mut AppConfig),
    {
        updater(&mut self.config);
        self.save()?;
        Ok(())
    }

    pub fn set_api_key(&mut self, api_key: String) -> Result<()> {
        self.config.api_key = api_key;
        self.save()?;
        Ok(())
    }

    pub fn set_provider(&mut self, provider: String) -> Result<()> {
        self.config.provider = provider;
        self.save()?;
        Ok(())
    }

    pub fn set_model(&mut self, model: String) -> Result<()> {
        self.config.model = model;
        self.save()?;
        Ok(())
    }

    pub fn set_base_url(&mut self, base_url: Option<String>) -> Result<()> {
        self.config.base_url = base_url;
        self.save()?;
        Ok(())
    }

    pub fn set_batch_size(&mut self, batch_size: usize) -> Result<()> {
        self.config.batch_size = batch_size;
        self.save()?;
        Ok(())
    }

    pub fn set_max_concurrent(&mut self, max_concurrent: usize) -> Result<()> {
        self.config.max_concurrent = max_concurrent;
        self.save()?;
        Ok(())
    }

    pub fn set_timeout(&mut self, timeout_seconds: u64) -> Result<()> {
        self.config.timeout_seconds = timeout_seconds;
        self.save()?;
        Ok(())
    }

    pub fn toggle_translation_memory(&mut self) -> Result<()> {
        self.config.use_translation_memory = !self.config.use_translation_memory;
        self.save()?;
        Ok(())
    }

    pub fn toggle_auto_save(&mut self) -> Result<()> {
        self.config.auto_save = !self.config.auto_save;
        self.save()?;
        Ok(())
    }

    pub fn reset_to_default(&mut self) -> Result<()> {
        self.config = AppConfig::default();
        self.save()?;
        Ok(())
    }

    pub fn get_config_path(&self) -> &Path {
        &self.config_path
    }

    pub fn export_config<P: AsRef<Path>>(&self, export_path: P) -> Result<()> {
        let content = serde_json::to_string_pretty(&self.config)
            .map_err(|e| anyhow!("序列化配置失败: {}", e))?;
        
        fs::write(export_path, content)
            .map_err(|e| anyhow!("导出配置文件失败: {}", e))?;
        
        Ok(())
    }

    pub fn import_config<P: AsRef<Path>>(&mut self, import_path: P) -> Result<()> {
        let content = fs::read_to_string(import_path)
            .map_err(|e| anyhow!("读取导入配置文件失败: {}", e))?;
        
        let imported_config: AppConfig = serde_json::from_str(&content)
            .map_err(|e| anyhow!("导入配置文件格式错误: {}", e))?;
        
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
