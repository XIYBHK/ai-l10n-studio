use crate::services::{AIConfig, AITranslator, ConfigDraft};
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
            cfg.provider_id,
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
    crate::app_log!("🔄 [AI配置] 添加新配置，提供商: {:?}", config.provider_id);
    // 🔒 安全：掩码API密钥显示
    let masked_api_key = if config.api_key.starts_with("sk-") && config.api_key.len() > 8 {
        format!(
            "sk-***...***{}",
            &config.api_key[config.api_key.len() - 4..]
        )
    } else if config.api_key.len() > 8 {
        format!(
            "{}***...***{}",
            &config.api_key[..3],
            &config.api_key[config.api_key.len() - 3..]
        )
    } else {
        "***".to_string()
    };

    crate::app_log!(
        "📋 [AI配置] 配置详情: URL={}, Model={}, API Key={}",
        config.base_url.as_deref().unwrap_or("默认"),
        config.model.as_deref().unwrap_or("默认"),
        masked_api_key
    );

    let draft = ConfigDraft::global().await;

    // 在草稿上修改
    {
        let mut draft_config = draft.draft();
        let current_count = draft_config.ai_configs.len();
        crate::app_log!("📊 [AI配置] 添加前配置数量: {}", current_count);

        draft_config.add_ai_config(config);

        let new_count = draft_config.ai_configs.len();
        crate::app_log!("📊 [AI配置] 添加后配置数量: {}", new_count);
    }

    // 原子提交并保存
    draft.apply().map_err(|e| {
        crate::app_log!("❌ [AI配置] 保存配置失败: {}", e);
        e.to_string()
    })?;

    crate::app_log!("✅ [AI配置] 新增配置成功");
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
    crate::app_log!("🔄 [AI配置] 设置启用配置，索引: {}", index);

    let draft = ConfigDraft::global().await;

    // 在草稿上修改
    {
        let mut draft_config = draft.draft();
        let total_configs = draft_config.ai_configs.len();
        crate::app_log!(
            "📊 [AI配置] 当前配置总数: {}, 目标索引: {}",
            total_configs,
            index
        );

        if index >= total_configs {
            crate::app_log!("❌ [AI配置] 索引超出范围: {} >= {}", index, total_configs);
            return Err(format!("配置索引超出范围: {} >= {}", index, total_configs));
        }

        draft_config.set_active_ai_config(index).map_err(|e| {
            crate::app_log!("❌ [AI配置] 设置启用配置失败: {}", e);
            e.to_string()
        })?;
    }

    // 原子提交并保存
    draft.apply().map_err(|e| {
        crate::app_log!("❌ [AI配置] 保存配置失败: {}", e);
        e.to_string()
    })?;

    crate::app_log!("✅ [AI配置] 设置启用配置成功，索引: {}", index);
    Ok(())
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")] // 🔧 序列化时使用 camelCase 命名，与前端保持一致
pub struct TestConnectionRequest {
    pub provider_id: String, // 🔧 插件化：使用 provider_id 字符串
    pub api_key: String,
    pub base_url: Option<String>,
    pub model: Option<String>,
    pub proxy: Option<crate::services::ProxyConfig>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")] // 🔧 序列化时使用 camelCase 命名，与前端保持一致
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

    crate::app_log!("🔍 测试 AI 连接: {:?}", request.provider_id);

    let ai_config = AIConfig {
        provider_id: request.provider_id.clone(),
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

            // 获取供应商显示名称
            let provider_display_name = {
                use crate::services::ai::provider::with_global_registry;
                with_global_registry(|registry| {
                    registry.get_provider_info(&ai_config.provider_id)
                        .map(|info| info.display_name)
                        .unwrap_or_else(|| ai_config.provider_id.clone())
                })
            };

            let metadata = serde_json::json!({
                "provider": provider_display_name,
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
                    if let Some(last_idx) = logs.len().checked_sub(1)
                        && !results.is_empty()
                    {
                        let response = format!("✅ 测试成功 ({}ms)\n结果: {}", elapsed, results[0]);
                        crate::services::update_prompt_response(last_idx, response);
                    }

                    Ok(TestConnectionResult {
                        success: true,
                        message: format!("连接成功 ({})", provider_display_name),
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

    crate::app_log!("🔄 [系统提示词] 获取系统提示词");

    let draft = ConfigDraft::global().await;
    let config = draft.data();

    // 返回自定义提示词，如果没有则返回默认提示词
    let prompt = config
        .system_prompt
        .clone()
        .unwrap_or_else(|| DEFAULT_SYSTEM_PROMPT.to_string());

    let is_custom = config.system_prompt.is_some();
    let prompt_len = prompt.len();
    crate::app_log!(
        "📄 [系统提示词] 返回提示词: {} (长度: {} 字符)",
        if is_custom { "自定义" } else { "默认" },
        prompt_len
    );

    Ok(prompt)
}

/// 更新系统提示词
#[tauri::command]
pub async fn update_system_prompt(prompt: String) -> Result<(), String> {
    let prompt_len = prompt.len();
    let is_empty = prompt.trim().is_empty();
    crate::app_log!(
        "🔄 [系统提示词] 更新系统提示词: {} (长度: {} 字符)",
        if is_empty {
            "清空"
        } else {
            "设置自定义"
        },
        prompt_len
    );

    let draft = ConfigDraft::global().await;

    // 在草稿上修改
    {
        let mut draft_config = draft.draft();
        let old_prompt_exists = draft_config.system_prompt.is_some();

        draft_config.system_prompt = if is_empty {
            crate::app_log!("🗑️ [系统提示词] 清空自定义提示词，将使用默认提示词");
            None
        } else {
            crate::app_log!("📝 [系统提示词] 设置自定义提示词 ({}字符)", prompt.len());
            Some(prompt)
        };

        crate::app_log!(
            "📊 [系统提示词] 状态变化: {} -> {}",
            if old_prompt_exists {
                "自定义"
            } else {
                "默认"
            },
            if draft_config.system_prompt.is_some() {
                "自定义"
            } else {
                "默认"
            }
        );
    }

    // 原子提交并保存
    draft.apply().map_err(|e| {
        crate::app_log!("❌ [系统提示词] 保存失败: {}", e);
        e.to_string()
    })?;

    crate::app_log!("✅ [系统提示词] 更新成功");
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
