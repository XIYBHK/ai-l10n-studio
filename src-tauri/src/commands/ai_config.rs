use crate::services::{AIConfig, AITranslator, ConfigDraft};
use crate::wrap_err; // 错误处理宏
use serde::{Deserialize, Serialize};

/// 获取所有 AI 配置
#[tauri::command]
pub async fn get_all_ai_configs() -> Result<Vec<AIConfig>, String> {
    let draft = ConfigDraft::global().await;
    let config = draft.data();
    let configs = config.get_all_ai_configs().clone();

    // 调试：打印配置内容
    for (i, cfg) in configs.iter().enumerate() {
        tracing::info!(
            "配置 #{}: provider={:?}, has_api_key={}, base_url={:?}, model={:?}",
            i,
            cfg.provider,
            !cfg.api_key.is_empty(),
            cfg.base_url,
            cfg.model
        );
    }

    Ok(configs)
}

/// 获取当前启用的 AI 配置
#[tauri::command]
pub async fn get_active_ai_config() -> Result<Option<AIConfig>, String> {
    let draft = ConfigDraft::global().await;
    let config = draft.data();
    Ok(config.get_active_ai_config().cloned())
}

/// 添加新的 AI 配置
#[tauri::command]
pub async fn add_ai_config(config: AIConfig) -> Result<(), String> {
    let draft = ConfigDraft::global().await;

    // 在草稿上修改
    {
        let mut draft_config = draft.draft();
        draft_config.add_ai_config(config);
    }

    // 原子提交并保存
    draft.apply().map_err(|e| e.to_string())?;

    crate::app_log!("✅ 新增 AI 配置成功");
    Ok(())
}

/// 更新指定索引的 AI 配置
#[tauri::command]
pub async fn update_ai_config(index: usize, config: AIConfig) -> Result<(), String> {
    let draft = ConfigDraft::global().await;

    // 在草稿上修改
    {
        let mut draft_config = draft.draft();
        draft_config
            .update_ai_config(index, config)
            .map_err(|e| e.to_string())?;
    }

    // 原子提交并保存
    draft.apply().map_err(|e| e.to_string())?;

    crate::app_log!("✅ 更新 AI 配置成功，索引: {}", index);
    Ok(())
}

/// 删除指定索引的 AI 配置
#[tauri::command]
pub async fn remove_ai_config(index: usize) -> Result<(), String> {
    let draft = ConfigDraft::global().await;

    // 在草稿上修改
    {
        let mut draft_config = draft.draft();
        draft_config
            .remove_ai_config(index)
            .map_err(|e| e.to_string())?;
    }

    // 原子提交并保存
    draft.apply().map_err(|e| e.to_string())?;

    crate::app_log!("✅ 删除 AI 配置成功，索引: {}", index);
    Ok(())
}

