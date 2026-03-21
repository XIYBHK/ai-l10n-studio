use crate::services::{AIConfig, AITranslator, ConfigDraft};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AIConfigSummary {
    pub index: usize,
    pub provider_id: String,
    pub api_key_preview: Option<String>,
    pub has_api_key: bool,
    pub base_url: Option<String>,
    pub model: Option<String>,
    pub proxy: Option<crate::services::ProxyConfig>,
    pub is_active: bool,
}

impl AIConfigSummary {
    fn from_config(index: usize, config: &AIConfig, active_index: Option<usize>) -> Self {
        Self {
            index,
            provider_id: config.provider_id.clone(),
            api_key_preview: (!config.api_key.is_empty()).then(|| mask_api_key(&config.api_key)),
            has_api_key: !config.api_key.is_empty(),
            base_url: config.base_url.clone(),
            model: config.model.clone(),
            proxy: config.proxy.clone(),
            is_active: active_index == Some(index),
        }
    }
}

#[tauri::command]
pub async fn get_all_ai_configs() -> Result<Vec<AIConfigSummary>, String> {
    let draft = ConfigDraft::global().await;
    let config = draft.data();
    let active_index = config.active_config_index;

    Ok(config
        .get_all_ai_configs()
        .iter()
        .enumerate()
        .map(|(index, item)| AIConfigSummary::from_config(index, item, active_index))
        .collect())
}

#[tauri::command]
pub async fn get_active_ai_config() -> Result<Option<AIConfigSummary>, String> {
    let draft = ConfigDraft::global().await;
    let config = draft.data();

    Ok(config
        .active_config_index
        .and_then(|index| config.ai_configs.get(index).map(|item| (index, item)))
        .map(|(index, item)| AIConfigSummary::from_config(index, item, config.active_config_index)))
}

fn mask_api_key(api_key: &str) -> String {
    if api_key.starts_with("sk-") && api_key.len() > 8 {
        format!("sk-***...***{}", &api_key[api_key.len() - 4..])
    } else if api_key.len() > 8 {
        format!(
            "{}***...***{}",
            &api_key[..3],
            &api_key[api_key.len() - 3..]
        )
    } else {
        "***".to_string()
    }
}

#[tauri::command]
pub async fn add_ai_config(config: AIConfig) -> Result<(), String> {
    if config.api_key.trim().is_empty() {
        return Err("API Key 不能为空".to_string());
    }

    crate::app_log!(
        "[AI配置] 添加新配置: provider={:?}, url={}, model={}, key={}",
        config.provider_id,
        config.base_url.as_deref().unwrap_or("默认"),
        config.model.as_deref().unwrap_or("默认"),
        mask_api_key(&config.api_key)
    );

    let draft = ConfigDraft::global().await;

    // 修复死锁：在独立作用域内获取写锁
    {
        let mut draft_config = draft.draft();
        draft_config.add_ai_config(config);
    }

    draft.apply().map_err(|e| {
        crate::app_log!("[AI配置] 保存配置失败: {}", e);
        e.to_string()
    })?;

    crate::app_log!("[AI配置] 新增配置成功");
    Ok(())
}

#[tauri::command]
pub async fn update_ai_config(index: usize, config: AIConfig) -> Result<(), String> {
    let draft = ConfigDraft::global().await;

    // 修复死锁：在独立作用域内获取写锁
    {
        let mut draft_config = draft.draft();
        let mut next_config = config;

        if next_config.api_key.trim().is_empty() {
            let existing = draft_config
                .ai_configs
                .get(index)
                .ok_or_else(|| format!("配置索引超出范围: {}", index))?;
            next_config.api_key = existing.api_key.clone();
        }

        draft_config
            .update_ai_config(index, next_config)
            .map_err(|e| e.to_string())?;
    }

    draft.apply().map_err(|e| e.to_string())?;
    crate::app_log!("更新 AI 配置成功，索引: {}", index);
    Ok(())
}

#[tauri::command]
pub async fn remove_ai_config(index: usize) -> Result<(), String> {
    crate::app_log!("[删除] 开始获取全局配置，索引: {}", index);
    let draft = ConfigDraft::global().await;
    crate::app_log!("[删除] 已获取全局配置");

    // 修复死锁：在独立作用域内获取写锁，确保在 apply() 之前释放
    {
        let mut draft_config = draft.draft();
        crate::app_log!("[删除] 已获取草稿");

        draft_config
            .remove_ai_config(index)
            .map_err(|e| e.to_string())?;
        crate::app_log!("[删除] 已从内存中删除，准备应用");
    }

    crate::app_log!("[删除] 开始 apply");
    draft.apply().map_err(|e| {
        crate::app_log!("[删除] apply 失败: {}", e);
        e.to_string()
    })?;
    crate::app_log!("[删除] apply 返回 Ok");

    crate::app_log!("删除 AI 配置成功，索引: {}", index);
    Ok(())
}

