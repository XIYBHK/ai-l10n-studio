use flexi_logger::writers::FileLogWriter;
use flexi_logger::{DeferredNow, filter::LogLineFilter};
use log::Record;
use std::{fmt, sync::Arc};
use tokio::sync::Mutex;

pub type SharedWriter = Arc<Mutex<FileLogWriter>>;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Type {
    App,
    Translator,
    Parser,
    Config,
    TM,
    TermLibrary,
    FileFormat,
    Batch,
    Frontend,
    FileOps,
    Init,
    I18n,
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

#[macro_export]
macro_rules! error {
    ($result: expr) => {
        log::error!(target: "app", "{}", $result);
    };
}

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

#[macro_export]
macro_rules! trace_err {
    ($result: expr, $err_str: expr) => {
        if let Err(err) = $result {
            log::trace!(target: "app", "{}, err {}", $err_str, err);
        }
    }
}

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

#[macro_export]
macro_rules! logging {
    ($level:ident, $type:expr, $($arg:tt)*) => {
        log::$level!(target: "app", "{} {}", $type, format_args!($($arg)*));
    };
}

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

pub struct NoModuleFilter<'a>(pub &'a [&'a str]);

impl<'a> NoModuleFilter<'a> {
    #[inline]
    pub fn filter(&self, record: &log::Record) -> bool {
        if let Some(module) = record.module_path() {
            for blocked in self.0 {
                if module.len() >= blocked.len()
                    && module.as_bytes()[..blocked.len()] == blocked.as_bytes()[..]
                {
                    return false;
                }
            }
        }

        let msg = format!("{}", record.args());
        if msg.contains("NewEvents emitted without explicit RedrawEventsCleared")
            || msg.contains("RedrawEventsCleared emitted without explicit MainEventsCleared")
        {
            return false;
        }

        true
    }
}

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