/// 设置启用的 AI 配置
#[tauri::command]
pub async fn set_active_ai_config(index: usize) -> Result<(), String> {
    let draft = ConfigDraft::global().await;

    // 在草稿上修改
    {
        let mut draft_config = draft.draft();
        draft_config
            .set_active_ai_config(index)
            .map_err(|e| e.to_string())?;
    }

    // 原子提交并保存
    draft.apply().map_err(|e| e.to_string())?;

    crate::app_log!("✅ 设置启用配置成功，索引: {}", index);
    Ok(())
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TestConnectionRequest {
    pub provider: crate::services::ProviderType,
    pub api_key: String,
    pub base_url: Option<String>,
    pub model: Option<String>,
    pub proxy: Option<crate::services::ProxyConfig>,
}

#[derive(Debug, Serialize)]
pub struct TestConnectionResult {
    pub success: bool,
    pub message: String,
    pub response_time_ms: Option<u64>,
}

/// 测试 AI 连接
#[tauri::command]
pub async fn test_ai_connection(
    request: TestConnectionRequest,
) -> Result<TestConnectionResult, String> {
    use std::time::Instant;

    crate::app_log!("🔍 测试 AI 连接: {:?}", request.provider);

    let ai_config = AIConfig {
        provider: request.provider,
        api_key: request.api_key,
        base_url: request.base_url,
        model: request.model,
        proxy: request.proxy,
    };

    let start = Instant::now();

    // 测试连接时不使用TM、自定义提示词和目标语言
    match AITranslator::new_with_config(ai_config.clone(), false, None, None) {
        Ok(mut translator) => {
            // 直接调用底层的translate_with_ai方法，绕过TM和去重逻辑
            crate::app_log!("[连接测试] 直接调用AI API，绕过TM和去重");
            let test_text = "The answer to life, universe and everything?";

            // 记录连接测试的完整AI请求（JSON格式）
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
                "temperature": 0.3
            });

            let full_prompt = format!(
                "【真实AI请求】:\n{}",
                serde_json::to_string_pretty(&request_json)
                    .unwrap_or_else(|_| "JSON序列化失败".to_string())
            );

            let metadata = serde_json::json!({
                "provider": ai_config.provider.display_name(),
                "model": ai_config.model.clone(),
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
                    crate::app_log!(
                        "✅ 连接测试成功，响应时间: {}ms, 结果: {:?}",
                        elapsed,
                        results
                    );

                    // 更新提示词日志的响应
                    let logs = crate::services::get_prompt_logs();
                    if let Some(last_idx) = logs.len().checked_sub(1) {
                        if !results.is_empty() {
                            let response =
                                format!("✅ 测试成功 ({}ms)\n结果: {}", elapsed, results[0]);
                            crate::services::update_prompt_response(last_idx, response);
                        }
                    }

                    Ok(TestConnectionResult {
                        success: true,
                        message: format!("连接成功 ({})", ai_config.provider.display_name()),
                        response_time_ms: Some(elapsed),
                    })
                }
                Err(e) => {
                    crate::app_log!("❌ API 调用失败: {}", e);
                    Ok(TestConnectionResult {
                        success: false,
                        message: format!("API 调用失败: {}", e),
                        response_time_ms: None,
                    })
                }
            }
        }
        Err(e) => {
            crate::app_log!("❌ 创建翻译器失败: {}", e);
            Ok(TestConnectionResult {
                success: false,
                message: format!("配置错误: {}", e),
                response_time_ms: None,
            })
        }
    }
}

// ========== Phase 3: 系统提示词管理 ==========

/// 获取系统提示词（返回自定义提示词或默认提示词）
#[tauri::command]
pub async fn get_system_prompt() -> Result<String, String> {
    use crate::services::ai_translator::DEFAULT_SYSTEM_PROMPT;

    let draft = ConfigDraft::global().await;
    let config = draft.data();

    // 返回自定义提示词，如果没有则返回默认提示词
    Ok(config
        .system_prompt
        .clone()
        .unwrap_or_else(|| DEFAULT_SYSTEM_PROMPT.to_string()))
}

/// 更新系统提示词
#[tauri::command]
pub async fn update_system_prompt(prompt: String) -> Result<(), String> {
    let draft = ConfigDraft::global().await;

    // 在草稿上修改
    {
        let mut draft_config = draft.draft();
        draft_config.system_prompt = if prompt.trim().is_empty() {
            None
        } else {
            Some(prompt)
        };
    }

    // 原子提交并保存
    draft.apply().map_err(|e| e.to_string())?;

    crate::app_log!("✅ 系统提示词已更新");
    Ok(())
}

/// 重置系统提示词为默认值
#[tauri::command]
pub async fn reset_system_prompt() -> Result<(), String> {
    let draft = ConfigDraft::global().await;

    // 在草稿上修改
    {
        let mut draft_config = draft.draft();
        draft_config.system_prompt = None;
    }

    // 原子提交并保存
    draft.apply().map_err(|e| e.to_string())?;

    crate::app_log!("✅ 系统提示词已重置为默认值");
    Ok(())
}
