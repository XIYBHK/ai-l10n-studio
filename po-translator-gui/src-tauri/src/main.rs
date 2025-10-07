// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod services;
mod utils;

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
            should_update_style_summary,
            // AI 配置管理
            get_all_ai_configs,
            get_active_ai_config,
            add_ai_config,
            update_ai_config,
            remove_ai_config,
            set_active_ai_config,
            test_ai_connection,
            // 系统提示词管理 (Phase 3)
            get_system_prompt,
            update_system_prompt,
            reset_system_prompt,
            // 文件格式检测 (Phase 4)
            detect_file_format,
            get_file_metadata,
        // 语言检测 (Phase 5)
        detect_text_language,
        get_default_target_lang,
        get_supported_langs,
        // 系统语言检测 (Phase 6)
        get_system_language,
        // Contextual Refine (Phase 7)
        contextual_refine
    ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