#[tauri::command]
pub async fn set_active_ai_config(index: usize) -> Result<(), String> {
    crate::app_log!("[AI配置] 设置启用配置，索引: {}", index);

    let draft = ConfigDraft::global().await;

    // 修复死锁：在独立作用域内获取写锁
    {
        let mut draft_config = draft.draft();

        let total_configs = draft_config.ai_configs.len();
        if index >= total_configs {
            crate::app_log!("[AI配置] 索引超出范围: {} >= {}", index, total_configs);
            return Err(format!("配置索引超出范围: {} >= {}", index, total_configs));
        }

        draft_config.set_active_ai_config(index).map_err(|e| {
            crate::app_log!("[AI配置] 设置启用配置失败: {}", e);
            e.to_string()
        })?;

        total_configs
    };

    draft.apply().map_err(|e| {
        crate::app_log!("[AI配置] 保存配置失败: {}", e);
        e.to_string()
    })?;

    crate::app_log!("[AI配置] 设置启用配置成功，索引: {}", index);
    Ok(())
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")] // 序列化时使用 camelCase 命名，与前端保持一致
pub struct TestConnectionRequest {
    pub provider_id: String, // 插件化：使用 provider_id 字符串
    pub api_key: String,
    pub base_url: Option<String>,
    pub model: Option<String>,
    pub proxy: Option<crate::services::ProxyConfig>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")] // 序列化时使用 camelCase 命名，与前端保持一致
pub struct TestConnectionResult {
    pub success: bool,
    pub message: String,
    pub response_time_ms: Option<u64>,
}

fn get_provider_display_name(provider_id: &str) -> String {
    use crate::services::ai::provider::with_global_registry;
    with_global_registry(|registry| {
        registry
            .get_provider_info(provider_id)
            .map(|info| info.display_name)
            .unwrap_or_else(|| provider_id.to_string())
    })
}

#[tauri::command]
pub async fn test_ai_connection(
    request: TestConnectionRequest,
) -> Result<TestConnectionResult, String> {
    use std::time::Instant;

    if request.api_key.trim().is_empty() {
        return Err("测试连接前请输入 API Key".to_string());
    }

    crate::app_log!("测试 AI 连接: {:?}", request.provider_id);

    let ai_config = AIConfig {
        provider_id: request.provider_id.clone(),
        api_key: request.api_key,
        base_url: request.base_url,
        model: request.model,
        proxy: request.proxy,
    };

    let start = Instant::now();

    match AITranslator::new_with_config(ai_config.clone(), false, None, None) {
        Ok(mut translator) => {
            let test_text = "The answer to life, universe and everything?";

            let user_prompt = translator.build_user_prompt(&[test_text.to_string()]);
            let request_json = serde_json::json!({
                "model": ai_config.model,
                "messages": [
                    {
                        "role": "system",
                        "content": translator.current_system_prompt()
                    },
                    {
                        "role": "user",
                        "content": user_prompt
                    }
                ],
                "temperature": 1.0
            });

            let full_prompt = format!(
                "【真实AI请求】:\n{}",
                serde_json::to_string_pretty(&request_json)
                    .unwrap_or_else(|_| "JSON序列化失败".to_string())
            );

            let provider_display_name = get_provider_display_name(&ai_config.provider_id);

            let metadata = serde_json::json!({
                "provider": provider_display_name,
                "model": ai_config.model,
                "test_type": "connection_test",
                "test_text": test_text,
            });
            crate::services::log_prompt("连接测试", full_prompt, Some(metadata));

            match translator
                .translate_with_ai(vec![test_text.to_string()])
                .await
            {
                Ok(results) => {
                    let elapsed = start.elapsed().as_millis() as u64;
                    crate::app_log!("连接测试成功，响应时间: {}ms, 结果: {:?}", elapsed, results);

                    let logs = crate::services::get_prompt_logs();
                    if let Some(last_idx) = logs.len().checked_sub(1)
                        && !results.is_empty()
                    {
                        let response = format!("测试成功 ({}ms)\n结果: {}", elapsed, results[0]);
                        crate::services::update_prompt_response(last_idx, response);
                    }

                    Ok(TestConnectionResult {
                        success: true,
                        message: format!("连接成功 ({})", provider_display_name),
                        response_time_ms: Some(elapsed),
                    })
                }
                Err(e) => {
                    crate::app_log!("API 调用失败: {}", e);
                    Ok(TestConnectionResult {
                        success: false,
                        message: format!("API 调用失败: {}", e),
                        response_time_ms: None,
                    })
                }
            }
        }
        Err(e) => {
            crate::app_log!("创建翻译器失败: {}", e);
            Ok(TestConnectionResult {
                success: false,
                message: format!("配置错误: {}", e),
                response_time_ms: None,
            })
        }
    }
}

// ========== 系统提示词管理 ==========

#[tauri::command]
pub async fn get_system_prompt() -> Result<String, String> {
    use crate::services::ai_translator::DEFAULT_SYSTEM_PROMPT;

    let draft = ConfigDraft::global().await;
    let config = draft.data();

    let prompt = config
        .system_prompt
        .clone()
        .unwrap_or_else(|| DEFAULT_SYSTEM_PROMPT.to_string());

    Ok(prompt)
}

#[tauri::command]
pub async fn update_system_prompt(prompt: String) -> Result<(), String> {
    let is_empty = prompt.trim().is_empty();

    let draft = ConfigDraft::global().await;

    // 修复死锁：在独立作用域内获取写锁
    {
        let mut draft_config = draft.draft();

        draft_config.system_prompt = if is_empty {
            crate::app_log!("[系统提示词] 清空自定义提示词，将使用默认提示词");
            None
        } else {
            crate::app_log!("[系统提示词] 设置自定义提示词 ({}字符)", prompt.len());
            Some(prompt)
        };
    }

    draft.apply().map_err(|e| {
        crate::app_log!("[系统提示词] 保存失败: {}", e);
        e.to_string()
    })?;

    crate::app_log!("[系统提示词] 更新成功");
    Ok(())
}

#[tauri::command]
pub async fn reset_system_prompt() -> Result<(), String> {
    let draft = ConfigDraft::global().await;

    // 修复死锁：在独立作用域内获取写锁
    {
        let mut draft_config = draft.draft();
        draft_config.system_prompt = None;
    }

    draft.apply().map_err(|e| e.to_string())?;

    crate::app_log!("系统提示词已重置为默认值");
    Ok(())
}
