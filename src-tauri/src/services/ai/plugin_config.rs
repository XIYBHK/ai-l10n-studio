use crate::services::model_config::ModelApi;
/**
 * 插件配置管理系统 (Phase 3)
 *
 * 负责解析和验证插件的 TOML 配置文件，提供插件元数据管理功能
 */
use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::path::Path;

/// 插件配置的根结构
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct PluginConfig {
    pub plugin: PluginMeta,
    pub provider: ProviderConfig,
}

/// 插件元数据
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct PluginMeta {
    /// 插件名称（用于显示）
    pub name: String,
    /// 插件唯一标识符（小写，用于内部识别）
    pub id: String,
    /// 插件版本
    pub version: String,
    /// 支持的 API 版本
    pub api_version: String,
    /// 插件描述
    #[serde(default)]
    pub description: String,
    /// 插件作者
    #[serde(default)]
    pub author: String,
    /// 插件主页或仓库地址
    #[serde(default)]
    pub homepage: Option<String>,
    /// 插件许可证
    #[serde(default)]
    pub license: Option<String>,
}

/// 供应商配置
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ProviderConfig {
    /// Explicit wire protocol; plugin configurations must declare this field.
    pub api: ModelApi,
    /// 供应商显示名称
    pub display_name: String,
    /// 默认 API 基础 URL
    pub default_url: String,
    /// 默认模型 ID
    pub default_model: String,
    /// 是否支持缓存
    #[serde(default)]
    pub supports_cache: bool,
    /// 是否支持图像输入
    #[serde(default)]
    pub supports_images: bool,
    /// 模型列表（完整定义）
    #[serde(default)]
    pub models: Vec<ModelPluginConfig>,
}

/// 插件模型配置
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ModelPluginConfig {
    /// 模型 ID
    pub id: String,
    /// 模型显示名称
    pub name: String,
    /// 上下文窗口大小
    pub context_window: usize,
    /// 最大输出 token 数
    pub max_output_tokens: usize,
    /// 输入价格（USD per 1M tokens）
    pub input_price: f64,
    /// 输出价格（USD per 1M tokens）
    pub output_price: f64,
    /// 缓存读取价格（可选）
    #[serde(default)]
    pub cache_reads_price: Option<f64>,
    /// 缓存写入价格（可选）
    #[serde(default)]
    pub cache_writes_price: Option<f64>,
    /// 是否推荐
    #[serde(default)]
    pub recommended: bool,
    /// 模型描述
    #[serde(default)]
    pub description: Option<String>,
}

impl PluginConfig {
    /// 从 TOML 文件加载插件配置
    pub fn from_file<P: AsRef<Path>>(path: P) -> Result<Self> {
        let path = path.as_ref();
        let content = std::fs::read_to_string(path)
            .with_context(|| format!("无法读取插件配置文件: {}", path.display()))?;

        Self::from_toml(&content)
            .with_context(|| format!("解析插件配置文件失败: {}", path.display()))
    }

    /// 从 TOML 字符串解析插件配置
    pub fn from_toml(content: &str) -> Result<Self> {
        let config: PluginConfig = toml::from_str(content).context("TOML 格式解析失败")?;

        config.validate().context("插件配置验证失败")?;

        Ok(config)
    }

    /// 验证插件配置的有效性
    pub fn validate(&self) -> Result<()> {
        // 验证插件 ID 格式
        if self.plugin.id.is_empty() {
            anyhow::bail!("插件 ID 不能为空");
        }
        if !self
            .plugin
            .id
            .chars()
            .all(|c| c.is_ascii_lowercase() || c == '_' || c == '-')
        {
            anyhow::bail!("插件 ID 只能包含小写字母、下划线和连字符");
        }

        // 验证版本格式（简单的语义版本检查）
        if !self.is_valid_version(&self.plugin.version) {
            anyhow::bail!("插件版本格式无效: {}", self.plugin.version);
        }
        if !self.is_valid_version(&self.plugin.api_version) {
            anyhow::bail!("API 版本格式无效: {}", self.plugin.api_version);
        }

        // 验证供应商配置
        if self.provider.display_name.is_empty() {
            anyhow::bail!("供应商显示名称不能为空");
        }
        if self.provider.default_url.is_empty() {
            anyhow::bail!("默认 URL 不能为空");
        }
        let url =
            reqwest::Url::parse(&self.provider.default_url).context("默认 API 基础 URL 无效")?;
        if !matches!(url.scheme(), "https" | "http")
            || url.host_str().is_none()
            || !url.username().is_empty()
            || url.password().is_some()
            || url.query().is_some()
            || url.fragment().is_some()
        {
            anyhow::bail!("默认 URL 必须是无凭证和查询参数的 HTTP(S) 基础地址");
        }
        let path = url.path().trim_end_matches('/');
        if ["/chat/completions", "/responses", "/messages"]
            .iter()
            .any(|suffix| path.ends_with(suffix))
        {
            anyhow::bail!("默认 URL 必须是基础地址，不能包含请求端点");
        }
        if self.provider.default_model.is_empty() {
            anyhow::bail!("默认模型不能为空");
        }

        Ok(())
    }

