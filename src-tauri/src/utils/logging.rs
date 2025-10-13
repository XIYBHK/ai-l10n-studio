use flexi_logger::writers::FileLogWriter;
#[cfg(not(debug_assertions))]
use flexi_logger::{DeferredNow, filter::LogLineFilter};
#[cfg(not(debug_assertions))]
use log::Record;
use std::{fmt, sync::Arc};
use tokio::sync::Mutex;

pub type SharedWriter = Arc<Mutex<FileLogWriter>>;

/// 日志模块类型（对应项目主要模块）
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Type {
    App,         // 应用主程序
    Translator,  // AI翻译引擎
    Parser,      // PO文件解析器
    Config,      // 配置管理
    TM,          // 翻译记忆库 (Translation Memory)
    TermLibrary, // 术语库
    FileFormat,  // 文件格式检测
    Batch,       // 批量翻译
    Frontend,    // 前端日志
    FileOps,     // 文件操作
    Init,        // 初始化
    I18n,        // 国际化
}

impl fmt::Display for Type {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Type::App => write!(f, "[App]"),
            Type::Translator => write!(f, "[Translator]"),
            Type::Parser => write!(f, "[Parser]"),
            Type::Config => write!(f, "[Config]"),
            Type::TM => write!(f, "[TM]"),
            Type::TermLibrary => write!(f, "[TermLib]"),
            Type::FileFormat => write!(f, "[FileFormat]"),
            Type::Batch => write!(f, "[Batch]"),
            Type::Frontend => write!(f, "[Frontend]"),
            Type::FileOps => write!(f, "[FileOps]"),
            Type::Init => write!(f, "[Init]"),
            Type::I18n => write!(f, "[I18n]"),
        }
    }
}

/// 简单错误日志（记录错误信息）
/// 用法：`error!("Failed to load config")`
#[macro_export]
macro_rules! error {
    ($result: expr) => {
        log::error!(target: "app", "{}", $result);
    };
}

/// 记录 Result<T, E> 的错误（如果是 Err）
/// 用法：`log_err!(some_result)` 或 `log_err!(some_result, "Custom error message")`
#[macro_export]
macro_rules! log_err {
    ($result: expr) => {
        if let Err(err) = $result {
            log::error!(target: "app", "{err}");
        }
    };

    ($result: expr, $err_str: expr) => {
        if let Err(_) = $result {
            log::error!(target: "app", "{}", $err_str);
        }
    };
}

/// trace 级别的错误日志
/// 用法：`trace_err!(some_result, "Custom trace message")`
#[macro_export]
macro_rules! trace_err {
    ($result: expr, $err_str: expr) => {
        if let Err(err) = $result {
            log::trace!(target: "app", "{}, err {}", $err_str, err);
        }
    }
}

/// 包装 Result<T, E>，记录错误并转换为 String
/// 用法：
/// - `wrap_err!(some_result)` - 同步 Result
/// - `wrap_err!(some_async_result, async)` - 异步 Future<Result>
#[macro_export]
macro_rules! wrap_err {
    // Case 1: Future<Result<T, E>>
    ($stat:expr, async) => {{
        match $stat.await {
            Ok(a) => Ok(a),
            Err(err) => {
                log::error!(target: "app", "{}", err);
                Err(err.to_string())
            }
        }
    }};

    // Case 2: Result<T, E>
    ($stat:expr) => {{
        match $stat {
            Ok(a) => Ok(a),
            Err(err) => {
                log::error!(target: "app", "{}", err);
                Err(err.to_string())
            }
        }
    }};
}

/// 带模块类型的结构化日志
/// 用法：`logging!(info, Type::Translator, "Translation completed: {}", count)`
#[macro_export]
macro_rules! logging {
    ($level:ident, $type:expr, $($arg:tt)*) => {
        log::$level!(target: "app", "{} {}", $type, format_args!($($arg)*));
    };
}

/// 带模块类型的错误日志
/// 用法：
/// - `logging_error!(Type::Config, some_result)` - 记录 Result 错误
/// - `logging_error!(Type::Config, "Error message: {}", detail)` - 格式化消息
#[macro_export]
macro_rules! logging_error {
    // Handle Result<T, E>
    ($type:expr, $expr:expr) => {
        if let Err(err) = $expr {
            log::error!(target: "app", "{} {}", $type, err);
        }
    };

    // Handle formatted message
    ($type:expr, $fmt:literal $(, $arg:expr)*) => {
        log::error!(target: "app", "{} {}", $type, format_args!($fmt $(, $arg)*));
    };
}

/// 模块过滤器（用于 flexi_logger，生产环境屏蔽噪音日志）
#[cfg(not(debug_assertions))]
pub struct NoModuleFilter<'a>(pub &'a [&'a str]);

#[cfg(not(debug_assertions))]
impl<'a> NoModuleFilter<'a> {
    #[inline]
    pub fn filter(&self, record: &Record) -> bool {
        if let Some(module) = record.module_path() {
            for blocked in self.0 {
                if module.len() >= blocked.len()
                    && module.as_bytes()[..blocked.len()] == blocked.as_bytes()[..]
                {
                    return false;
                }
            }
        }
        true
    }
}

#[cfg(not(debug_assertions))]
impl<'a> LogLineFilter for NoModuleFilter<'a> {
    fn write(
        &self,
        now: &mut DeferredNow,
        record: &Record,
        writer: &dyn flexi_logger::filter::LogLineWriter,
    ) -> std::io::Result<()> {
        if !self.filter(record) {
            return Ok(());
        }
        writer.write(now, record)
    }
}

// ========== 测试 ==========

#[cfg(test)]
#[allow(clippy::unwrap_used)]
mod tests {
    use super::*;

    #[test]
    fn test_type_display() {
        assert_eq!(Type::App.to_string(), "[App]");
        assert_eq!(Type::Translator.to_string(), "[Translator]");
        assert_eq!(Type::Parser.to_string(), "[Parser]");
        assert_eq!(Type::Config.to_string(), "[Config]");
        assert_eq!(Type::TM.to_string(), "[TM]");
    }

    #[test]
    fn test_module_filter() {
        // 只在非 debug 模式测试
        #[cfg(not(debug_assertions))]
        {
            let filter = NoModuleFilter(&["tokio", "hyper"]);
            // 实际测试需要构造 log::Record，这里仅测试创建
            assert_eq!(filter.0.len(), 2);
        }
    }
}
