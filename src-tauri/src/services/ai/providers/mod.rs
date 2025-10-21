// AI 供应商具体实现模块
// 
// 每个供应商都实现 AIProvider trait，实现插件化架构
// 添加新供应商时只需在此目录创建新文件即可

pub mod deepseek;
pub mod moonshot;
pub mod openai;

// 重新导出供应商创建函数
pub use deepseek::create_deepseek_provider;
pub use moonshot::create_moonshot_provider;
pub use openai::create_openai_provider;

use super::provider::with_global_registry_mut;
use anyhow::Result;

/// 注册所有内置供应商
/// 
/// 在应用启动时调用，自动注册所有可用的AI供应商
pub fn register_all_providers() -> Result<()> {
    with_global_registry_mut(|registry| {
        // 注册所有内置供应商
        registry.register(create_deepseek_provider())?;
        registry.register(create_moonshot_provider())?;
        registry.register(create_openai_provider())?;
        Ok(())
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::services::ai::provider::with_global_registry;

    #[test]
    fn test_register_all_providers() {
        // 注册所有供应商
        register_all_providers().unwrap();
        
        with_global_registry(|registry| {
            // 验证所有供应商都已注册
            assert!(registry.get_provider("deepseek").is_some());
            assert!(registry.get_provider("moonshot").is_some());
            assert!(registry.get_provider("openai").is_some());
            
            // 验证供应商数量
            assert_eq!(registry.get_provider_ids().len(), 3);
        });
    }
}
