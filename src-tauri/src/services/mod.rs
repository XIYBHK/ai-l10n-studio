pub mod ai;  // 🆕 AI 供应商架构模块
pub mod ai_translator;
pub mod batch_translator;
pub mod batch_progress_channel;  // Tauri 2.x: IPC Channel 优化
pub mod config_manager;
pub mod po_parser;
pub mod translation_memory;
pub mod term_library;
pub mod file_format;  // Phase 4
pub mod language_detector;  // Phase 5
pub mod file_chunker;  // Phase 8: 性能优化
pub mod prompt_logger;  // 提示词日志

// 重新导出核心模块
pub use ai_translator::*;
pub use batch_translator::*;
pub use batch_progress_channel::*;  // Tauri 2.x: IPC Channel 优化
pub use config_manager::*;
pub use po_parser::*;
pub use translation_memory::*;
pub use term_library::*;
pub use prompt_logger::*;  // 提示词日志

// AI 架构、文件格式、语言检测等模块（在命令中直接使用 crate::services::ai::* 等访问）
