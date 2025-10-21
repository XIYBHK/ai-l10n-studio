pub mod ai; // 🆕 AI 供应商架构模块
pub mod ai_translator;
pub mod batch_progress_channel; // Tauri 2.x: IPC Channel 优化
pub mod batch_translator;
pub mod config_draft; // Phase 9: Draft 模式配置管理
pub mod config_manager;
pub mod file_chunker; // Phase 8: 性能优化
pub mod file_format; // Phase 4
pub mod language_detector; // Phase 5
pub mod po_parser;
pub mod prompt_logger;
pub mod term_library;
pub mod translation_memory; // 提示词日志

// 重新导出核心模块 (精确导出，避免导出废弃类型)
pub use ai_translator::{ProxyConfig, AIConfig, TokenStats, AITranslator};
pub use batch_progress_channel::*; // Tauri 2.x: IPC Channel 优化
pub use batch_translator::*;
pub use config_draft::*; // Phase 9: Draft 模式配置管理
pub use config_manager::*;
pub use po_parser::*;
pub use prompt_logger::*;
pub use term_library::*;
pub use translation_memory::*; // 提示词日志

// AI 架构、文件格式、语言检测等模块（在命令中直接使用 crate::services::ai::* 等访问）
