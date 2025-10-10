pub mod translator;
pub mod ai_config;
pub mod ai_model_commands;  // 🆕 AI 模型查询命令
pub mod file_format;  // Phase 4
pub mod language;  // Phase 5
pub mod system;  // Phase 6
pub mod prompt_log;  // 提示词日志
pub mod config_sync;  // 配置同步

pub use translator::*;
pub use ai_config::*;
pub use ai_model_commands::*;  // 🆕 AI 模型查询命令
pub use file_format::*;  // Phase 4
pub use language::*;  // Phase 5
pub use system::*;  // Phase 6
pub use prompt_log::*;  // 提示词日志
pub use config_sync::*;  // 配置同步
