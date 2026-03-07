use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::Emitter;

use crate::services::{
    AITranslator, BatchTranslator, ConfigDraft, POParser, TermLibrary, TranslationMemory,
    TranslationReport,
};
use crate::utils::path_validator::SafePathValidator;
use crate::utils::paths::get_translation_memory_path;

#[cfg(feature = "ts-rs")]
use ts_rs::TS;

async fn get_custom_system_prompt() -> Option<String> {
    let draft = ConfigDraft::global().await;
    let config = draft.data();
    config.system_prompt.clone()
}

fn strip_sensitive_fields(config: &crate::services::AppConfig) -> crate::services::AppConfig {
    let mut public_config = config.clone();
    public_config.api_key.clear();
    for ai_config in &mut public_config.ai_configs {
        ai_config.api_key.clear();
    }
    public_config
}

fn merge_json(target: &mut Value, patch: Value) {
    match (target, patch) {
        (Value::Object(target_map), Value::Object(patch_map)) => {
            for (key, value) in patch_map {
                merge_json(target_map.entry(key).or_insert(Value::Null), value);
            }
        }
        (target_value, patch_value) => {
            *target_value = patch_value;
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "ts-rs", derive(TS))]
#[cfg_attr(feature = "ts-rs", ts(export, export_to = "../src/types/generated/"))]
pub struct POEntry {
    pub comments: Vec<String>,
    pub msgctxt: String,
    pub msgid: String,
    pub msgstr: String,
    pub line_start: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "ts-rs", derive(TS))]
#[cfg_attr(feature = "ts-rs", ts(export, export_to = "../src/types/generated/"))]
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

// Phase 7: Contextual Refine 请求结构体
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")] // 🔧 序列化时使用 camelCase 命名，与前端保持一致
#[cfg_attr(feature = "ts-rs", derive(TS))]
#[cfg_attr(feature = "ts-rs", ts(export, export_to = "../src/types/generated/"))]
pub struct ContextualRefineRequest {
    pub msgid: String,
    pub msgctxt: Option<String>,
    pub comment: Option<String>,
    pub previous_entry: Option<String>,
    pub next_entry: Option<String>,
}

// TokenStats 已从 services 模块导入

fn auto_save_translation_memory(translator: &AITranslator) {
    if let Some(tm) = translator.get_translation_memory() {
        let tm_path = get_translation_memory_path().to_string_lossy().to_string();
        if let Some(parent) = std::path::Path::new(&tm_path).parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        if let Err(e) = tm.save_to_file(&tm_path) {
            log::error!("[TM] 保存失败: {}", e);
        }
    }
}