    /// 检查版本格式是否有效（简单的语义版本检查）
    fn is_valid_version(&self, version: &str) -> bool {
        let parts: Vec<&str> = version.split('.').collect();
        if parts.len() < 2 || parts.len() > 3 {
            return false;
        }

        parts.iter().all(|part| part.parse::<u32>().is_ok())
    }

    /// 检查 API 版本兼容性
    pub fn is_api_compatible(&self, supported_version: &str) -> bool {
        // 简单的版本兼容性检查：主版本号必须相同
        let plugin_major = self.plugin.api_version.split('.').next().unwrap_or("0");
        let supported_major = supported_version.split('.').next().unwrap_or("0");
        plugin_major == supported_major
    }

    /// 获取插件的完整标识（id@version）
    pub fn full_id(&self) -> String {
        format!("{}@{}", self.plugin.id, self.plugin.version)
    }
}

/// 插件目录扫描器
pub struct PluginScanner {
    plugins_dir: std::path::PathBuf,
}

impl PluginScanner {
    /// 创建新的插件扫描器
    pub fn new<P: AsRef<Path>>(plugins_dir: P) -> Self {
        Self {
            plugins_dir: plugins_dir.as_ref().to_path_buf(),
        }
    }

    /// 扫描插件目录，返回所有找到的插件配置
    pub fn scan_plugins(&self) -> Result<Vec<(std::path::PathBuf, PluginConfig)>> {
        let mut plugins = Vec::new();

        if !self.plugins_dir.exists() {
            tracing::warn!("插件目录不存在: {}", self.plugins_dir.display());
            return Ok(plugins);
        }

        let entries = std::fs::read_dir(&self.plugins_dir)
            .with_context(|| format!("无法读取插件目录: {}", self.plugins_dir.display()))?;

        for entry in entries {
            let entry = entry.context("读取目录项失败")?;
            let path = entry.path();

            if path.is_dir() {
                let config_path = path.join("plugin.toml");
                if config_path.exists() {
                    match PluginConfig::from_file(&config_path) {
                        Ok(config) => {
                            tracing::info!(
                                "发现插件: {} ({})",
                                config.plugin.name,
                                config.plugin.id
                            );
                            plugins.push((path, config));
                        }
                        Err(e) => {
                            tracing::error!("加载插件配置失败 {}: {}", config_path.display(), e);
                        }
                    }
                }
            }
        }

        tracing::info!("扫描完成，发现 {} 个插件", plugins.len());
        Ok(plugins)
    }

    /// 验证插件目录结构
    pub fn validate_plugin_structure(&self, plugin_dir: &Path) -> Result<()> {
        // 检查必需文件
        let config_file = plugin_dir.join("plugin.toml");
        if !config_file.exists() {
            anyhow::bail!("缺少插件配置文件: plugin.toml");
        }

        // 插件是纯 TOML catalog；provider.rs 和 models.rs 不参与运行时加载。

        Ok(())
    }
}

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used, clippy::clone_on_ref_ptr)]
mod tests {
    use super::*;
    use std::io::Write;
    use tempfile::TempDir;

