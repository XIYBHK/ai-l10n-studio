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
    use super::*;
    use crate::services::ai::provider::with_global_registry;

    #[test]
    fn test_register_all_providers() {
        // 测试中供应商可能已经注册过（其他测试或 init.rs），忽略重复注册错误
        let _ = register_all_providers();

        with_global_registry(|registry| {
            // 验证内置供应商已注册
            assert!(registry.get_provider("deepseek").is_some());
            assert!(registry.get_provider("minimax").is_some());
            assert!(registry.get_provider("openai").is_some());

            // 注意：moonshot 和 zhipuai 已迁移到插件系统
            // 如果有插件加载，应该会有更多供应商
            let provider_count = registry.get_provider_ids().len();
            assert!(provider_count >= 3, "至少应该有3个内置供应商");
        });
    }
}
