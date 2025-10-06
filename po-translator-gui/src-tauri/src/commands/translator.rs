use serde::{Deserialize, Serialize};
// use std::collections::HashMap;
// use std::sync::Mutex;
// use tauri::State;

use crate::services::{POParser, TranslationMemory, AITranslator, BatchTranslator, ConfigManager, TranslationReport};

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

// Tauri 命令
#[tauri::command]
pub async fn parse_po_file(file_path: String) -> Result<Vec<POEntry>, String> {
    let parser = POParser::new().map_err(|e| e.to_string())?;
    parser.parse_file(file_path).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn translate_entry(
    text: String,
    api_key: String,
) -> Result<String, String> {
    let mut translator = AITranslator::new(api_key, None, true).map_err(|e| e.to_string())?;
    let result = translator.translate_batch(vec![text], None).await.map_err(|e| e.to_string())?;
    
    // 保存TM到文件
    if let Some(tm) = translator.get_translation_memory() {
        let tm_path = "../data/translation_memory.json";
        if let Some(parent) = std::path::Path::new(tm_path).parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        let _ = tm.save_to_file(tm_path);
    }
    
    result.into_iter().next().ok_or_else(|| "No translation result".to_string())
}

#[derive(Debug, Serialize)]
pub struct BatchResult {
    pub translations: Vec<String>,
    pub stats: TranslationStats,
}

#[tauri::command]
pub async fn translate_batch(
    texts: Vec<String>,
    api_key: String,
) -> Result<Vec<String>, String> {
    let mut translator = AITranslator::new(api_key, None, true).map_err(|e| e.to_string())?;
    let result = translator.translate_batch(texts, None).await.map_err(|e| e.to_string())?;
    
    // 保存TM到文件
    if let Some(tm) = translator.get_translation_memory() {
        let tm_path = "../data/translation_memory.json";
        if let Some(parent) = std::path::Path::new(tm_path).parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        let _ = tm.save_to_file(tm_path);
    }
    
    Ok(result)
}

#[tauri::command]
pub async fn translate_batch_with_stats(
    texts: Vec<String>,
    api_key: String,
) -> Result<BatchResult, String> {
    let mut translator = AITranslator::new(api_key, None, true).map_err(|e| e.to_string())?;
    let translations = translator.translate_batch(texts, None).await.map_err(|e| e.to_string())?;
    
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
    if let Some(tm) = translator.get_translation_memory() {
        let tm_path = "../data/translation_memory.json";
        if let Some(parent) = std::path::Path::new(tm_path).parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        let _ = tm.save_to_file(tm_path);
    }
    
    Ok(BatchResult {
        translations,
        stats,
    })
}

#[tauri::command]
pub async fn get_translation_memory() -> Result<TranslationMemory, String> {
    let memory_path = "../data/translation_memory.json";
    
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
pub async fn save_translation_memory(
    memory: TranslationMemory,
) -> Result<(), String> {
    let memory_path = "../data/translation_memory.json";
    
    // 确保 data 目录存在
    if let Some(parent) = std::path::Path::new(memory_path).parent() {
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
    use tauri::api::dialog::FileDialogBuilder;
    use std::sync::mpsc;
    
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
    use tauri::api::dialog::FileDialogBuilder;
    use std::sync::mpsc;
    
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
    parser.write_file(file_path, &entries).map_err(|e| e.to_string())
}

// 批量翻译命令
#[tauri::command]
pub async fn translate_directory(
    directory_path: String,
    api_key: String,
    base_url: Option<String>,
) -> Result<Vec<TranslationReport>, String> {
    let mut batch_translator = BatchTranslator::new(api_key, base_url).map_err(|e| e.to_string())?;
    batch_translator.translate_directory(directory_path, None).await.map_err(|e| e.to_string())
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
    let app_config: crate::services::AppConfig = serde_json::from_value(config).map_err(|e| e.to_string())?;
    config_manager.update_config(|c| *c = app_config).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_provider_configs() -> Result<Vec<serde_json::Value>, String> {
    let providers = ConfigManager::get_provider_configs();
    let result: Result<Vec<_>, _> = providers.into_iter()
        .map(|p| serde_json::to_value(p))
        .collect();
    result.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn validate_config(config: serde_json::Value) -> Result<bool, String> {
    let app_config: crate::services::AppConfig = serde_json::from_value(config).map_err(|e| e.to_string())?;
    // 创建一个临时的ConfigManager来验证配置
    let mut config_manager = ConfigManager::new(None).map_err(|e| e.to_string())?;
    config_manager.update_config(|c| *c = app_config).map_err(|e| e.to_string())?;
    config_manager.validate_config().map_err(|e| e.to_string())?;
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