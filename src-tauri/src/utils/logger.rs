use chrono::Local;
use lazy_static::lazy_static;
use std::sync::Mutex;
use tracing_subscriber::EnvFilter;

lazy_static! {
    static ref LOG_BUFFER: Mutex<Vec<String>> = Mutex::new(Vec::new());
}

pub fn init_tracing() {
    #[allow(clippy::expect_used)]
    let env_filter = EnvFilter::from_default_env()
        .add_directive(
            "po_translator_gui=info"
                .parse()
                .expect("invalid log filter"),
        )
        .add_directive("reqwest=warn".parse().expect("invalid log filter"))
        .add_directive("tokio=warn".parse().expect("invalid log filter"))
        .add_directive("runtime=warn".parse().expect("invalid log filter"));

    let subscriber = tracing_subscriber::fmt()
        .with_env_filter(env_filter)
        .with_timer(tracing_subscriber::fmt::time::UtcTime::rfc_3339())
        .with_target(true)
        .with_thread_ids(false)
        .with_file(false)
        .with_line_number(false)
        .finish();

    let _ = tracing::subscriber::set_global_default(subscriber);
    tracing::info!("🔍 Tracing 日志系统已初始化");
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
