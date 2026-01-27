use chrono::Local;
use lazy_static::lazy_static;
use std::sync::Mutex;

lazy_static! {
    static ref LOG_BUFFER: Mutex<Vec<String>> = Mutex::new(Vec::new());
}

pub fn log(message: String) {
    let timestamp = Local::now().format("%H:%M:%S");
    let log_entry = format!("[{}] {}", timestamp, message);

    if let Ok(mut buffer) = LOG_BUFFER.lock() {
        buffer.push(log_entry);

        if buffer.len() > 1000 {
            buffer.remove(0);
        }
    }
}

pub fn get_logs() -> Vec<String> {
    LOG_BUFFER
        .lock()
        .map(|buffer| buffer.clone())
        .unwrap_or_default()
}

pub fn clear_logs() {
    if let Ok(mut buffer) = LOG_BUFFER.lock() {
        buffer.clear();
    }
}

#[macro_export]
macro_rules! app_log {
    ($($arg:tt)*) => {
        log::info!(target: "app", "{}", format!($($arg)*));
        $crate::utils::logger::log(format!($($arg)*))
    };
}