    fn create_test_config() -> PluginConfig {
        PluginConfig {
            plugin: PluginMeta {
                name: "Test Provider".to_string(),
                id: "test_provider".to_string(),
                version: "1.0.0".to_string(),
                api_version: "1.0".to_string(),
                description: "Test provider plugin".to_string(),
                author: "Test Author".to_string(),
                homepage: Some("https://example.com".to_string()),
                license: Some("MIT".to_string()),
            },
            provider: ProviderConfig {
                api: ModelApi::OpenaiCompletions,
                display_name: "Test Provider".to_string(),
                default_url: "https://api.test.com/v1".to_string(),
                default_model: "test-model".to_string(),
                supports_cache: true,
                supports_images: false,
                models: vec![],
            },
        }
    }

    #[test]
    fn test_plugin_config_validation() {
        let config = create_test_config();
        assert!(config.validate().is_ok());

        // 测试无效 ID
        let mut invalid_config = config.clone();
        invalid_config.plugin.id = "Invalid-ID-With-Caps".to_string();
        assert!(invalid_config.validate().is_err());

        // 测试空 URL
        let mut invalid_config = config.clone();
        invalid_config.provider.default_url = "".to_string();
        assert!(invalid_config.validate().is_err());
    }

    #[test]
    fn catalog_rejects_missing_protocol_and_endpoint_urls() {
        let config = create_test_config();
        let toml = toml::to_string(&config).unwrap();
        assert!(PluginConfig::from_toml(&toml).is_ok());
        let missing_protocol = toml.replace("api = \"openai-completions\"\n", "");
        assert!(PluginConfig::from_toml(&missing_protocol).is_err());
        assert!(
            PluginConfig::from_toml(&format!(
                "{toml}\n[provider.extra_config]\nmax_retries = 3\n"
            ))
            .is_err()
        );
        for endpoint in ["/chat/completions", "/responses", "/messages"] {
            let mut invalid = config.clone();
            invalid.provider.default_url = format!("https://api.test.com/v1{endpoint}");
            assert!(invalid.validate().is_err());
        }
    }

    #[test]
    fn example_catalogs_match_the_runtime_schema() {
        let root = Path::new(env!("CARGO_MANIFEST_DIR")).join("../example-plugins");
        let configs = PluginScanner::new(root).scan_plugins().unwrap();
        assert_eq!(configs.len(), 3);
    }

    #[test]
    fn test_toml_parsing() {
        let toml_content = r#"
[plugin]
name = "Test Provider"
id = "test_provider"
version = "1.0.0"
api_version = "1.0"
description = "Test provider plugin"
author = "Test Author"

[provider]
api = "openai-completions"
display_name = "Test Provider"
default_url = "https://api.test.com/v1"
default_model = "test-model"
supports_cache = true
supports_images = false
"#;

        let config = PluginConfig::from_toml(toml_content).unwrap();
        assert_eq!(config.plugin.id, "test_provider");
        assert_eq!(config.provider.display_name, "Test Provider");
        assert!(config.provider.supports_cache);
    }

    #[test]
    fn test_api_compatibility() {
        let config = create_test_config();

        // 兼容的版本
        assert!(config.is_api_compatible("1.0"));
        assert!(config.is_api_compatible("1.2"));
        assert!(config.is_api_compatible("1.0.5"));

        // 不兼容的版本
        assert!(!config.is_api_compatible("2.0"));
        assert!(!config.is_api_compatible("0.9"));
    }

    #[test]
    fn test_plugin_scanner() {
        let temp_dir = TempDir::new().unwrap();
        let plugins_dir = temp_dir.path().join("plugins");
        std::fs::create_dir(&plugins_dir).unwrap();

        // 创建一个测试插件
        let plugin_dir = plugins_dir.join("test_plugin");
        std::fs::create_dir(&plugin_dir).unwrap();

        let config_path = plugin_dir.join("plugin.toml");
        let mut config_file = std::fs::File::create(&config_path).unwrap();
        writeln!(
            config_file,
            r#"
[plugin]
name = "Test Plugin"
id = "test_plugin"
version = "1.0.0"
api_version = "1.0"

[provider]
api = "openai-completions"
display_name = "Test Provider"
default_url = "https://api.test.com/v1"
default_model = "test-model"
"#
        )
        .unwrap();

        // 创建必需的文件
        std::fs::File::create(plugin_dir.join("provider.rs")).unwrap();

        let scanner = PluginScanner::new(&plugins_dir);
        let plugins = scanner.scan_plugins().unwrap();

        assert_eq!(plugins.len(), 1);
        assert_eq!(plugins[0].1.plugin.id, "test_plugin");
    }
}
