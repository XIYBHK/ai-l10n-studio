use std::sync::Mutex;
use serde::{Deserialize, Serialize};
use chrono::Local;

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
    let entry_id = format!("{}-{}", timestamp, logs.as_ref().unwrap().len());
    
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
    let mut logs = PROMPT_LOGS.lock().unwrap();
    if let Some(ref mut log_vec) = *logs {
        if let Some(entry) = log_vec.get_mut(index) {
            entry.response = Some(response);
        }
    }
}

/// 获取所有提示词日志
pub fn get_prompt_logs() -> Vec<PromptLogEntry> {
    let logs = PROMPT_LOGS.lock().unwrap();
    logs.as_ref().map(|v| v.clone()).unwrap_or_default()
}

/// 清空提示词日志
pub fn clear_prompt_logs() {
    let mut logs = PROMPT_LOGS.lock().unwrap();
    if let Some(ref mut log_vec) = *logs {
        log_vec.clear();
    }
}

/// 格式化提示词日志为可读文本
pub fn format_prompt_logs() -> String {
    let logs = get_prompt_logs();
    if logs.is_empty() {
        return "暂无提示词日志".to_string();
    }
    
    let mut output = String::new();
    output.push_str(&format!("===== 提示词日志 (共 {} 条) =====\n\n", logs.len()));
    
    for (idx, entry) in logs.iter().enumerate() {
        output.push_str(&format!("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"));
        output.push_str(&format!("【日志 #{}】\n", idx + 1));
        output.push_str(&format!("时间: {}\n", entry.timestamp));
        output.push_str(&format!("类型: {}\n", entry.log_type));
        
        if let Some(ref metadata) = entry.metadata {
            output.push_str(&format!("元数据: {}\n", serde_json::to_string_pretty(metadata).unwrap_or_default()));
        }
        
        output.push_str(&format!("\n【输入提示词】:\n{}\n", entry.prompt));
        
        if let Some(ref response) = entry.response {
            output.push_str(&format!("\n【AI响应】:\n{}\n", response));
        } else {
            output.push_str(&format!("\n【AI响应】: (暂无)\n"));
        }
        
        output.push_str(&format!("\n"));
    }
    
    output
}

