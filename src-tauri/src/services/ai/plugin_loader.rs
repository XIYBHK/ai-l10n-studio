/**
 * 插件加载器 (Phase 3)
 *
 * 负责插件的发现、加载、验证和注册，实现真正的插件化架构
 */
use anyhow::{Context, Result};
use parking_lot::RwLock;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Arc;

use super::plugin_config::{PluginConfig, PluginScanner};
use super::provider::{ProviderInfo, with_global_registry_mut};
use crate::services::model_config::ModelApi;

/// 插件加载器状态
#[derive(Debug, Clone)]
pub enum PluginStatus {
    /// 插件已成功加载
    Loaded,
    /// 插件加载失败
    Failed(String),
    /// 插件被禁用
    Disabled,
    /// 插件版本不兼容
    Incompatible(String),
}

/// 已加载的插件信息
#[derive(Debug, Clone)]
pub struct LoadedPlugin {
    pub config: PluginConfig,
    pub path: PathBuf,
    pub status: PluginStatus,
    pub loaded_at: chrono::DateTime<chrono::Utc>,
}

/// 插件加载器
pub struct PluginLoader {
    /// 插件目录路径
    plugins_dir: PathBuf,
    /// 已加载的插件
    loaded_plugins: Arc<RwLock<HashMap<String, LoadedPlugin>>>,
    /// 支持的 API 版本
    supported_api_version: String,
}

impl PluginLoader {
    /// 创建新的插件加载器
    pub fn new<P: AsRef<Path>>(plugins_dir: P) -> Self {
        Self {
            plugins_dir: plugins_dir.as_ref().to_path_buf(),
            loaded_plugins: Arc::new(RwLock::new(HashMap::new())),
            supported_api_version: "1.0".to_string(), // 当前支持的 API 版本
        }
    }

    /// 扫描并加载所有插件
    pub fn load_all_plugins(&self) -> Result<usize> {
        tracing::info!("开始扫描插件目录: {}", self.plugins_dir.display());

        let scanner = PluginScanner::new(&self.plugins_dir);
        let discovered_plugins = scanner.scan_plugins().context("插件目录扫描失败")?;

        let mut loaded_count = 0;
        let mut failed_count = 0;

        for (plugin_path, config) in discovered_plugins {
            match self.load_single_plugin(plugin_path, config) {
                Ok(_) => {
                    loaded_count += 1;
                }
                Err(e) => {
                    failed_count += 1;
                    tracing::error!("插件加载失败: {}", e);
                }
            }
        }

        tracing::info!("插件加载完成: {} 成功, {} 失败", loaded_count, failed_count);

        Ok(loaded_count)
    }

    /// 加载单个插件
    fn load_single_plugin(&self, plugin_path: PathBuf, config: PluginConfig) -> Result<()> {
        let plugin_id = config.plugin.id.clone();

        tracing::debug!("加载插件: {} ({})", config.plugin.name, plugin_id);

        // 1. 验证插件配置
        config
            .validate()
            .with_context(|| format!("插件 {} 配置验证失败", plugin_id))?;

        // 2. 检查 API 版本兼容性
        if !config.is_api_compatible(&self.supported_api_version) {
            let error_msg = format!(
                "API 版本不兼容: 插件需要 {} 但系统支持 {}",
                config.plugin.api_version, self.supported_api_version
            );

            self.register_failed_plugin(plugin_path, config, error_msg.clone());
            anyhow::bail!(error_msg);
        }

        // 3. 检查插件目录结构
        let scanner = PluginScanner::new(&self.plugins_dir);
        scanner
            .validate_plugin_structure(&plugin_path)
            .with_context(|| format!("插件 {} 目录结构无效", plugin_id))?;

        // 4. 创建 ProviderInfo 并注册到全局注册表
        let provider_info = ProviderInfo {
            id: config.plugin.id.clone(),
            display_name: config.provider.display_name.clone(),
            default_url: config.provider.default_url.clone(),
            api: config.provider.api,
            default_model: config.provider.default_model.clone(),
        };

        // 注册到全局供应商注册表
        // 注意：这里我们需要动态创建 AIProvider 实现
        // 在真实实现中，这里需要动态加载编译后的供应商代码
        self.register_plugin_provider(&config, provider_info)
            .with_context(|| format!("注册插件供应商失败: {}", plugin_id))?;

        // 5. 记录已加载的插件
        let loaded_plugin = LoadedPlugin {
            config,
            path: plugin_path,
            status: PluginStatus::Loaded,
            loaded_at: chrono::Utc::now(),
        };

        {
            let mut plugins = self.loaded_plugins.write();
            plugins.insert(plugin_id.clone(), loaded_plugin);
        }

        tracing::info!("插件加载成功: {}", plugin_id);
        Ok(())
    }

