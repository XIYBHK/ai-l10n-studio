// AI 供应商具体实现模块
//
// 注意：所有 AI 供应商已迁移到插件系统
// 此模块保留仅用于文档参考，实际使用时请查看 plugins/ 目录

// 已弃用：所有供应商已迁移到插件系统
// pub mod deepseek;
// pub mod minimax;
// pub mod openai;
// pub use deepseek::create_deepseek_provider;
// pub use minimax::create_minimax_provider;
// pub use openai::create_openai_provider;

/// 注册所有内置供应商
///
/// **已弃用**：所有 AI 供应商已迁移到插件系统
/// 请使用 `plugin_loader::load_all_plugins()` 加载插件供应商
///
/// 保留此函数仅为兼容性，实际不执行任何操作
#[deprecated(note = "所有供应商已迁移到插件系统，请使用 plugin_loader::load_all_plugins()")]
pub fn register_all_providers() -> anyhow::Result<()> {
    // 不再注册任何内置供应商
    Ok(())
}

#[cfg(test)]
mod tests {
    use crate::services::ai::plugin_loader::{init_global_plugin_loader, load_all_plugins};
    use crate::services::ai::provider::with_global_registry;
    use std::path::PathBuf;

    fn init_test_plugins() {
        let plugins_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .expect("workspace root")
            .join("plugins");

        init_global_plugin_loader(&plugins_dir).expect("初始化测试插件加载器失败");
        load_all_plugins().expect("加载测试插件失败");
    }

    #[test]
    fn test_register_all_providers() {
        init_test_plugins();

        with_global_registry(|registry| {
            // 验证插件供应商已注册
            assert!(registry.get_provider("deepseek").is_some());
            assert!(registry.get_provider("minimax").is_some());
            assert!(registry.get_provider("openai").is_some());

            let provider_count = registry.get_provider_ids().len();
            assert!(provider_count >= 3, "至少应该有3个插件供应商");
        });
    }
}
