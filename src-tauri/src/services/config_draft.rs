//! Transactional application settings with credentials stored by stable provider ID.
use super::model_config::{
    AIConfig, ModelProviderProfile, ModelSelection, validate_model_configuration,
};
use crate::{error::AppError, utils::paths};
use parking_lot::{RwLock, RwLockReadGuard};
use serde::{Deserialize, Serialize};
use std::{
    collections::BTreeMap,
    fs,
    io::Write,
    path::{Path, PathBuf},
    sync::Arc,
};
use tokio::sync::OnceCell;
#[cfg(feature = "ts-rs")]
use ts_rs::TS;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "ts-rs", derive(TS))]
#[cfg_attr(
    feature = "ts-rs",
    ts(export, export_to = "../../src/types/generated/")
)]
pub struct ConfigVersionInfo {
    #[cfg_attr(feature = "ts-rs", ts(type = "number"))]
    pub version: u64,
    pub timestamp: String,
    pub default_model: Option<ModelSelection>,
    pub config_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
#[cfg_attr(feature = "ts-rs", derive(TS))]
#[cfg_attr(
    feature = "ts-rs",
    ts(export, export_to = "../../src/types/generated/")
)]
pub struct AppConfig {
    pub model_providers: Vec<ModelProviderProfile>,
    pub default_model: Option<ModelSelection>,
    pub use_translation_memory: bool,
    pub log_level: String,
    pub batch_size: usize,
    #[cfg_attr(feature = "ts-rs", ts(type = "number"))]
    pub timeout_seconds: u64,
    pub system_prompt: Option<String>,
    pub log_retention_days: Option<u32>,
    pub log_max_size: Option<u32>,
    pub log_max_count: Option<u32>,
    #[cfg_attr(feature = "ts-rs", ts(type = "number"))]
    pub config_version: u64,
    pub last_modified: Option<String>,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            model_providers: Vec::new(),
            default_model: None,
            use_translation_memory: true,
            log_level: "info".into(),
            batch_size: 10,
            timeout_seconds: 30,
            system_prompt: None,
            log_retention_days: Some(7),
            log_max_size: Some(128),
            log_max_count: Some(8),
            config_version: 0,
            last_modified: None,
        }
    }
}

impl AppConfig {
    pub fn active_model(&self) -> Result<AIConfig, AppError> {
        let selected = self
            .default_model
            .as_ref()
            .ok_or_else(|| AppError::config("请在 AI 设置中选择默认模型"))?;
        self.model_providers
            .iter()
            .find(|provider| provider.id == selected.provider_id)
            .ok_or_else(|| AppError::config("默认模型的供应商不存在"))?
            .resolve(&selected.model_id)
    }
}

#[derive(Default, Serialize, Deserialize)]
struct ConfigSecrets {
    #[serde(default)]
    provider_keys: BTreeMap<String, String>,
}

#[derive(Clone)]
pub struct ConfigDraft {
    config_path: Arc<PathBuf>,
    secrets_path: Arc<PathBuf>,
    state: Arc<RwLock<Box<AppConfig>>>,
    load_error: Option<String>,
}

static GLOBAL_CONFIG: OnceCell<ConfigDraft> = OnceCell::const_new();

impl ConfigDraft {
    fn default_path() -> PathBuf {
        paths::app_home_dir()
            .map(|path| path.join("config.json"))
            .unwrap_or_else(|_| {
                dirs::home_dir()
                    .unwrap_or_else(|| PathBuf::from("."))
                    .join(".po-translator/config.json")
            })
    }

