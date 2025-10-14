use chrono::Local;
use lazy_static::lazy_static;
use std::sync::Mutex;

lazy_static! {
    static ref LOG_BUFFER: Mutex<Vec<String>> = Mutex::new(Vec::new());
}

/// 添加日志到缓冲区
pub fn log(message: String) {
    let timestamp = Local::now().format("%H:%M:%S");
    let log_entry = format!("[{}] {}", timestamp, message);

    // 打印到控制台（保持原有行为）
    println!("{}", message);

    // 保存到缓冲区
    if let Ok(mut buffer) = LOG_BUFFER.lock() {
        buffer.push(log_entry);

        // 限制缓冲区大小为1000条
        if buffer.len() > 1000 {
            buffer.remove(0);
        }
    }
}

/// 获取所有日志
pub fn get_logs() -> Vec<String> {
    LOG_BUFFER
        .lock()
        .map(|buffer| buffer.clone())
        .unwrap_or_default()
}

/// 清空日志
pub fn clear_logs() {
    if let Ok(mut buffer) = LOG_BUFFER.lock() {
        buffer.clear();
    }
}

/// 宏：简化日志调用
/// 🔄 修改为使用标准日志系统，确保日志写入文件
#[macro_export]
macro_rules! app_log {
    ($($arg:tt)*) => {
        log::info!(target: "app", "{}", format!($($arg)*));
        // 🔄 同时保存到内存缓冲区以保持兼容性
        $crate::utils::logger::log(format!($($arg)*))
    };
}
