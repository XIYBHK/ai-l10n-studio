// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod services;
mod utils;

// use tauri::Manager;
use commands::*;

fn main() {
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
                clear_app_logs
            ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