    /// 注册失败的插件（用于调试和状态查询）
    fn register_failed_plugin(&self, plugin_path: PathBuf, config: PluginConfig, error: String) {
        let loaded_plugin = LoadedPlugin {
            config: config.clone(),
            path: plugin_path,
            status: PluginStatus::Failed(error),
            loaded_at: chrono::Utc::now(),
        };

        let mut plugins = self.loaded_plugins.write();
        plugins.insert(config.plugin.id.clone(), loaded_plugin);
    }

    /// 注册插件供应商到全局注册表
    ///
    /// 注意：如果供应商已存在（内置或之前加载的插件），将覆盖它
    /// 这样插件可以优先于内置供应商，提供更新的配置
    fn register_plugin_provider(
        &self,
        config: &PluginConfig,
        _provider_info: ProviderInfo,
    ) -> Result<()> {
        // 创建一个动态的 AIProvider 实现
        let dynamic_provider = DynamicAIProvider::new(config.clone());

        // 注册到全局注册表，如果已存在则覆盖
        with_global_registry_mut(|registry| {
            let provider_id = config.plugin.id.clone();

            // 检查是否已存在
            if registry.get_provider(&provider_id).is_some() {
                tracing::warn!("供应商 '{}' 已存在，插件版本将覆盖内置版本", provider_id);
            }

            // 直接注册（可能覆盖内置版本）
            registry.register(dynamic_provider)
        })
        .with_context(|| format!("注册供应商到全局注册表失败: {}", config.plugin.id))
    }

    /// 获取所有已加载的插件信息
    pub fn get_loaded_plugins(&self) -> HashMap<String, LoadedPlugin> {
        let plugins = self.loaded_plugins.read();
        plugins.clone()
    }

    /// 获取特定插件的状态
    pub fn get_plugin_status(&self, plugin_id: &str) -> Option<PluginStatus> {
        let plugins = self.loaded_plugins.read();
        plugins.get(plugin_id).map(|p| p.status.clone())
    }

    /// 重新加载特定插件（用于热重载）
    pub fn reload_plugin(&self, plugin_id: &str) -> Result<()> {
        tracing::info!("重新加载插件: {}", plugin_id);

        // 1. 从已加载列表中获取插件路径
        let plugin_path = {
            let plugins = self.loaded_plugins.read();
            plugins
                .get(plugin_id)
                .map(|p| p.path.clone())
                .ok_or_else(|| anyhow::anyhow!("插件未找到: {}", plugin_id))?
        };

        // 2. 重新读取配置
        let config_path = plugin_path.join("plugin.toml");
        let config = PluginConfig::from_file(&config_path).context("重新读取插件配置失败")?;

        // 3. 卸载旧版本（从注册表中移除）
        // 注意：这里需要实现供应商的卸载逻辑

        // 4. 重新加载
        self.load_single_plugin(plugin_path, config)
    }

    /// 获取插件目录路径
    pub fn get_plugins_directory(&self) -> &Path {
        &self.plugins_dir
    }

    /// 创建插件目录（如果不存在）
    pub fn ensure_plugins_directory(&self) -> Result<()> {
        if !self.plugins_dir.exists() {
            std::fs::create_dir_all(&self.plugins_dir)
                .with_context(|| format!("创建插件目录失败: {}", self.plugins_dir.display()))?;
            tracing::info!("创建插件目录: {}", self.plugins_dir.display());
        }
        Ok(())
    }
}

/// 动态 AI 供应商实现
///
/// 这是一个基于 TOML catalog 的 AIProvider 实现。
struct DynamicAIProvider {
    config: PluginConfig,
}

impl DynamicAIProvider {
    fn new(config: PluginConfig) -> Self {
        Self { config }
    }
}

use super::ModelInfo;
use super::provider::AIProvider;

impl AIProvider for DynamicAIProvider {
    fn id(&self) -> &str {
        &self.config.plugin.id
    }

    fn display_name(&self) -> &str {
        &self.config.provider.display_name
    }

    fn default_url(&self) -> &str {
        &self.config.provider.default_url
    }

    fn api(&self) -> ModelApi {
        self.config.provider.api
    }