    pub async fn global() -> &'static Self {
        GLOBAL_CONFIG
            .get_or_init(|| async {
                let path = Self::default_path();
                Self::new(Some(path.clone())).unwrap_or_else(|error| {
                    log::error!("配置加载失败，保留原文件并阻止覆盖: {error}");
                    Self::from_config(path, AppConfig::default(), Some(error.to_string()))
                })
            })
            .await
    }

    fn from_config(path: PathBuf, config: AppConfig, load_error: Option<String>) -> Self {
        let stem = path
            .file_stem()
            .and_then(|name| name.to_str())
            .unwrap_or("config");
        let secrets_path = path.with_file_name(format!("{stem}.secrets.json"));
        Self {
            config_path: Arc::new(path),
            secrets_path: Arc::new(secrets_path),
            state: Arc::new(RwLock::new(Box::new(config))),
            load_error,
        }
    }

    pub fn new(path: Option<PathBuf>) -> Result<Self, AppError> {
        let path = path.unwrap_or_else(Self::default_path);
        let config: AppConfig = if path.exists() {
            serde_json::from_str(&fs::read_to_string(&path)?)
                .map_err(|error| AppError::config(format!("配置文件无法解析: {error}")))?
        } else {
            AppConfig::default()
        };
        let manager = Self::from_config(path, config, None);
        if manager.secrets_path.exists() {
            let secrets: ConfigSecrets =
                serde_json::from_str(&fs::read_to_string(&*manager.secrets_path)?)
                    .map_err(|error| AppError::config(format!("凭据文件无法解析: {error}")))?;
            for provider in &mut manager.state.write().model_providers {
                provider.api_key = secrets
                    .provider_keys
                    .get(&provider.id)
                    .cloned()
                    .unwrap_or_default();
            }
        }
        {
            let config = manager.data();
            validate_model_configuration(&config.model_providers, config.default_model.as_ref())?;
        }
        Ok(manager)
    }

    pub fn data(&self) -> RwLockReadGuard<'_, Box<AppConfig>> {
        self.state.read()
    }

    pub fn ensure_loaded(&self) -> Result<(), AppError> {
        match &self.load_error {
            Some(error) => Err(AppError::config(format!(
                "配置加载失败，原文件已保留: {error}"
            ))),
            None => Ok(()),
        }
    }

    /// Read, validate, persist and publish under one lock; failed writes never change live state.
    pub fn transaction(
        &self,
        update: impl FnOnce(&mut AppConfig) -> Result<(), AppError>,
    ) -> Result<(), AppError> {
        let mut state = self.state.write();
        let mut next = state.clone();
        update(&mut next)?;
        self.commit(&mut next, state.config_version)?;
        *state = next;
        Ok(())
    }

    fn commit(&self, config: &mut AppConfig, previous_version: u64) -> Result<(), AppError> {
        if let Some(error) = &self.load_error {
            return Err(AppError::config(format!(
                "原配置加载失败，未覆盖文件: {error}"
            )));
        }
        validate_model_configuration(&config.model_providers, config.default_model.as_ref())?;
        config.config_version = previous_version + 1;
        config.last_modified = Some(chrono::Utc::now().to_rfc3339());
        self.backup_replaced_schema()?;
        let secrets = ConfigSecrets {
            provider_keys: config
                .model_providers
                .iter()
                .map(|provider| (provider.id.clone(), provider.api_key.clone()))
                .collect(),
        };
        let old_secrets = if self.secrets_path.exists() {
            Some(fs::read(&*self.secrets_path)?)
        } else {
            None
        };
        write_atomic(&self.secrets_path, &serde_json::to_vec_pretty(&secrets)?)?;
        if let Err(error) = write_atomic(&self.config_path, &serde_json::to_vec_pretty(config)?) {
            if let Some(bytes) = old_secrets {
                write_atomic(&self.secrets_path, &bytes)?;
            } else if self.secrets_path.is_file() {
                fs::remove_file(&*self.secrets_path)?;
            }
            return Err(error);
        }
        Ok(())
    }

    // Preserve unreleased flat configurations without carrying their runtime schema forward.
    fn backup_replaced_schema(&self) -> Result<(), AppError> {
        if !self.config_path.is_file() {
            return Ok(());
        }
        let bytes = fs::read(&*self.config_path)?;
        let value: serde_json::Value = serde_json::from_slice(&bytes)?;
        if value.get("aiConfigs").is_none() && value.get("apiKey").is_none() {
            return Ok(());
        }
        let suffix = uuid::Uuid::new_v4();
        write_atomic(
            &self
                .config_path
                .with_extension(format!("before-provider-models.{suffix}.json")),
            &bytes,
        )?;
        if self.secrets_path.exists() {
            write_atomic(
                &self
                    .secrets_path
                    .with_extension(format!("before-provider-models.{suffix}.json")),
                &fs::read(&*self.secrets_path)?,
            )?;
        }
        Ok(())
    }
}

fn write_atomic(path: &Path, bytes: &[u8]) -> Result<(), AppError> {
    let parent = path.parent().unwrap_or_else(|| Path::new("."));
    fs::create_dir_all(parent)?;
    let mut file = tempfile::NamedTempFile::new_in(parent)?;
    file.write_all(bytes)?;
    file.as_file().sync_all()?;
    file.persist(path)
        .map_err(|error| AppError::config(format!("保存配置失败: {}", error.error)))?;
    Ok(())
}

