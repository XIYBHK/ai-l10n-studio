use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use super::ModelInfo;

#[cfg(feature = "ts-rs")]
use ts_rs::TS;

/// AI 供应商抽象接口
/// 
/// 所有 AI 供应商都必须实现此 trait，实现插件化架构
/// 添加新供应商时只需实现此 trait，无需修改现有代码
pub trait AIProvider: Send + Sync {
    /// 供应商唯一标识符 (小写，用于内部识别)
    fn id(&self) -> &'static str;
    
    /// 供应商显示名称 (用于UI显示)
    fn display_name(&self) -> &'static str;
    
    /// 默认API基础URL
    fn default_url(&self) -> &'static str;
    
    /// 默认模型ID
    fn default_model(&self) -> &'static str;
    
    /// 获取该供应商支持的所有模型
    fn get_models(&self) -> Vec<ModelInfo>;
    
    /// 根据模型ID获取模型信息
    fn get_model_info(&self, model_id: &str) -> Option<ModelInfo> {
        self.get_models().into_iter().find(|m| m.id == model_id)
    }
    
    /// 供应商是否支持该模型
    fn supports_model(&self, model_id: &str) -> bool {
        self.get_model_info(model_id).is_some()
    }
    
    /// 获取供应商元信息
    fn get_provider_info(&self) -> ProviderInfo {
        ProviderInfo {
            id: self.id().to_string(),
            display_name: self.display_name().to_string(),
            default_url: self.default_url().to_string(),
            default_model: self.default_model().to_string(),
        }
    }
}

/// 供应商信息结构
#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "ts-rs", derive(TS))]
#[cfg_attr(feature = "ts-rs", ts(export, export_to = "../src/types/generated/"))]
pub struct ProviderInfo {
    pub id: String,
    pub display_name: String,
    pub default_url: String,
    pub default_model: String,
}

/// 供应商注册表
/// 
/// 管理所有已注册的 AI 供应商，提供动态查询和注册功能
pub struct ProviderRegistry {
    providers: HashMap<String, Box<dyn AIProvider>>,
}

impl ProviderRegistry {
    /// 创建新的供应商注册表
    pub fn new() -> Self {
        Self {
            providers: HashMap::new(),
        }
    }
    
    /// 注册新的供应商
    pub fn register<T: AIProvider + 'static>(&mut self, provider: T) -> Result<()> {
        let id = provider.id().to_string();
        
        if self.providers.contains_key(&id) {
            return Err(anyhow::anyhow!("Provider '{}' already registered", id));
        }
        
        self.providers.insert(id, Box::new(provider));
        Ok(())
    }
    
    /// 获取指定供应商
    pub fn get_provider(&self, id: &str) -> Option<&dyn AIProvider> {
        self.providers.get(id).map(|p| p.as_ref())
    }
    
    /// 获取所有供应商ID
    pub fn get_provider_ids(&self) -> Vec<String> {
        self.providers.keys().cloned().collect()
    }
    
    /// 获取所有供应商信息
    pub fn get_all_providers(&self) -> Vec<ProviderInfo> {
        self.providers
            .values()
            .map(|p| p.get_provider_info())
            .collect()
    }
    
    /// 获取指定供应商的信息
    pub fn get_provider_info(&self, id: &str) -> Option<ProviderInfo> {
        self.get_provider(id).map(|p| p.get_provider_info())
    }
    
    /// 根据模型ID查找支持该模型的供应商
    pub fn find_provider_for_model(&self, model_id: &str) -> Option<&dyn AIProvider> {
        self.providers
            .values()
            .find(|p| p.supports_model(model_id))
            .map(|p| p.as_ref())
    }
    
    /// 获取所有可用模型（来自所有供应商）
    pub fn get_all_models(&self) -> Vec<ModelInfo> {
        self.providers
            .values()
            .flat_map(|p| p.get_models())
            .collect()
    }
}

impl Default for ProviderRegistry {
    fn default() -> Self {
        Self::new()
    }
}

use std::sync::{OnceLock, RwLock};

/// 全局供应商注册表实例（线程安全）
static GLOBAL_REGISTRY: OnceLock<RwLock<ProviderRegistry>> = OnceLock::new();

/// 初始化全局注册表
fn init_global_registry() -> &'static RwLock<ProviderRegistry> {
    GLOBAL_REGISTRY.get_or_init(|| RwLock::new(ProviderRegistry::new()))
}

/// 获取全局供应商注册表（只读访问）
pub fn with_global_registry<T, F>(f: F) -> T 
where 
    F: FnOnce(&ProviderRegistry) -> T,
{
    let registry = init_global_registry();
    let guard = registry.read().unwrap();
    f(&*guard)
}

/// 获取可变的全局供应商注册表（用于注册）
pub fn with_global_registry_mut<T, F>(f: F) -> T
where 
    F: FnOnce(&mut ProviderRegistry) -> T,
{
    let registry = init_global_registry();
    let mut guard = registry.write().unwrap();
    f(&mut *guard)
}

/// 便捷宏：注册供应商
#[macro_export]
macro_rules! register_provider {
    ($provider:expr) => {
        {
            use $crate::services::ai::provider::with_global_registry_mut;
            with_global_registry_mut(|registry| registry.register($provider))
        }
    };
}

#[cfg(test)]
mod tests {
    use super::*;

    // 测试用的模拟供应商
    struct MockProvider {
        id: &'static str,
        display_name: &'static str,
    }

    impl AIProvider for MockProvider {
        fn id(&self) -> &'static str { self.id }
        fn display_name(&self) -> &'static str { self.display_name }
        fn default_url(&self) -> &'static str { "https://api.mock.com/v1" }
        fn default_model(&self) -> &'static str { "mock-model" }
        fn get_models(&self) -> Vec<ModelInfo> {
            vec![ModelInfo {
                id: "mock-model".to_string(),
                name: "Mock Model".to_string(),
                provider: self.display_name.to_string(),
                context_window: 4096,
                max_output_tokens: 2048,
                input_price: 0.01,
                output_price: 0.02,
                cache_reads_price: Some(0.001),
                cache_writes_price: Some(0.015),
                supports_cache: true,
                supports_images: false,
                description: Some("Test model".to_string()),
                recommended: false,
            }]
        }
    }

    #[test]
    fn test_provider_registry() {
        let mut registry = ProviderRegistry::new();
        
        let provider = MockProvider { 
            id: "test", 
            display_name: "Test Provider"
        };
        
        // 注册供应商
        registry.register(provider).unwrap();
        
        // 验证注册
        assert!(registry.get_provider("test").is_some());
        assert_eq!(registry.get_provider_ids(), vec!["test"]);
        
        // 验证模型查找
        assert!(registry.find_provider_for_model("mock-model").is_some());
        assert!(registry.find_provider_for_model("non-existent").is_none());
    }

    #[test]
    fn test_duplicate_registration() {
        let mut registry = ProviderRegistry::new();
        
        let provider1 = MockProvider { id: "test", display_name: "Test 1" };
        let provider2 = MockProvider { id: "test", display_name: "Test 2" };
        
        // 第一次注册应该成功
        assert!(registry.register(provider1).is_ok());
        
        // 重复注册应该失败
        assert!(registry.register(provider2).is_err());
    }
}
