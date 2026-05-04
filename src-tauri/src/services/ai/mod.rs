// AI 供应商架构模块

pub mod cost_calculator;
pub mod model_info;
pub mod models;
pub mod provider;
pub mod providers;

// Phase 3: 插件化架构
pub mod plugin_config;
pub mod plugin_loader;

// 重新导出核心类型
pub use cost_calculator::{CostBreakdown, CostCalculator};
pub use model_info::ModelInfo;
pub use provider::ProviderInfo; // 只导出对外公开的类型

// 不再导出 register_all_providers（仅在 init.rs 中使用）
// pub use providers::register_all_providers;