#[cfg(test)]
#[allow(clippy::unwrap_used)]
mod tests {
    use super::super::model_config::{ModelApi, ModelDefinition};
    use super::*;

    fn provider(id: &str, key: &str) -> ModelProviderProfile {
        ModelProviderProfile {
            id: id.into(),
            display_name: id.into(),
            catalog_provider_id: None,
            api: ModelApi::OpenaiCompletions,
            base_url: "http://localhost:8080/v1".into(),
            models: vec![ModelDefinition {
                id: "model".into(),
                name: None,
                context_window: None,
                max_tokens: None,
            }],
            proxy: None,
            api_key: key.into(),
        }
    }

    #[test]
    fn stable_credentials_survive_reordering_and_are_write_only() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("config.json");
        let manager = ConfigDraft::new(Some(path.clone())).unwrap();
        manager
            .transaction(|config| {
                config.model_providers = vec![
                    provider("first", "secret-first"),
                    provider("second", "secret-second"),
                ];
                Ok(())
            })
            .unwrap();
        manager
            .transaction(|config| {
                config.model_providers.reverse();
                Ok(())
            })
            .unwrap();
        assert!(!fs::read_to_string(&path).unwrap().contains("secret-"));
        let loaded = ConfigDraft::new(Some(path)).unwrap();
        assert_eq!(loaded.data().model_providers[0].api_key, "secret-second");
        assert_eq!(loaded.data().model_providers[1].api_key, "secret-first");
        assert_eq!(loaded.data().config_version, 2);
    }

    #[test]
    fn failed_validation_and_write_keep_live_config_and_credentials() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("config.json");
        let manager = ConfigDraft::new(Some(path.clone())).unwrap();
        manager
            .transaction(|config| {
                config.model_providers = vec![provider("local", "original")];
                Ok(())
            })
            .unwrap();
        assert!(
            manager
                .transaction(|config| {
                    config.default_model = Some(ModelSelection {
                        provider_id: "local".into(),
                        model_id: "missing".into(),
                    });
                    Ok(())
                })
                .is_err()
        );
        assert!(manager.data().default_model.is_none());
        fs::remove_file(&path).unwrap();
        fs::create_dir(&path).unwrap();
        assert!(
            manager
                .transaction(|config| {
                    config.model_providers[0].api_key = "changed".into();
                    Ok(())
                })
                .is_err()
        );
        assert_eq!(manager.data().model_providers[0].api_key, "original");
        let secrets: ConfigSecrets = serde_json::from_str(
            &fs::read_to_string(dir.path().join("config.secrets.json")).unwrap(),
        )
        .unwrap();
        assert_eq!(secrets.provider_keys["local"], "original");
    }

    #[test]
    fn reading_never_rewrites_old_config_and_first_save_preserves_backup() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("config.json");
        let original = r#"{"aiConfigs":[{"apiKey":"legacy-secret"}],"batchSize":7}"#;
        fs::write(&path, original).unwrap();
        let manager = ConfigDraft::new(Some(path.clone())).unwrap();
        assert_eq!(fs::read_to_string(&path).unwrap(), original);
        assert!(manager.data().model_providers.is_empty());
        manager
            .transaction(|config| {
                config.system_prompt = Some("updated".into());
                Ok(())
            })
            .unwrap();
        assert_eq!(manager.data().batch_size, 7);
        assert!(
            fs::read_dir(dir.path())
                .unwrap()
                .filter_map(Result::ok)
                .any(|file| file
                    .file_name()
                    .to_string_lossy()
                    .contains("before-provider-models"))
        );
    }

    #[test]
    fn failed_transaction_keeps_memory_and_disk_unchanged() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("config.json");
        let manager = ConfigDraft::new(Some(path.clone())).unwrap();
        manager
            .transaction(|config| {
                config.batch_size = 4;
                Ok(())
            })
            .unwrap();
        let saved = fs::read(&path).unwrap();
        assert!(
            manager
                .transaction(|config| {
                    config.batch_size = 8;
                    Err(AppError::validation("rejected"))
                })
                .is_err()
        );
        assert_eq!(manager.data().batch_size, 4);
        assert_eq!(manager.data().config_version, 1);
        assert_eq!(fs::read(&path).unwrap(), saved);
    }
}
