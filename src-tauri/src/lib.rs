//! AI L10n Studio - Backend Library
//!
//! 本地化文件翻译工具的后端库，提供：
//! - PO 文件解析和生成
//! - AI 翻译引擎（支持多供应商）
//! - 翻译记忆库和术语库管理
//! - 配置管理和持久化

#[macro_use]
pub mod utils;

pub mod commands;
pub mod error;
pub mod services;