    fn default_model(&self) -> &str {
        &self.config.provider.default_model
    }

    fn get_models(&self) -> Vec<ModelInfo> {
        // 从插件配置动态生成模型列表
        self.config
            .provider
            .models
            .iter()
            .map(|model_config| ModelInfo {
                id: model_config.id.clone(),
                name: model_config.name.clone(),
                provider: self.config.provider.display_name.clone(),
                context_window: model_config.context_window,
                max_output_tokens: model_config.max_output_tokens,
                input_price: model_config.input_price,
                output_price: model_config.output_price,
                cache_reads_price: model_config.cache_reads_price,
                cache_writes_price: model_config.cache_writes_price,
                supports_cache: self.config.provider.supports_cache,
                supports_images: self.config.provider.supports_images,
                recommended: model_config.recommended,
                description: model_config.description.clone(),
            })
            .collect()
    }
}

/// 全局插件加载器实例
static GLOBAL_PLUGIN_LOADER: std::sync::OnceLock<parking_lot::RwLock<Option<PluginLoader>>> =
    std::sync::OnceLock::new();

/// 初始化全局插件加载器
pub fn init_global_plugin_loader<P: AsRef<Path>>(plugins_dir: P) -> Result<()> {
    let loader = PluginLoader::new(plugins_dir);
    loader.ensure_plugins_directory()?;

    let global_loader = GLOBAL_PLUGIN_LOADER.get_or_init(|| parking_lot::RwLock::new(None));

    {
        let mut loader_guard = global_loader.write();
        *loader_guard = Some(loader);
    }

    tracing::info!("全局插件加载器初始化完成");
    Ok(())
}

/// 使用全局插件加载器执行操作
pub fn with_global_plugin_loader<T, F>(f: F) -> Result<T>
where
    F: FnOnce(&PluginLoader) -> Result<T>,
{
    let global_loader = GLOBAL_PLUGIN_LOADER
        .get()
        .ok_or_else(|| anyhow::anyhow!("插件加载器未初始化"))?;

    let loader_guard = global_loader.read();
    let loader = loader_guard
        .as_ref()
        .ok_or_else(|| anyhow::anyhow!("插件加载器未设置"))?;

    f(loader)
}

/// 加载所有插件（便捷函数）
pub fn load_all_plugins() -> Result<usize> {
    with_global_plugin_loader(|loader| loader.load_all_plugins())
}

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used, clippy::clone_on_ref_ptr)]
mod tests {
    use super::super::cost_calculator::CostCalculator;
    use super::*;
    use std::io::Write;
    use tempfile::TempDir;

    #[test]
    fn toml_model_preserves_zero_and_missing_cache_prices_in_costs() {
        let config = PluginConfig::from_toml(
            r#"
[plugin]
name = "Cost Test"
id = "cost_test"
version = "1.0.0"
api_version = "1.0"

[provider]
api = "openai-completions"
display_name = "Cost Test"
default_url = "https://api.example.com/v1"
default_model = "free-cache"

[[provider.models]]
id = "free-cache"
name = "Free Cache"
context_window = 4096
max_output_tokens = 1024
input_price = 1.0
output_price = 2.0
cache_reads_price = 0.0
cache_writes_price = 0.0

[[provider.models]]
id = "default-cache"
name = "Default Cache"
context_window = 4096
max_output_tokens = 1024
input_price = 1.0
output_price = 2.0
"#,
        )
        .unwrap();

        let models = DynamicAIProvider::new(config).get_models();
        assert_eq!(models[0].cache_reads_price, Some(0.0));
        assert_eq!(models[0].cache_writes_price, Some(0.0));
        assert_eq!(models[1].cache_reads_price, None);
        assert_eq!(models[1].cache_writes_price, None);

        let free_cost =
            CostCalculator::calculate_openai(&models[0], 1_000_000, 0, 500_000, 500_000);
        assert_eq!(free_cost.cache_read_cost, 0.0);
        assert_eq!(free_cost.cache_write_cost, 0.0);

        let default_cost =
            CostCalculator::calculate_openai(&models[1], 1_000_000, 0, 500_000, 500_000);
        assert_eq!(default_cost.cache_read_cost, 0.5);
        assert_eq!(default_cost.cache_write_cost, 0.5);
    }

