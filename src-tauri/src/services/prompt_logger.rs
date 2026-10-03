#![allow(clippy::collapsible_if)]
#![allow(clippy::useless_format)]

use chrono::Local;
use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// 提示词日志条目
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PromptLogEntry {
    pub id: String,
    pub timestamp: String,
    pub log_type: String, // "批量翻译" 或 "精翻"
    pub prompt: String,
    pub response: Option<String>,
    pub metadata: Option<serde_json::Value>,
}

#[derive(Default)]
struct PromptLog {
    entries: Vec<PromptLogEntry>,
}

impl PromptLog {
    fn push(
        &mut self,
        log_type: &str,
        prompt: String,
        metadata: Option<serde_json::Value>,
    ) -> String {
        let id = Uuid::new_v4().to_string();
        self.entries.push(PromptLogEntry {
            id: id.clone(),
            timestamp: Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
            log_type: log_type.into(),
            prompt,
            response: None,
            metadata,
        });
        if self.entries.len() > 100 {
            self.entries.drain(..self.entries.len() - 100);
        }
        id
    }

    fn respond(&mut self, id: &str, response: String) {
        if let Some(entry) = self.entries.iter_mut().find(|entry| entry.id == id) {
            entry.response = Some(response);
        }
    }
}

static PROMPT_LOGS: Mutex<PromptLog> = Mutex::new(PromptLog {
    entries: Vec::new(),
});

pub fn log_prompt(log_type: &str, prompt: String, metadata: Option<serde_json::Value>) -> String {
    PROMPT_LOGS.lock().push(log_type, prompt, metadata)
}
pub fn update_prompt_response(id: &str, response: String) {
    PROMPT_LOGS.lock().respond(id, response);
}
pub fn get_prompt_logs() -> Vec<PromptLogEntry> {
    PROMPT_LOGS.lock().entries.clone()
}
pub fn clear_prompt_logs() {
    PROMPT_LOGS.lock().entries.clear();
}

/// 格式化提示词日志为可读文本（精简版）
pub fn format_prompt_logs() -> String {
    let logs = get_prompt_logs();
    if logs.is_empty() {
        return "暂无提示词日志".to_string();
    }

    let mut output = String::new();
    output.push_str(&format!(
        "========== 提示词日志 (共 {} 条) ==========\n\n",
        logs.len()
    ));

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

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn responses_follow_ids_after_interleaving_trimming_and_clear() {
        let mut logs = PromptLog::default();
        let first = logs.push("A", "first".into(), None);
        let second = logs.push("B", "second".into(), None);
        logs.respond(&first, "response-a".into());
        assert_eq!(logs.entries[0].response.as_deref(), Some("response-a"));
        assert_eq!(logs.entries[1].response, None);
        for _ in 0..100 {
            logs.push("new", "new".into(), None);
        }
        logs.respond(&second, "must-not-attach".into());
        assert!(logs.entries.iter().all(|entry| entry.response.is_none()));
        logs.entries.clear();
        logs.push("fresh", "fresh".into(), None);
        logs.respond(&first, "must-not-attach".into());
        assert_eq!(logs.entries[0].response, None);
    }
}
