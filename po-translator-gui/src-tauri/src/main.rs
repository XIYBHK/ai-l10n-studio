// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod services;
mod utils;

// use tauri::Manager;
use commands::*;

fn main() {
    // 初始化日志系统
    tracing_subscriber::fmt()
        .with_max_level(tracing::Level::DEBUG)
        .with_target(true)
        .with_thread_ids(true)
        .with_file(true)
        .with_line_number(true)
        .init();

    tracing::info!("🚀 PO Translator GUI starting...");

    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            parse_po_file,
            translate_entry,
            translate_batch,
            translate_batch_with_stats,
            get_translation_memory,
            get_builtin_phrases,
            save_translation_memory,
            get_config,
            open_file_dialog,
            save_file_dialog,
            save_po_file,
            translate_directory,
            get_app_config,
            update_app_config,
            get_provider_configs,
            validate_config,
            get_app_logs,
            clear_app_logs,
            // 术语库相关
            get_term_library,
            add_term_to_library,
            remove_term_from_library,
            generate_style_summary,
            should_update_style_summary
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
