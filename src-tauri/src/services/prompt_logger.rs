#![allow(clippy::unwrap_used)]
#![allow(clippy::expect_used)]
#![allow(clippy::collapsible_if)]
#![allow(clippy::useless_format)]

use chrono::Local;
use serde::{Deserialize, Serialize};
use std::sync::Mutex;

/// 提示词日志条目
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PromptLogEntry {
    pub timestamp: String,
    pub log_type: String, // "批量翻译" 或 "精翻"
    pub prompt: String,
    pub response: Option<String>,
    pub metadata: Option<serde_json::Value>,
}

/// 全局提示词日志存储
static PROMPT_LOGS: Mutex<Option<Vec<PromptLogEntry>>> = Mutex::new(None);

/// 初始化提示词日志
pub fn init_prompt_logger() {
    let mut logs = PROMPT_LOGS.lock().unwrap();
    if logs.is_none() {
        *logs = Some(Vec::new());
    }
}

/// 记录提示词
pub fn log_prompt(log_type: &str, prompt: String, metadata: Option<serde_json::Value>) -> String {
    let mut logs = PROMPT_LOGS.lock().unwrap();
    if logs.is_none() {
        *logs = Some(Vec::new());
    }

    let timestamp = Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
    let entry_id = format!(
        "{}-{}",
        timestamp,
        logs.as_ref().map(|l| l.len()).unwrap_or(0)
    );

    let entry = PromptLogEntry {
        timestamp: timestamp.clone(),
        log_type: log_type.to_string(),
        prompt,
        response: None,
        metadata,
    };

    if let Some(ref mut log_vec) = *logs {
        log_vec.push(entry);
        // 限制日志条数为最近100条
        if log_vec.len() > 100 {
            log_vec.drain(0..log_vec.len() - 100);
        }
    }

    entry_id
}

/// 更新提示词的响应
pub fn update_prompt_response(index: usize, response: String) {
    let mut logs = PROMPT_LOGS.lock().expect("PROMPT_LOGS lock poisoned");
    if let Some(ref mut log_vec) = *logs {
        if let Some(entry) = log_vec.get_mut(index) {
            entry.response = Some(response);
        }
    }
}

/// 获取所有提示词日志
pub fn get_prompt_logs() -> Vec<PromptLogEntry> {
    let logs = PROMPT_LOGS.lock().expect("PROMPT_LOGS lock poisoned");
    logs.as_ref().map(|v| v.clone()).unwrap_or_default()
}

/// 清空提示词日志
pub fn clear_prompt_logs() {
    let mut logs = PROMPT_LOGS.lock().expect("PROMPT_LOGS lock poisoned");
    if let Some(ref mut log_vec) = *logs {
        log_vec.clear();
    }
}

/// 格式化提示词日志为可读文本（精简版）
pub fn format_prompt_logs() -> String {
    let logs = get_prompt_logs();
    if logs.is_empty() {
        return "暂无提示词日志".to_string();
    }

    let mut output = String::new();
    output.push_str(&format!("========== 提示词日志 (共 {} 条) ==========\n\n", logs.len()));

    for (idx, entry) in logs.iter().enumerate() {
        output.push_str(&format!("========== #{} ==========\n", idx + 1));
        
        // 头部信息（一行显示）
        let mut header_parts = vec![
            format!("时间: {}", entry.timestamp),
            format!("类型: {}", entry.log_type),
        ];
        
        // 从元数据提取关键信息
        if let Some(ref metadata) = entry.metadata {
            if let Some(model) = metadata.get("model").and_then(|v| v.as_str()) {
                header_parts.push(format!("模型: {}", model));
            }
            if let Some(provider) = metadata.get("provider").and_then(|v| v.as_str()) {
                header_parts.push(format!("供应商: {}", provider));
            }
            if let Some(batch_idx) = metadata.get("batch_index").and_then(|v| v.as_u64()) {
                if let Some(total) = metadata.get("total_batches").and_then(|v| v.as_u64()) {
                    if let Some(size) = metadata.get("batch_size").and_then(|v| v.as_u64()) {
                        header_parts.push(format!("批次: {}/{} ({} 条)", batch_idx, total, size));
                    }
                }
            }
        }
        output.push_str(&format!("{}\n\n", header_parts.join(" | ")));

        // 完整提示词（真实发送给AI的内容）
        output.push_str(&entry.prompt);
        output.push_str("\n\n");

        // AI 响应
        output.push_str("【AI 响应】\n");
        if let Some(ref response) = entry.response {
            output.push_str(response);
        } else {
            output.push_str("(等待响应...)");
        }
        output.push_str("\n\n");
    }

    output
}
