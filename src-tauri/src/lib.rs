//! AI L10n Studio - Backend Library
//!
//! 本地化文件翻译工具的后端库，提供：
//! - PO 文件解析和生成
//! - AI 翻译引擎（支持多供应商）
//! - 翻译记忆库和术语库管理
//! - 配置管理和持久化

#[macro_use]
pub mod utils;

pub mod commands;
pub mod error;
pub mod services;

use commands::*;
use tauri::Manager;

/// Start the desktop app using the same backend modules as the library and tests.
#[allow(clippy::expect_used)]
pub fn run() {
    // 初始化性能监控 (仅当启用 console feature 时)
    #[cfg(feature = "console")]
    {
        console_subscriber::init();
        ::log::info!("Tokio console 监控已启用");
    }

    tauri::Builder::default()
        .setup(|app| {
            let resource_dir = app.path().resource_dir()?;
            tauri::async_runtime::block_on(utils::init::init_app(Some(&resource_dir)))?;
            Ok(())
        })
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_store::Builder::new().build()) // Tauri 2.x: Store Plugin
        .plugin(tauri_plugin_notification::init()) // Tauri 2.x: Notification Plugin
        .invoke_handler(tauri::generate_handler![
            parse_po_file,
            translate_batch_with_channel, // Tauri 2.x: Channel API (统一翻译入口)
            get_translation_memory,
            get_builtin_phrases,
            merge_builtin_phrases,
            save_translation_memory,
            confirm_translations,
            open_file_dialog,
            save_file_dialog,
            save_po_file,
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
            get_model_configuration,
            save_model_provider,
            remove_model_provider,
            set_default_model,
            test_model_provider,
            discover_provider_models,
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
