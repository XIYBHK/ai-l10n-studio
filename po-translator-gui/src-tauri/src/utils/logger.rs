use std::sync::Mutex;
use lazy_static::lazy_static;
use chrono::Local;

lazy_static! {
    static ref LOG_BUFFER: Mutex<Vec<String>> = Mutex::new(Vec::new());
}

/// 添加日志到缓冲区
pub fn log(message: String) {
    let timestamp = Local::now().format("%Y-%m-%d %H:%M:%S");
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
    LOG_BUFFER.lock()
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
#[macro_export]
macro_rules! app_log {
    ($($arg:tt)*) => {
        $crate::utils::logger::log(format!($($arg)*))
    };
}