fn save_term_library(library: &TermLibrary, path: &std::path::PathBuf) -> Result<(), String> {
    library.save_to_file(path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn parse_po_file(file_path: String) -> Result<Vec<POEntry>, String> {
    let validator = SafePathValidator::new();
    let safe_path = validator
        .validate_file_path(&file_path)
        .map_err(|e| format!("路径验证失败: {}", e))?;

    let parser = POParser::new().map_err(|e| e.to_string())?;
    parser
        .parse_file(
            safe_path
                .to_str()
                .ok_or_else(|| "Invalid UTF-8 in file path".to_string())?,
        )
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn translate_entry(
    app_handle: tauri::AppHandle,
    text: String,
    target_language: Option<String>,
) -> Result<String, String> {
    let mut translator = {
        let draft = ConfigDraft::global().await;
        let config = draft.data();
        let ai_config = config
            .get_active_ai_config()
            .ok_or_else(|| "未找到启用的AI配置，请在设置中配置并启用AI服务".to_string())?
            .clone();

        let custom_prompt = config.system_prompt.clone();
        AITranslator::new_with_config(ai_config, true, custom_prompt.as_deref(), target_language)
            .map_err(|e| format!("AI翻译器初始化失败: {}", e))?
    };

    let result = translator
        .translate_batch(vec![text], None)
        .await
        .map_err(|e| e.to_string())?;

    auto_save_translation_memory(&translator);

    let batch_stats = &translator.batch_stats;
    let token_stats = translator.get_token_stats();
    let stats_payload = serde_json::json!({
        "stats": {
            "total": 1,
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
        }
    });
    let _ = app_handle.emit("translation:after", stats_payload);

    result
        .into_iter()
        .next()
        .ok_or_else(|| "No translation result".to_string())
}

#[derive(Debug, Serialize)]
pub struct TranslationResult {
    pub translation: String,
    pub source: String, // 'tm', 'dedup', 'ai'
}

#[derive(Debug, Serialize)]
pub struct BatchResult {
    pub translations: Vec<String>,
    pub translation_sources: Vec<String>, // 每个翻译的来源：'tm', 'dedup', 'ai'
    pub stats: TranslationStats,
}

/// 带任务 ID 的批量翻译结果
#[derive(Debug, Serialize)]
pub struct BatchResultWithTaskId {
    pub task_id: u64,
    pub translations: Vec<String>,
    pub translation_sources: Vec<String>, // 每个翻译的来源：'tm', 'dedup', 'ai'
    pub stats: TranslationStats,
}

// 取消翻译任务
#[tauri::command]
pub fn cancel_translation(task_id: u64) -> Result<bool, String> {
    use crate::services::translation_task::get_task_manager;
    let cancelled = get_task_manager().cancel_task(task_id);
    Ok(cancelled)
}

// 取消所有翻译任务
#[tauri::command]
pub fn cancel_all_translations() -> Result<usize, String> {
    use crate::services::translation_task::get_task_manager;
    let count = get_task_manager().cancel_all_tasks();
    Ok(count)
}

// ❌ translate_batch (Event API) 已移除
// ✅ 统一使用 translate_batch_with_channel (Channel API)

#[tauri::command]
pub fn get_translation_memory() -> Result<TranslationMemory, String> {
    let memory_path = get_translation_memory_path().to_string_lossy().to_string();
    TranslationMemory::new_from_file(memory_path).map_err(|e| {
        println!("[TM] 加载记忆库失败: {}", e);
        format!("加载记忆库失败: {}", e)
    })
}

#[tauri::command]
pub fn get_builtin_phrases() -> Result<serde_json::Value, String> {
    let builtin = crate::services::translation_memory::get_builtin_memory();
    let memory_map: std::collections::HashMap<String, String> = builtin.into_iter().collect();
    Ok(serde_json::json!({ "memory": memory_map }))
}

#[tauri::command]
pub fn merge_builtin_phrases() -> Result<usize, String> {
    use crate::services::translation_memory::{TranslationMemory, get_builtin_memory};
    use crate::utils::paths::get_translation_memory_path;

    let memory_path = get_translation_memory_path();
    let mut tm = TranslationMemory::new_from_file(&memory_path)
        .map_err(|e| format!("加载记忆库失败: {}", e))?;

    let builtin = get_builtin_memory();
    let builtin_count = builtin.len();

    let mut added_count = 0;
    for (source, target) in builtin {
        if !tm.memory.contains_key(&source) {
            tm.memory.insert(source, target);
            added_count += 1;
        }
    }

    tm.stats.total_entries = tm.memory.len();
    tm.save_all(&memory_path)
        .map_err(|e| format!("保存记忆库失败: {}", e))?;

    crate::app_log!(
        "[TM] 合并内置词库: {} 条内置短语，新增 {} 条",
        builtin_count,
        added_count
    );

    Ok(added_count)
}

#[tauri::command]
pub fn save_translation_memory(memory: TranslationMemory) -> Result<(), String> {
    let memory_path = get_translation_memory_path().to_string_lossy().to_string();

    if let Some(parent) = std::path::Path::new(&memory_path).parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    memory.save_to_file(memory_path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn open_file_dialog(app: tauri::AppHandle) -> Result<Option<String>, String> {
    use std::sync::mpsc;
    use tauri_plugin_dialog::DialogExt;

    let (tx, rx) = mpsc::channel();

    app.dialog()
        .file()
        .add_filter("PO Files", &["po"])
        .add_filter("All Files", &["*"])
        .pick_file(move |path| {
            let _ = tx.send(path);
        });

    match rx.recv() {
        Ok(Some(path)) => Ok(Some(path.to_string())),
        Ok(None) => Ok(None),
        Err(_) => Err("Dialog cancelled".to_string()),
    }
}

#[tauri::command]
pub fn save_file_dialog(app: tauri::AppHandle) -> Result<Option<String>, String> {
    use std::sync::mpsc;
    use tauri_plugin_dialog::DialogExt;

    let (tx, rx) = mpsc::channel();

    app.dialog()
        .file()
        .add_filter("PO Files", &["po"])
        .add_filter("All Files", &["*"])
        .save_file(move |path| {
            let _ = tx.send(path);
        });

    match rx.recv() {
        Ok(Some(path)) => Ok(Some(path.to_string())),
        Ok(None) => Ok(None),
        Err(_) => Err("Dialog cancelled".to_string()),
    }
}

#[tauri::command]
pub fn save_po_file(file_path: String, entries: Vec<POEntry>) -> Result<(), String> {
    let validator = SafePathValidator::new();
    let safe_path = validator
        .validate_file_path(&file_path)
        .map_err(|e| format!("路径验证失败: {}", e))?;

    let parser = POParser::new().map_err(|e| e.to_string())?;
    parser
        .write_file(
            safe_path
                .to_str()
                .ok_or_else(|| "Invalid UTF-8 in file path".to_string())?,
            &entries,
        )
        .map_err(|e| e.to_string())
}

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

#[tauri::command]
pub async fn get_app_config() -> Result<serde_json::Value, String> {
    let draft = ConfigDraft::global().await;
    let config = draft.data();
    serde_json::to_value(strip_sensitive_fields(&config)).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_app_config(config: serde_json::Value) -> Result<(), String> {
    let draft = ConfigDraft::global().await;
    let mut draft_config = draft.draft();

    let mut current_config = serde_json::to_value(&**draft_config).map_err(|e| e.to_string())?;
    merge_json(&mut current_config, config);

    let app_config: crate::services::AppConfig =
        serde_json::from_value(current_config).map_err(|e| e.to_string())?;

    **draft_config = app_config;
    drop(draft_config);
    draft.apply().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn validate_config(config: serde_json::Value) -> Result<bool, String> {
    let app_config: crate::services::AppConfig =
        serde_json::from_value(config).map_err(|e| e.to_string())?;

    if app_config.ai_configs.is_empty() {
        return Err("配置中至少需要一个 AI 配置".to_string());
    }

    for (idx, ai_config) in app_config.ai_configs.iter().enumerate() {
        if ai_config.api_key.is_empty() {
            return Err(format!("AI 配置 {} 缺少 API Key", idx));
        }
    }

    Ok(true)
}

// 日志相关命令 - 读取实际日志文件而非内存缓冲区
#[tauri::command]
pub fn get_app_logs() -> Result<Vec<String>, String> {
    use std::fs;

    // 优先读取实际的日志文件，而不是内存缓冲区
    match crate::utils::paths::app_logs_dir() {
        Ok(log_dir) => {
            // 查找最新的应用日志文件（按修改时间排序）
            if let Ok(entries) = fs::read_dir(&log_dir) {
                let mut app_log_files: Vec<_> = entries
                    .filter_map(|entry| entry.ok())
                    .filter(|entry| {
                        entry.file_name().to_string_lossy().starts_with("app")
                            && entry.file_name().to_string_lossy().ends_with(".log")
                    })
                    .collect();

                // 按修改时间排序，最新的在前
                app_log_files.sort_by_key(|entry| {
                    entry
                        .metadata()
                        .and_then(|m| m.modified())
                        .unwrap_or(std::time::SystemTime::UNIX_EPOCH)
                });
                app_log_files.reverse();

                // 只读取最新的日志文件（最清晰简洁）
                if let Some(latest_log) = app_log_files.first() {
                    if let Ok(content) = fs::read_to_string(latest_log.path()) {
                        let lines: Vec<String> = content
                            .lines()
                            .filter(|line| !line.trim().is_empty()) // 过滤空行
                            .map(|line| line.to_string())
                            .collect();

                        if !lines.is_empty() {
                            return Ok(lines);
                        }
                    }
                }
            }

            // 降级：如果没有找到日志文件，使用内存缓冲区
            Ok(crate::utils::logger::get_logs())
        }
        Err(_) => {
            // 降级：如果无法获取日志目录，使用内存缓冲区
            Ok(crate::utils::logger::get_logs())
        }
    }
}

#[tauri::command]
pub fn clear_app_logs() -> Result<(), String> {
    use std::fs;

    // 1. 清空内存缓冲区
    crate::utils::logger::clear_logs();

    // 2. 清空日志文件（实现增量日志效果）
    if let Ok(log_dir) = crate::utils::paths::app_logs_dir() {
        if let Ok(entries) = fs::read_dir(&log_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_file() && path.extension().is_some_and(|ext| ext == "log") {
                    // 清空文件内容而不是删除文件
                    let _ = fs::write(&path, "");
                }
            }
        }
    }

    Ok(())
}

// 🔄 获取前端日志文件内容（优先从统一日志目录读取）
#[tauri::command]
pub fn get_frontend_logs() -> Result<Vec<String>, String> {
    use std::fs;

    crate::app_log!("🔄 [前端日志] 开始读取前端日志文件");

    // 🔄 优先尝试从统一日志目录读取
    let mut log_directories = Vec::new();

    // 1. 统一日志目录（优先）
    if let Ok(log_dir) = crate::utils::paths::app_logs_dir() {
        log_directories.push((log_dir, "统一日志目录"));
    }

    // 2. AppData/data 目录（回退）
    if let Ok(data_dir) = crate::utils::paths::app_data_dir() {
        log_directories.push((data_dir, "AppData数据目录"));
    }

    let mut all_lines = Vec::new();
    let mut found_files = 0;

    // 尝试从各个目录读取前端日志
    for (dir_path, dir_name) in log_directories {
        if !dir_path.exists() {
            crate::app_log!("📂 [前端日志] {} 不存在: {:?}", dir_name, dir_path);
            continue;
        }

        crate::app_log!("📂 [前端日志] 检查 {}: {:?}", dir_name, dir_path);

        // 查找前端日志文件
        match fs::read_dir(&dir_path) {
            Ok(entries) => {
                let mut frontend_log_files: Vec<_> = entries
                    .filter_map(|entry| entry.ok())
                    .filter(|entry| {
                        let file_name = entry.file_name();
                        let name = file_name.to_string_lossy();
                        name.starts_with("frontend-") && name.ends_with(".log")
                    })
                    .collect();

                if frontend_log_files.is_empty() {
                    crate::app_log!("📭 [前端日志] {} 中没有前端日志文件", dir_name);
                    continue;
                }

                // 按修改时间排序，最新的在前
                frontend_log_files.sort_by_key(|entry| {
                    entry
                        .metadata()
                        .and_then(|m| m.modified())
                        .unwrap_or(std::time::SystemTime::UNIX_EPOCH)
                });
                frontend_log_files.reverse();

                crate::app_log!(
                    "📄 [前端日志] {} 找到 {} 个前端日志文件",
                    dir_name,
                    frontend_log_files.len()
                );

                // 读取最多3个最新的前端日志文件
                for (i, entry) in frontend_log_files.iter().take(3).enumerate() {
                    if found_files > 0 || i > 0 {
                        all_lines.push(format!(
                            "========== {} ==========",
                            entry.file_name().to_string_lossy()
                        ));
                    }

                    if let Ok(content) = fs::read_to_string(entry.path()) {
                        let lines: Vec<String> =
                            content.lines().map(|line| line.to_string()).collect();
                        let lines_count = lines.len(); // 🔧 在移动前保存长度
                        all_lines.extend(lines);
                        found_files += 1;

                        crate::app_log!(
                            "✅ [前端日志] 读取文件: {} ({} 行)",
                            entry.file_name().to_string_lossy(),
                            lines_count
                        );
                    }
                }

                // 如果找到了文件，就不再继续查找其他目录
                if found_files > 0 {
                    break;
                }
            }
            Err(e) => {
                crate::app_log!("❌ [前端日志] 无法读取 {}: {}", dir_name, e);
            }
        }
    }

    if found_files == 0 {
        crate::app_log!("📭 [前端日志] 所有目录都没有找到前端日志文件");
        return Ok(vec!["前端日志文件不存在，可能还没有保存过日志".to_string()]);
    }

    crate::app_log!(
        "✅ [前端日志] 读取完成，共 {} 个文件，{} 行",
        found_files,
        all_lines.len()
    );
    Ok(all_lines)
}

// ==================== 术语库相关命令 ====================

/// 获取术语库
#[tauri::command]
pub fn get_term_library() -> Result<TermLibrary, String> {
    let path = crate::utils::paths::get_term_library_path();
    TermLibrary::load_from_file(path).map_err(|e| e.to_string())
}

/// 添加术语到术语库
#[tauri::command]
pub fn add_term_to_library(
    source: String,
    user_translation: String,
    ai_translation: String,
    context: Option<String>,
) -> Result<(), String> {
    let path = crate::utils::paths::get_term_library_path();
    let mut library = TermLibrary::load_from_file(&path).map_err(|e| e.to_string())?;

    library
        .add_term(source, user_translation, ai_translation, context)
        .map_err(|e| e.to_string())?;

    save_term_library(&library, &path)?;

    Ok(())
}

/// 从术语库删除术语
#[tauri::command]
pub fn remove_term_from_library(source: String) -> Result<(), String> {
    let path = crate::utils::paths::get_term_library_path();
    let mut library = TermLibrary::load_from_file(&path).map_err(|e| e.to_string())?;

    library.remove_term(&source).map_err(|e| e.to_string())?;

    save_term_library(&library, &path)?;

    Ok(())
}

/// 生成风格总结（调用AI）
#[tauri::command]
pub async fn generate_style_summary() -> Result<String, String> {
    let path = crate::utils::paths::get_term_library_path();
    let mut library = TermLibrary::load_from_file(&path).map_err(|e| e.to_string())?;

    if library.terms.is_empty() {
        crate::app_log!("[风格总结] 术语库为空，无法生成");
        return Err("术语库为空，无法生成风格总结".to_string());
    }

    crate::app_log!("[风格总结] 开始生成，基于 {} 条术语", library.terms.len());

    // 获取当前活动的 AI 配置（克隆后释放锁，避免跨越 .await）
    let active_config = {
        let draft = ConfigDraft::global().await;
        let config_guard = draft.data();
        config_guard
            .get_active_ai_config()
            .cloned() // 克隆配置
            .ok_or_else(|| "未找到活动的AI配置".to_string())?
    }; // config_guard 在此释放

    crate::app_log!(
        "[风格总结] 使用AI配置: 供应商={}, 模型={}",
        active_config.provider_id,
        active_config.model.as_deref().unwrap_or("auto")
    );

    // 构建分析提示
    let analysis_prompt = library.build_analysis_prompt();
    crate::app_log!(
        "[风格总结] 提示词已构建，长度: {} 字符",
        analysis_prompt.len()
    );

    // 调用AI生成总结（使用自定义提示词方法，避免批量翻译格式）
    let mut translator = AITranslator::new_with_config(
        active_config, // 已克隆，可直接使用
        false,         // 不使用TM
        None,          // 不使用系统提示词（风格分析有自己的系统角色）
        None,          // 不指定目标语言
    )
    .map_err(|e| e.to_string())?;

    // 记录提示词到提示词日志
    let metadata = serde_json::json!({
        "type": "风格分析",
        "term_count": library.terms.len(),
        "provider": "current_active",
    });
    crate::services::log_prompt("风格分析", analysis_prompt.clone(), Some(metadata));

    let summary = translator
        .translate_with_custom_user_prompt(analysis_prompt.clone())
        .await
        .map_err(|e| {
            crate::app_log!("[风格总结] AI调用失败: {}", e);
            e.to_string()
        })?;

    // 更新提示词日志的响应
    let logs = crate::services::get_prompt_logs();
    if let Some(last_idx) = logs.len().checked_sub(1) {
        crate::services::update_prompt_response(last_idx, summary.clone());
    }

    crate::app_log!("[风格总结] AI生成成功，总结长度: {} 字符", summary.len());

    // 清理 AI 返回内容中的提示性文本
    let cleaned_summary = summary
        .lines()
        .filter_map(|line| {
            let trimmed = line.trim();
            if trimmed.is_empty() {
                return None;
            }

            // 需要清理的前缀模式（匹配各种 AI 输出格式）
            let prefixes_to_clean = [
                "第1行",
                "第2行",
                "风格概括（", // 匹配 "风格概括（10-15字..."
                "风格概括",
                "详细指导（", // 匹配 "详细指导（不超过150字..."
                "详细指导",
            ];

            // 检查是否包含需要清理的前缀
            for prefix in &prefixes_to_clean {
                if trimmed.starts_with(prefix) {
                    // 提取分隔符后的实际内容（支持 "：" ":" " - " 等分隔符）
                    let separators = ["：", ":", " - ", "- "];
                    for sep in separators {
                        if let Some(pos) = trimmed.find(sep) {
                            let content = trimmed[pos + sep.len()..].trim();
                            if !content.is_empty() {
                                return Some(content.to_string());
                            }
                        }
                    }
                    return None;
                }
            }

            // 不包含前缀的行直接保留
            Some(trimmed.to_string())
        })
        .collect::<Vec<_>>()
        .join("\n");

    // 更新术语库（使用清理后的内容）
    library.update_style_summary(cleaned_summary.clone());
    save_term_library(&library, &path)?;

    crate::app_log!(
        "[风格总结] 风格总结已保存 (v{})",
        library
            .style_summary
            .as_ref()
            .map(|s| s.version)
            .unwrap_or(0)
    );

    Ok(cleaned_summary)
}

// ========== Phase 7: Contextual Refine ==========

/// 构建精翻上下文提示词
fn build_contextual_prompt(request: &ContextualRefineRequest, target_language: &str) -> String {
    let mut context_parts = Vec::new();

    // 1. 添加上下文信息（如果有）
    if let Some(msgctxt) = &request.msgctxt
        && !msgctxt.is_empty()
    {
        context_parts.push(format!("【上下文】: {}", msgctxt));
    }

    // 2. 添加注释信息（如果有）
    if let Some(comment) = &request.comment
        && !comment.is_empty()
    {
        context_parts.push(format!("【开发者注释】: {}", comment));
    }

    // 3. 添加前后条目信息（提供语境连贯性）
    if let Some(prev) = &request.previous_entry
        && !prev.is_empty()
    {
        context_parts.push(format!("【前一条译文】: {}", prev));
    }
    if let Some(next) = &request.next_entry
        && !next.is_empty()
    {
        context_parts.push(format!("【后一条译文】: {}", next));
    }

    // 4. 目标语言指示
    let target_lang_instruction = match target_language {
        "zh-Hans" | "zh-CN" => "翻译成简体中文",
        "zh-Hant" | "zh-TW" => "翻译成繁体中文",
        "en" | "en-US" => "Translate to English",
        "ja" | "ja-JP" => "日本語に翻訳",
        "ko" | "ko-KR" => "한국어로 번역",
        "fr" | "fr-FR" => "Traduire en français",
        "de" | "de-DE" => "Ins Deutsche übersetzen",
        "es" | "es-ES" => "Traducir al español",
        "ru" | "ru-RU" => "Перевести на русский",
        "ar" | "ar-SA" => "ترجم إلى العربية",
        lang => &format!("Translate to {}", lang),
    };

    // 5. 组装完整提示词
    let mut prompt = String::new();

    // 添加精翻说明
    prompt.push_str(
        "这是一条需要精细翻译的文本。请仔细理解以下上下文信息，提供最准确、最符合语境的翻译：\n\n",
    );

    // 添加所有上下文
    if !context_parts.is_empty() {
        for part in &context_parts {
            prompt.push_str(&format!("{}\n", part));
        }
        prompt.push('\n');
    }

    // 添加待翻译文本
    prompt.push_str(&format!("【待翻译文本】: {}\n\n", request.msgid));

    // 添加翻译要求
    prompt.push_str(&format!(
        "请{}，只返回翻译结果，不要添加任何解释。",
        target_lang_instruction
    ));

    prompt
}

/// Contextual Refine - 携带上下文的精细翻译
///
/// 用于对待确认条目进行高质量重翻，绕过翻译记忆库，
/// 充分利用上下文（msgctxt、注释、前后条目）提供更准确的翻译
#[tauri::command]
pub async fn contextual_refine(
    app: tauri::AppHandle,
    requests: Vec<ContextualRefineRequest>,
    target_language: String,
) -> Result<Vec<String>, String> {
    crate::app_log!("[精翻] 开始精翻，共 {} 条", requests.len());

    if requests.is_empty() {
        return Ok(Vec::new());
    }

    // 1-4. 获取配置并创建翻译器（在单独的作用域中以释放guard）
    let mut translator = {
        let draft = ConfigDraft::global().await;
        let config = draft.data();

        let ai_config = config
            .get_active_ai_config()
            .ok_or_else(|| "未找到启用的AI配置，请在设置中配置并启用AI服务".to_string())?
            .clone();

        let custom_prompt = config.system_prompt.clone();

        AITranslator::new_with_config(
            ai_config,
            false, // 🔑 绕过翻译记忆库
            custom_prompt.as_deref(),
            Some(target_language.clone()),
        )
        .map_err(|e| {
            crate::app_log!("[精翻] 创建翻译器失败: {}", e);
            format!("AI翻译器初始化失败: {}", e)
        })?
    };

    crate::app_log!("[精翻] 翻译器已创建（已绕过TM）");

    // 5. 构建所有精翻提示词
    let prompts: Vec<String> = requests
        .iter()
        .map(|req| build_contextual_prompt(req, &target_language))
        .collect();

    crate::app_log!("[精翻] 已构建 {} 条精翻提示词", prompts.len());

    // 6. 发送进度事件：开始
    let _ = app.emit(
        "refine:start",
        serde_json::json!({
            "count": requests.len()
        }),
    );

    // 7. 逐条翻译（精翻需要完整的上下文，不适合批量）
    let mut results = Vec::new();
    for (idx, prompt) in prompts.iter().enumerate() {
        // 记录完整的AI请求（JSON格式）
        // 构建提示词日志（只显示实际发送给AI的内容）
        let full_prompt = format!(
            "【System Prompt】:\n{}
【User Prompt】:\n{}",
            translator.current_system_prompt(),
            prompt
        );

        let metadata = serde_json::json!({
            "index": idx,
            "msgid": requests.get(idx).map(|r| &r.msgid),
            "target_language": &target_language,
            "model": "auto",
            "temperature": 1.0,
        });
        crate::services::log_prompt("精翻", full_prompt, Some(metadata));

        // 使用自定义提示词方法，直接发送精翻提示词
        match translator
            .translate_with_custom_user_prompt(prompt.clone())
            .await
        {
            Ok(result) => {
                // 更新提示词日志的响应
                let logs = crate::services::get_prompt_logs();
                if let Some(last_idx) = logs.len().checked_sub(1) {
                    crate::services::update_prompt_response(last_idx, result.clone());
                }
                results.push(result);
            }
            Err(e) => {
                crate::app_log!("[精翻] AI翻译失败: {}", e);
                let _ = app.emit(
                    "refine:error",
                    serde_json::json!({
                        "error": e.to_string()
                    }),
                );
                return Err(e.to_string());
            }
        }
    }

    crate::app_log!("[精翻] 翻译完成，获得 {} 条结果", results.len());

    // 🔧 发送统计事件（精翻）- 使用 translation:after 而不是 translation-stats-update
    let batch_stats = &translator.batch_stats;
    let token_stats = translator.get_token_stats();
    let stats_payload = serde_json::json!({
        "stats": {
            "total": requests.len(),
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
        }
    });
    let _ = app.emit("translation:after", stats_payload);

    // 8. 发送完成事件
    let _ = app.emit(
        "refine:complete",
        serde_json::json!({
            "results": &results,
            "count": results.len()
        }),
    );

    Ok(results)
}

/// 检查是否需要更新风格总结
#[tauri::command]
pub fn should_update_style_summary() -> Result<bool, String> {
    let path = crate::utils::paths::get_term_library_path();
    let library = TermLibrary::load_from_file(&path).map_err(|e| e.to_string())?;
    Ok(library.should_update_style_summary())
}

// ========== Tauri 2.x Channel API 优化 ==========

/// 使用 Channel 的批量翻译 - 高性能流式进度更新
///
/// 相比传统 Event:
/// - 性能提升 ~40%
/// - 内存占用降低 ~30%
/// - 更适合大文件处理
///
/// 返回任务 ID，可用于取消翻译
#[tauri::command]
pub async fn translate_batch_with_channel(
    texts: Vec<String>,
    target_language: Option<String>,
    progress_channel: tauri::ipc::Channel<crate::services::BatchProgressEvent>,
    stats_channel: tauri::ipc::Channel<crate::services::BatchStatsEvent>,
) -> Result<BatchResultWithTaskId, String> {
    use crate::services::translation_task::TaskGuard;
    use crate::services::{BatchStatsEvent, TokenStatsEvent};
    use crate::utils::progress_throttler::ProgressThrottler;

    // 创建翻译任务
    let task = TaskGuard::new();
    let task_id = task.id();
    let cancel_token = task.token();

    crate::app_log!(
        "[翻译任务] 开始任务 #{}，共 {} 条文本",
        task_id,
        texts.len()
    );

    // 立即发送初始进度事件，包含任务ID（用于前端取消翻译）
    let init_event = crate::services::BatchProgressEvent {
        processed: 0,
        total: texts.len(),
        current_item: None,
        percentage: 0.0,
        estimated_remaining_seconds: None,
        index: None,
        task_id: Some(task_id),
    };
    let _ = progress_channel.send(init_event);

    // 初始化配置和翻译器（在单独的作用域中以释放guard）
    let mut translator = {
        let draft = ConfigDraft::global().await;
        let config = draft.data();
        let ai_config = config
            .get_active_ai_config()
            .ok_or_else(|| "未找到启用的AI配置，请在设置中配置并启用AI服务".to_string())?
            .clone();

        let custom_prompt = config.system_prompt.clone();
        AITranslator::new_with_config(ai_config, true, custom_prompt.as_deref(), target_language)
            .map_err(|e| format!("AI翻译器初始化失败: {}", e))?
    };

    // 创建进度节流器（100ms 间隔，避免高频更新导致 UI 卡顿）
    let progress_throttler = std::sync::Arc::new(ProgressThrottler::with_default_interval());

    // 翻译处理（按批次）
    let mut translations = Vec::with_capacity(texts.len());
    let mut translation_sources = Vec::with_capacity(texts.len()); // 📍 收集翻译来源
    let batch_size = 20; // 单批 20 条
    let mut global_index = 0; // 全局索引，用于追踪整体进度
    let total_count = texts.len(); // 提前保存总数，避免闭包中借用

    // 🔧 记录上一批的 token 统计，用于计算增量
    let mut prev_token_input = 0u32;
    let mut prev_token_output = 0u32;
    let mut prev_token_total = 0u32;
    let mut prev_token_cost = 0f64;

    // 🔧 累加所有批次的统计（因为每次 translate_batch 都会重置 batch_stats）
    let mut total_tm_hits = 0usize;
    let mut total_deduplicated = 0usize;
    let mut total_ai_translated = 0usize;
    let mut total_tm_learned = 0usize;

    for chunk in texts.chunks(batch_size) {
        // 🔧 检查是否被取消
        if cancel_token.is_cancelled() {
            crate::app_log!("[翻译任务] 任务 #{} 已被用户取消", task_id);
            return Err("翻译已取消".to_string());
        }

        let chunk_vec = chunk.to_vec();
        let chunk_start_index = global_index;

        // 🔔 创建 progress_callback，实时推送 TM 命中和 AI 翻译结果（带节流优化）
        let progress_channel_clone = progress_channel.clone();
        let throttler_clone = std::sync::Arc::clone(&progress_throttler);
        let cancel_token_clone = std::sync::Arc::clone(&cancel_token);
        let progress_callback = Box::new(move |local_idx: usize, translation: String| {
            // 检查取消状态
            if cancel_token_clone.is_cancelled() {
                return;
            }

            // 使用节流器减少高频更新，仅每100ms发送一次进度
            if throttler_clone.should_update() {
                let global_idx = chunk_start_index + local_idx;
                let event = crate::services::BatchProgressEvent::with_index(
                    global_idx + 1,
                    total_count,
                    Some(translation.clone()),
                    global_idx,
                );
                let _ = progress_channel_clone.send(event);
            }
        });

        // 📍 使用 translate_batch_with_sources 获取翻译和来源
        let (result, sources) = translator
            .translate_batch_with_sources(chunk_vec.clone(), Some(progress_callback), None)
            .await
            .map_err(|e| e.to_string())?;

        // 🔧 再次检查是否被取消（AI 请求后）
        if cancel_token.is_cancelled() {
            crate::app_log!("[翻译任务] 任务 #{} 已被用户取消", task_id);
            return Err("翻译已取消".to_string());
        }

        // 收集翻译结果和来源
        for (translation, source) in result.iter().zip(sources.iter()) {
            translations.push(translation.clone());
            translation_sources.push(source.clone()); // 📍 收集来源
            global_index += 1;
        }

        // 🔧 每批发送一次统计事件（batch_stats 是当前批次增量，token_stats 需计算增量）
        let batch_stats = &translator.batch_stats;
        let token_stats = translator.get_token_stats();

        // 🔧 累加批次统计
        total_tm_hits += batch_stats.tm_hits;
        total_deduplicated += batch_stats.deduplicated;
        total_ai_translated += batch_stats.ai_translated;
        total_tm_learned += batch_stats.tm_learned;

        let stats_event = BatchStatsEvent {
            tm_hits: batch_stats.tm_hits,
            deduplicated: batch_stats.deduplicated,
            ai_translated: batch_stats.ai_translated,
            token_stats: TokenStatsEvent {
                // 🔧 发送 Token 增量，而非累计值
                prompt_tokens: (token_stats.input_tokens - prev_token_input) as usize,
                completion_tokens: (token_stats.output_tokens - prev_token_output) as usize,
                total_tokens: (token_stats.total_tokens - prev_token_total) as usize,
                cost: token_stats.cost - prev_token_cost,
            },
        };
        let _ = stats_channel.send(stats_event);

        // 🔧 保存当前累计值，用于下一批计算增量
        prev_token_input = token_stats.input_tokens;
        prev_token_output = token_stats.output_tokens;
        prev_token_total = token_stats.total_tokens;
        prev_token_cost = token_stats.cost;
    }

    // 保存翻译记忆库
    auto_save_translation_memory(&translator);

    crate::app_log!("[翻译任务] 任务 #{} 完成", task_id);

    // 返回最终结果（使用累加的统计，而不是最后一个批次的统计）
    let token_stats = translator.get_token_stats().clone();

    // TaskGuard 会在 drop 时自动完成任务
    Ok(BatchResultWithTaskId {
        task_id,
        translations,
        translation_sources, // 📍 返回翻译来源
        stats: TranslationStats {
            total: texts.len(),                 // 使用总数，而不是 batch_stats.total
            tm_hits: total_tm_hits,             // 🔧 使用累加值
            deduplicated: total_deduplicated,   // 🔧 使用累加值
            ai_translated: total_ai_translated, // 🔧 使用累加值
            token_stats,
            tm_learned: total_tm_learned, // 🔧 使用累加值
        },
    })
}