    fn create_test_plugin_dir(temp_dir: &TempDir, plugin_id: &str) -> PathBuf {
        let plugins_dir = temp_dir.path().join("plugins");
        let plugin_dir = plugins_dir.join(plugin_id);
        std::fs::create_dir_all(&plugin_dir).unwrap();

        // 创建 plugin.toml
        let config_content = format!(
            r#"[plugin]
name = "Test Plugin {}"
id = "{}"
version = "1.0.0"
api_version = "1.0"
description = "Test plugin"
author = "Test Author"

[provider]
api = "openai-completions"
display_name = "Test Provider {}"
default_url = "https://api.test{}.com/v1"
default_model = "test-model-{}"
supports_cache = true
supports_images = false
"#,
            plugin_id, plugin_id, plugin_id, plugin_id, plugin_id
        );

        let mut config_file = std::fs::File::create(plugin_dir.join("plugin.toml")).unwrap();
        config_file.write_all(config_content.as_bytes()).unwrap();

        // 创建必需的文件
        std::fs::File::create(plugin_dir.join("provider.rs")).unwrap();
        std::fs::File::create(plugin_dir.join("models.rs")).unwrap();

        plugins_dir
    }

    #[test]
    fn test_plugin_loader_creation() {
        let temp_dir = TempDir::new().unwrap();
        let plugins_dir = temp_dir.path().join("plugins");

        let loader = PluginLoader::new(&plugins_dir);
        assert_eq!(loader.get_plugins_directory(), plugins_dir);
    }

    #[test]
    fn test_ensure_plugins_directory() {
        let temp_dir = TempDir::new().unwrap();
        let plugins_dir = temp_dir.path().join("plugins");

        let loader = PluginLoader::new(&plugins_dir);
        assert!(!plugins_dir.exists());

        loader.ensure_plugins_directory().unwrap();
        assert!(plugins_dir.exists());
    }

    #[test]
    fn test_load_single_plugin() {
        let temp_dir = TempDir::new().unwrap();
        let plugins_dir = create_test_plugin_dir(&temp_dir, "test_one");

        let loader = PluginLoader::new(&plugins_dir);
        let loaded_count = loader.load_all_plugins().unwrap();

        assert_eq!(loaded_count, 1);
        let loaded_plugins = loader.get_loaded_plugins();
        let plugin = loaded_plugins.get("test_one").unwrap();
        assert_eq!(plugin.config.plugin.id, "test_one");
        assert!(matches!(plugin.status, PluginStatus::Loaded));
    }

    #[test]
    fn test_load_multiple_plugins() {
        let temp_dir = TempDir::new().unwrap();
        let plugins_dir = create_test_plugin_dir(&temp_dir, "test_one");

        // 创建第二个插件
        let plugin2_dir = plugins_dir.join("test_two");
        std::fs::create_dir(&plugin2_dir).unwrap();

        let config2_content = r#"[plugin]
name = "Test Plugin 2"
id = "test_two"
version = "1.0.0"
api_version = "1.0"

[provider]
api = "openai-completions"
display_name = "Test Provider 2"
default_url = "https://api.test_two.com/v1"
default_model = "test-model-2"
"#;
        std::fs::write(plugin2_dir.join("plugin.toml"), config2_content).unwrap();
        std::fs::File::create(plugin2_dir.join("provider.rs")).unwrap();

        let loader = PluginLoader::new(&plugins_dir);
        let loaded_count = loader.load_all_plugins().unwrap();

        assert_eq!(loaded_count, 2);
        let loaded_plugins = loader.get_loaded_plugins();
        assert!(loaded_plugins.contains_key("test_one"));
        assert!(loaded_plugins.contains_key("test_two"));
    }

    #[test]
    fn builtin_catalog_exposes_explicit_protocol_and_base_url() {
        let plugins_path = Path::new(env!("CARGO_MANIFEST_DIR")).join("../plugins");
        let plugins = PluginScanner::new(plugins_path).scan_plugins().unwrap();
        assert_eq!(plugins.len(), 6);
        for (_, config) in plugins {
            let provider = DynamicAIProvider::new(config.clone());
            let info = provider.get_provider_info();
            let expected = if config.plugin.id == "minimax" {
                ModelApi::AnthropicMessages
            } else {
                ModelApi::OpenaiCompletions
            };
            assert_eq!(info.api, expected, "{}", info.id);
            assert_eq!(info.default_url, config.provider.default_url);
            assert_eq!(info.default_model, config.provider.default_model);
            assert!(
                !["/chat/completions", "/responses", "/messages"]
                    .iter()
                    .any(|suffix| info.default_url.ends_with(suffix))
            );
        }
    }
}
