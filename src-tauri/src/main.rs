//! AI L10n Studio - Tauri Application
//!
//! 基于 Tauri 2.x 的桌面应用，提供 AI 驱动的 PO 文件翻译功能。

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
#![allow(clippy::expect_used)]

mod commands;
mod error;
mod services;
mod utils;

use commands::*;

fn main() {
    // 初始化性能监控 (仅当启用 console feature 时)
    #[cfg(feature = "console")]
    {
        console_subscriber::init();
        log::info!("Tokio console 监控已启用");
    }

    let runtime = tokio::runtime::Runtime::new().expect("Failed to create tokio runtime");
    if let Err(e) = runtime.block_on(utils::init::init_app()) {
        eprintln!("Failed to initialize application: {}", e);
        std::process::exit(1);
    }

    log::info!("PO Translator GUI starting...");

    services::init_prompt_logger();

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_store::Builder::new().build()) // Tauri 2.x: Store Plugin
        .plugin(tauri_plugin_notification::init()) // Tauri 2.x: Notification Plugin
        // .plugin(tauri_plugin_updater::Builder::new().build())  // Tauri 2.x: Updater Plugin (开发阶段暂时禁用，生产环境时启用)
        .invoke_handler(tauri::generate_handler![
            parse_po_file,
            translate_entry,
            translate_batch_with_channel, // Tauri 2.x: Channel API (统一翻译入口)
            get_translation_memory,
            get_builtin_phrases,
            merge_builtin_phrases,
            save_translation_memory,
            open_file_dialog,
            save_file_dialog,
            save_po_file,
            translate_directory,
            get_app_config,
            update_app_config,
            validate_config,
            get_app_logs,
            clear_app_logs,
            get_frontend_logs, // 前端日志查看命令
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
            // 系统相关命令
            get_log_directory_path,
            open_log_directory,
            get_native_system_theme,
            // Phase 9: 后端国际化增强
            utils::i18n::get_system_locale,
            utils::i18n::get_available_languages,
            // Contextual Refine (Phase 7)
            contextual_refine,
            // 提示词日志
            get_prompt_logs,
            clear_prompt_logs,
            get_config_version,
            // AI 模型查询命令
            get_provider_models,
            get_model_info,
            estimate_translation_cost,
            calculate_precise_cost,
            // 动态 AI 供应商 API (Phase 1 重构)
            get_all_providers,
            get_all_models,
            find_provider_for_model,
            // 翻译任务取消
            cancel_translation,
            cancel_all_translations,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
