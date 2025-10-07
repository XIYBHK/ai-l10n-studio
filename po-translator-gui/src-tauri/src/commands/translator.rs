use serde::{Deserialize, Serialize};
use tauri::Manager;
// use std::collections::HashMap;
// use std::sync::Mutex;
// use tauri::State;

use crate::services::{
    AITranslator, BatchTranslator, ConfigManager, POParser, TermLibrary, TranslationMemory, TranslationReport,
};
use crate::utils::paths::get_translation_memory_path;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct POEntry {
    pub comments: Vec<String>,
    pub msgctxt: String,
    pub msgid: String,
    pub msgstr: String,
    pub line_start: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranslationStats {
    pub total: usize,
    pub tm_hits: usize,
    pub deduplicated: usize,
    pub ai_translated: usize,
    pub token_stats: crate::services::TokenStats,
    pub tm_learned: usize,
}

// TranslationReport 已从 services 模块导入

#[derive(Debug, Serialize, Deserialize)]
pub struct TranslationPair {
    pub original: String,
    pub translation: String,
}

// TokenStats 已从 services 模块导入

// TranslationMemory 结构体已移至 services/translation_memory.rs

// 🔧 辅助函数：自动保存翻译记忆库（内部使用）
fn auto_save_translation_memory(translator: &AITranslator) {
    if let Some(tm) = translator.get_translation_memory() {
        let tm_path = get_translation_memory_path().to_string_lossy().to_string();
        if let Some(parent) = std::path::Path::new(&tm_path).parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        let _ = tm.save_to_file(tm_path);
    }
}

// 🔧 辅助函数：保存术语库
fn save_term_library(library: &TermLibrary, path: &std::path::PathBuf) -> Result<(), String> {
    library.save_to_file(path).map_err(|e| e.to_string())
}

// Tauri 命令
#[tauri::command]
pub async fn parse_po_file(file_path: String) -> Result<Vec<POEntry>, String> {
    let parser = POParser::new().map_err(|e| e.to_string())?;
    parser.parse_file(file_path).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn translate_entry(text: String, api_key: String) -> Result<String, String> {
    let mut translator = AITranslator::new(api_key, None, true).map_err(|e| e.to_string())?;
    let result = translator
        .translate_batch(vec![text], None)
        .await
        .map_err(|e| e.to_string())?;

    // 保存TM到文件
    auto_save_translation_memory(&translator);

    result
        .into_iter()
        .next()
        .ok_or_else(|| "No translation result".to_string())
}

#[derive(Debug, Serialize)]
pub struct BatchResult {
    pub translations: Vec<String>,
    pub stats: TranslationStats,
}

#[tauri::command]
pub async fn translate_batch(texts: Vec<String>, api_key: String) -> Result<Vec<String>, String> {
    let mut translator = AITranslator::new(api_key, None, true).map_err(|e| e.to_string())?;
    let result = translator
        .translate_batch(texts, None)
        .await
        .map_err(|e| e.to_string())?;

    // 保存TM到文件
    auto_save_translation_memory(&translator);

    Ok(result)
}

#[tauri::command]
pub async fn translate_batch_with_stats(
    app_handle: tauri::AppHandle,
    texts: Vec<String>,
    api_key: String,
) -> Result<BatchResult, String> {
    let mut translator = AITranslator::new(api_key, None, true).map_err(|e| e.to_string())?;
    
    // 创建进度回调，实时推送翻译结果和统计信息
    let progress_callback: Option<Box<dyn Fn(usize, String) + Send + Sync>> = {
        let app = app_handle.clone();
        Some(Box::new(move |index: usize, translation: String| {
            // 向所有窗口广播翻译进度事件
            let payload = serde_json::json!({
                "index": index,
                "translation": translation
            });
            
            crate::app_log!("[进度推送] index={}, translation={}", index, &translation);
            let _ = app.emit_all("translation-progress", payload);
        }))
    };
    
    // 创建统计信息回调，实时推送统计更新
    let stats_callback: Option<Box<dyn Fn(crate::services::BatchStats, crate::services::TokenStats) + Send + Sync>> = {
        let app = app_handle.clone();
        Some(Box::new(move |batch_stats: crate::services::BatchStats, token_stats: crate::services::TokenStats| {
            // 向所有窗口广播统计更新事件
            let stats_payload = serde_json::json!({
                "total": batch_stats.total,
                "tm_hits": batch_stats.tm_hits,
                "deduplicated": batch_stats.deduplicated,
                "ai_translated": batch_stats.ai_translated,
                "tm_learned": batch_stats.tm_learned,
                "token_stats": {
                    "input_tokens": token_stats.input_tokens,
                    "output_tokens": token_stats.output_tokens,
                    "total_tokens": token_stats.total_tokens,
                    "cost": token_stats.cost
                }
            });
            
            let _ = app.emit_all("translation-stats-update", stats_payload);
        }))
    };
    
    let translations = translator
        .translate_batch_with_callbacks(texts, progress_callback, stats_callback)
        .await
        .map_err(|e| e.to_string())?;

    // 获取统计信息
    let batch_stats = translator.batch_stats.clone();
    let token_stats = translator.get_token_stats().clone();

    let stats = TranslationStats {
        total: batch_stats.total,
        tm_hits: batch_stats.tm_hits,
        deduplicated: batch_stats.deduplicated,
        ai_translated: batch_stats.ai_translated,
        token_stats,
        tm_learned: batch_stats.tm_learned,
    };

    // 保存TM到文件
    auto_save_translation_memory(&translator);

    Ok(BatchResult {
        translations,
        stats,
    })
}

#[tauri::command]
pub async fn get_translation_memory() -> Result<TranslationMemory, String> {
    let memory_path = get_translation_memory_path().to_string_lossy().to_string();

    // 使用 new_from_file 而不是 load_from_file，因为它能正确处理Python格式的JSON
    TranslationMemory::new_from_file(memory_path).map_err(|e| {
        println!("[TM] 加载记忆库失败: {}", e);
        format!("加载记忆库失败: {}", e)
    })
}

#[tauri::command]
pub async fn get_builtin_phrases() -> Result<serde_json::Value, String> {
    let builtin = crate::services::translation_memory::get_builtin_memory();
    let memory_map: std::collections::HashMap<String, String> = builtin.into_iter().collect();

    Ok(serde_json::json!({
        "memory": memory_map
    }))
}

#[tauri::command]
pub async fn save_translation_memory(memory: TranslationMemory) -> Result<(), String> {
    let memory_path = get_translation_memory_path().to_string_lossy().to_string();

    // 确保 data 目录存在
    if let Some(parent) = std::path::Path::new(&memory_path).parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    memory.save_to_file(memory_path).map_err(|e| e.to_string())
}

// 配置相关命令（简化版，完整配置使用 get_app_config）
#[tauri::command]
pub async fn get_config() -> Result<serde_json::Value, String> {
    // 返回默认配置，用于向后兼容
    Ok(serde_json::json!({
        "api_key": "",
        "provider": "openai",
        "model": "gpt-3.5-turbo"
    }))
}

// 文件操作命令
#[tauri::command]
pub async fn open_file_dialog() -> Result<Option<String>, String> {
    use std::sync::mpsc;
    use tauri::api::dialog::FileDialogBuilder;

    let (tx, rx) = mpsc::channel();

    FileDialogBuilder::new()
        .add_filter("PO Files", &["po"])
        .add_filter("All Files", &["*"])
        .pick_file(move |file_path| {
            let _ = tx.send(file_path);
        });

    match rx.recv() {
        Ok(Some(path)) => Ok(Some(path.to_string_lossy().to_string())),
        Ok(None) => Ok(None),
        Err(_) => Err("Dialog cancelled".to_string()),
    }
}

#[tauri::command]
pub async fn save_file_dialog() -> Result<Option<String>, String> {
    use std::sync::mpsc;
    use tauri::api::dialog::FileDialogBuilder;

    let (tx, rx) = mpsc::channel();

    FileDialogBuilder::new()
        .add_filter("PO Files", &["po"])
        .add_filter("All Files", &["*"])
        .save_file(move |file_path| {
            let _ = tx.send(file_path);
        });

    match rx.recv() {
        Ok(Some(path)) => Ok(Some(path.to_string_lossy().to_string())),
        Ok(None) => Ok(None),
        Err(_) => Err("Dialog cancelled".to_string()),
    }
}

#[tauri::command]
pub async fn save_po_file(file_path: String, entries: Vec<POEntry>) -> Result<(), String> {
    let parser = POParser::new().map_err(|e| e.to_string())?;
    parser
        .write_file(file_path, &entries)
        .map_err(|e| e.to_string())
}

// 批量翻译命令
#[tauri::command]
pub async fn translate_directory(
    directory_path: String,
    api_key: String,
    base_url: Option<String>,
) -> Result<Vec<TranslationReport>, String> {
    let mut batch_translator =
        BatchTranslator::new(api_key, base_url).map_err(|e| e.to_string())?;
    batch_translator
        .translate_directory(directory_path, None)
        .await
        .map_err(|e| e.to_string())
}

// 配置管理命令
#[tauri::command]
pub async fn get_app_config() -> Result<serde_json::Value, String> {
    let config_manager = ConfigManager::new(None).map_err(|e| e.to_string())?;
    let config = config_manager.get_config();
    serde_json::to_value(config).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_app_config(config: serde_json::Value) -> Result<(), String> {
    let mut config_manager = ConfigManager::new(None).map_err(|e| e.to_string())?;
    let app_config: crate::services::AppConfig =
        serde_json::from_value(config).map_err(|e| e.to_string())?;
    config_manager
        .update_config(|c| *c = app_config)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_provider_configs() -> Result<Vec<serde_json::Value>, String> {
    let providers = ConfigManager::get_provider_configs();
    let result: Result<Vec<_>, _> = providers
        .into_iter()
        .map(|p| serde_json::to_value(p))
        .collect();
    result.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn validate_config(config: serde_json::Value) -> Result<bool, String> {
    let app_config: crate::services::AppConfig =
        serde_json::from_value(config).map_err(|e| e.to_string())?;
    // 创建一个临时的ConfigManager来验证配置
    let mut config_manager = ConfigManager::new(None).map_err(|e| e.to_string())?;
    config_manager
        .update_config(|c| *c = app_config)
        .map_err(|e| e.to_string())?;
    config_manager
        .validate_config()
        .map_err(|e| e.to_string())?;
    Ok(true)
}

// 日志相关命令
#[tauri::command]
pub async fn get_app_logs() -> Result<Vec<String>, String> {
    Ok(crate::utils::logger::get_logs())
}

#[tauri::command]
pub async fn clear_app_logs() -> Result<(), String> {
    crate::utils::logger::clear_logs();
    Ok(())
}

// ==================== 术语库相关命令 ====================

/// 获取术语库路径
fn get_term_library_path() -> std::path::PathBuf {
    let data_dir = std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|p| p.to_path_buf()))
        .unwrap_or_else(|| std::path::PathBuf::from("."));
    
    data_dir.join("data").join("term_library.json")
}

/// 获取术语库
#[tauri::command]
pub async fn get_term_library() -> Result<TermLibrary, String> {
    let path = get_term_library_path();
    TermLibrary::load_from_file(path).map_err(|e| e.to_string())
}

/// 添加术语到术语库
#[tauri::command]
pub async fn add_term_to_library(
    source: String,
    user_translation: String,
    ai_translation: String,
    context: Option<String>,
) -> Result<(), String> {
    let path = get_term_library_path();
    let mut library = TermLibrary::load_from_file(&path).map_err(|e| e.to_string())?;
    
    library
        .add_term(source, user_translation, ai_translation, context)
        .map_err(|e| e.to_string())?;
    
    save_term_library(&library, &path)?;
    
    Ok(())
}

/// 从术语库删除术语
#[tauri::command]
pub async fn remove_term_from_library(source: String) -> Result<(), String> {
    let path = get_term_library_path();
    let mut library = TermLibrary::load_from_file(&path).map_err(|e| e.to_string())?;
    
    library.remove_term(&source).map_err(|e| e.to_string())?;
    
    save_term_library(&library, &path)?;
    
    Ok(())
}

/// 生成风格总结（调用AI）
#[tauri::command]
pub async fn generate_style_summary(api_key: String) -> Result<String, String> {
    let path = get_term_library_path();
    let mut library = TermLibrary::load_from_file(&path).map_err(|e| e.to_string())?;
    
    if library.terms.is_empty() {
        crate::app_log!("[风格总结] 术语库为空，无法生成");
        return Err("术语库为空，无法生成风格总结".to_string());
    }
    
    crate::app_log!("[风格总结] 开始生成，基于 {} 条术语", library.terms.len());
    
    // 构建分析提示
    let analysis_prompt = library.build_analysis_prompt();
    crate::app_log!("[风格总结] 提示词已构建，长度: {} 字符", analysis_prompt.len());
    crate::app_log!("[风格总结] 完整提示词内容:\n{}", analysis_prompt);
    
    // 调用AI生成总结
    let mut translator = AITranslator::new(api_key, None, false).map_err(|e| e.to_string())?;
    let summary = translator
        .translate_batch(vec![analysis_prompt], None)
        .await
        .map_err(|e| {
            crate::app_log!("[风格总结] AI调用失败: {}", e);
            e.to_string()
        })?
        .into_iter()
        .next()
        .ok_or_else(|| {
            crate::app_log!("[风格总结] AI返回为空");
            "生成风格总结失败".to_string()
        })?;
    
    crate::app_log!("[风格总结] AI生成成功，总结长度: {} 字符", summary.len());
    crate::app_log!("[风格总结] AI返回的完整内容:\n{}", summary);
    
    // 更新术语库
    library.update_style_summary(summary.clone());
    save_term_library(&library, &path)?;
    
    crate::app_log!("[风格总结] 风格总结已保存 (v{})", library.style_summary.as_ref().map(|s| s.version).unwrap_or(0));
    
    Ok(summary)
}

/// 检查是否需要更新风格总结
#[tauri::command]
pub async fn should_update_style_summary() -> Result<bool, String> {
    let path = get_term_library_path();
    let library = TermLibrary::load_from_file(&path).map_err(|e| e.to_string())?;
    Ok(library.should_update_style_summary())
}
