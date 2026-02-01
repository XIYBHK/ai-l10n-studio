// ============================================================================
// 模块声明
// ============================================================================

// 核心服务模块
pub mod ai_translator;
pub mod batch_translator;
pub mod config_draft;
pub mod config_manager;
pub mod po_parser;
pub mod translation_stats;
pub mod translation_task;

// AI 和翻译相关
pub mod ai;
pub mod language_detector;
pub mod prompt_builder;
pub mod translation_memory;

// 文件和数据处理
pub mod batch_progress_channel;
pub mod file_chunker;
pub mod file_format;
pub mod prompt_logger;
pub mod term_library;

// ============================================================================
// 公共 API 重新导出
// ============================================================================

// 核心类型
pub use ai_translator::{AIConfig, AITranslator, ProxyConfig};
pub use config_draft::ConfigDraft;
pub use config_manager::{AppConfig, ConfigManager, ConfigVersionInfo};
pub use translation_stats::TokenStats;

// 批量翻译
pub use batch_progress_channel::{BatchProgressEvent, BatchStatsEvent, TokenStatsEvent};
pub use batch_translator::{BatchTranslator, TranslationReport};

// PO 解析（POEntry 在 commands 模块定义）
pub use po_parser::POParser;

// 翻译记忆和术语
pub use prompt_logger::{
    clear_prompt_logs, format_prompt_logs, get_prompt_logs, init_prompt_logger, log_prompt,
    update_prompt_response,
};
pub use term_library::TermLibrary;
pub use translation_memory::TranslationMemory;
