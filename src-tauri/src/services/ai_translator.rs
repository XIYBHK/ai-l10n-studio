use anyhow::{Result, anyhow};
use reqwest::Client as HttpClient;
use serde::{Deserialize, Serialize};
// use std::collections::HashMap;

use crate::services::term_library::TermLibrary;
use crate::services::translation_memory::TranslationMemory;
use crate::utils::common::is_simple_phrase;
use crate::utils::paths::get_translation_memory_path;

#[cfg(feature = "ts-rs")]
use ts_rs::TS;

// ========== 默认系统提示词 (Phase 3) ==========

pub const DEFAULT_SYSTEM_PROMPT: &str = r#"专业游戏本地化翻译。
规则:
1. 术语保留英文: Actor/Blueprint/Component/Transform/Mesh/Material/Widget/Collision/Array/Float/Integer
2. 固定翻译: Asset→资产, Unique→去重, Slice→截取, Primitives→基础类型, Constant Speed→匀速, Stream→流送, Ascending→升序, Descending→降序
3. Category: 保持XTools等命名空间和|符号, 如 XTools|Sort|Actor → XTools|排序|Actor
4. 保留所有特殊符号: |、{}、%%、[]、()、\n、\t、{0}、{1}等
5. 特殊表达: in-place→原地, by value→按值, True/False保持原样"#;

// ========== Phase 1: AI 供应商配置系统 ==========

/// AI 供应商类型
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts-rs", derive(TS))]
#[cfg_attr(feature = "ts-rs", ts(export, export_to = "../src/types/generated/"))]
pub enum ProviderType {
    Moonshot,
    OpenAI,
    SparkDesk, // 讯飞星火
    Wenxin,    // 百度文心一言
    Qianwen,   // 阿里通义千问
    GLM,       // 智谱AI
    Claude,    // Anthropic
    Gemini,    // Google
}

impl ProviderType {
    /// 获取默认API地址
    pub fn default_url(&self) -> &str {
        match self {
            Self::Moonshot => "https://api.moonshot.cn/v1",
            Self::OpenAI => "https://api.openai.com/v1",
            Self::SparkDesk => "https://spark-api.xf-yun.com/v1",
            Self::Wenxin => "https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop",
            Self::Qianwen => "https://dashscope.aliyuncs.com/api/v1",
            Self::GLM => "https://open.bigmodel.cn/api/paas/v4",
            Self::Claude => "https://api.anthropic.com/v1",
            Self::Gemini => "https://generativelanguage.googleapis.com/v1",
        }
    }

    /// 获取显示名称
    pub fn display_name(&self) -> &str {
        match self {
            Self::Moonshot => "Moonshot AI",
            Self::OpenAI => "OpenAI",
            Self::SparkDesk => "讯飞星火",
            Self::Wenxin => "百度文心一言",
            Self::Qianwen => "阿里通义千问",
            Self::GLM => "智谱AI (GLM)",
            Self::Claude => "Claude (Anthropic)",
            Self::Gemini => "Google Gemini",
        }
    }

    /// 获取默认模型
    pub fn default_model(&self) -> &str {
        match self {
            Self::Moonshot => "moonshot-v1-auto",
            Self::OpenAI => "gpt-3.5-turbo",
            Self::SparkDesk => "generalv3.5",
            Self::Wenxin => "ernie-bot-turbo",
            Self::Qianwen => "qwen-turbo",
            Self::GLM => "glm-4",
            Self::Claude => "claude-3-haiku-20240307",
            Self::Gemini => "gemini-pro",
        }
    }

    /// 获取该供应商的所有可用模型
    pub fn get_models(&self) -> Vec<crate::services::ai::ModelInfo> {
        use crate::services::ai::models;
        match self {
            Self::OpenAI => models::get_openai_models(),
            Self::Moonshot => models::get_moonshot_models(),
            Self::SparkDesk => models::get_deepseek_models(), // TODO: 创建独立的 SparkDesk 模型定义
            Self::Wenxin => models::get_deepseek_models(),    // TODO: 创建独立的 Wenxin 模型定义
            Self::Qianwen => models::get_deepseek_models(),   // TODO: 创建独立的 Qianwen 模型定义
            Self::GLM => models::get_deepseek_models(),       // TODO: 创建独立的 GLM 模型定义
            Self::Claude => models::get_deepseek_models(),    // TODO: 创建独立的 Claude 模型定义
            Self::Gemini => models::get_deepseek_models(),    // TODO: 创建独立的 Gemini 模型定义
        }
    }

    /// 根据模型ID获取模型信息
    pub fn get_model_info(&self, model_id: &str) -> Option<crate::services::ai::ModelInfo> {
        self.get_models().into_iter().find(|m| m.id == model_id)
    }
}

/// 代理配置
#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "ts-rs", derive(TS))]
#[cfg_attr(feature = "ts-rs", ts(export, export_to = "../src/types/generated/"))]
pub struct ProxyConfig {
    pub host: String,
    pub port: u16,
    pub enabled: bool,
}

/// AI 配置（简化版）
#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "ts-rs", derive(TS))]
#[cfg_attr(feature = "ts-rs", ts(export, export_to = "../src/types/generated/"))]
pub struct AIConfig {
    pub provider: ProviderType,
    pub api_key: String,
    pub base_url: Option<String>, // 可选的自定义URL
    pub model: Option<String>,    // 可选的自定义模型
    pub proxy: Option<ProxyConfig>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "ts-rs", derive(TS))]
#[cfg_attr(feature = "ts-rs", ts(export, export_to = "../src/types/generated/"))]
pub struct TokenStats {
    pub input_tokens: u32,
    pub output_tokens: u32,
    pub total_tokens: u32,
    pub cost: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ChatMessage {
    role: String,
    content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ChatRequest {
    model: String,
    messages: Vec<ChatMessage>,
    temperature: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ChatResponse {
    choices: Vec<Choice>,
    usage: Option<Usage>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct Choice {
    message: ChatMessage,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct Usage {
    prompt_tokens: u32,
    completion_tokens: u32,
    total_tokens: u32,
}

#[derive(Debug, Clone)]
pub struct AITranslator {
    client: HttpClient,
    api_key: String,
    base_url: String,
    model: String,
    provider: ProviderType, // 🔧 添加：保存 provider 类型用于费用计算
    system_prompt: String,
    conversation_history: Vec<ChatMessage>,
    max_history_tokens: usize,
    token_stats: TokenStats,
    use_tm: bool,
    tm: Option<TranslationMemory>,
    // Phase 5: 目标语言（用于生成翻译提示词）
    target_language: Option<String>,
    // 统计信息
    pub batch_stats: BatchStats,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchStats {
    pub total: usize,
    pub tm_hits: usize,
    pub deduplicated: usize,
    pub ai_translated: usize,
    pub tm_learned: usize,
}

impl AITranslator {
    /// 原有构造函数（Phase 3: 支持自定义提示词，Phase 5: 支持目标语言）
    pub fn new(
        api_key: String,
        base_url: Option<String>,
        use_tm: bool,
        custom_system_prompt: Option<&str>,
        target_language: Option<String>,
    ) -> Result<Self> {
        let client = HttpClient::new();
        let base_url = base_url.unwrap_or_else(|| "https://api.moonshot.cn/v1".to_string());

        // 加载术语库并构建系统提示词
        let term_library_path = std::env::current_exe()
            .ok()
            .and_then(|p| p.parent().map(|p| p.to_path_buf()))
            .unwrap_or_else(|| std::path::PathBuf::from("."))
            .join("data")
            .join("term_library.json");

        let term_library = TermLibrary::load_from_file(&term_library_path).ok();

        // 🔍 调试日志：检查术语库状态
        if let Some(ref lib) = term_library {
            crate::app_log!(
                "[AITranslator] 加载术语库: {} 条术语, 风格总结: {}",
                lib.terms.len(),
                if lib.style_summary.is_some() {
                    "有"
                } else {
                    "无"
                }
            );
        } else {
            crate::app_log!("[AITranslator] 术语库文件不存在或加载失败");
        }

        let system_prompt = Self::get_system_prompt(custom_system_prompt, term_library.as_ref());

        // 从文件加载TM（合并内置短语和已保存的翻译）
        let tm = if use_tm {
            Some(TranslationMemory::new_from_file(
                &get_translation_memory_path(),
            )?)
        } else {
            None
        };

        Ok(Self {
            client,
            api_key,
            base_url,
            model: "moonshot-v1-auto".to_string(),
            provider: ProviderType::Moonshot, // 🔧 默认使用 Moonshot
            system_prompt,
            conversation_history: Vec::new(),
            max_history_tokens: 2000,
            token_stats: TokenStats {
                input_tokens: 0,
                output_tokens: 0,
                total_tokens: 0,
                cost: 0.0,
            },
            use_tm,
            tm,
            target_language, // Phase 5: 目标语言
            batch_stats: BatchStats {
                total: 0,
                tm_hits: 0,
                deduplicated: 0,
                ai_translated: 0,
                tm_learned: 0,
            },
        })
    }

    /// 使用 AIConfig 创建（Phase 3: 支持自定义提示词，Phase 5: 支持目标语言）
    pub fn new_with_config(
        config: AIConfig,
        use_tm: bool,
        custom_system_prompt: Option<&str>,
        target_language: Option<String>,
    ) -> Result<Self> {
        // 构建HTTP客户端（支持代理）
        let client = Self::build_client_with_proxy(config.proxy.clone())?;

        // 使用自定义URL或默认URL
        let base_url = config
            .base_url
            .unwrap_or_else(|| config.provider.default_url().to_string());

        // 使用自定义模型或默认模型
        let model = config
            .model
            .unwrap_or_else(|| config.provider.default_model().to_string());

        // 加载术语库并构建系统提示词
        let term_library_path = std::env::current_exe()
            .ok()
            .and_then(|p| p.parent().map(|p| p.to_path_buf()))
            .unwrap_or_else(|| std::path::PathBuf::from("."))
            .join("data")
            .join("term_library.json");

        let term_library = TermLibrary::load_from_file(&term_library_path).ok();

        // 🔍 调试日志：检查术语库状态
        if let Some(ref lib) = term_library {
            crate::app_log!(
                "[AITranslator] 加载术语库: {} 条术语, 风格总结: {}",
                lib.terms.len(),
                if lib.style_summary.is_some() {
                    "有"
                } else {
                    "无"
                }
            );
        } else {
            crate::app_log!("[AITranslator] 术语库文件不存在或加载失败");
        }

        let system_prompt = Self::get_system_prompt(custom_system_prompt, term_library.as_ref());

        // 从文件加载TM
        let tm = if use_tm {
            Some(TranslationMemory::new_from_file(
                &get_translation_memory_path(),
            )?)
        } else {
            None
        };

        crate::app_log!(
            "[AI翻译器] 使用配置创建: 供应商={}, 模型={}, 代理={}",
            config.provider.display_name(),
            model,
            if config.proxy.as_ref().map(|p| p.enabled).unwrap_or(false) {
                "已启用"
            } else {
                "未启用"
            }
        );

        Ok(Self {
            client,
            api_key: config.api_key,
            base_url,
            model,
            provider: config.provider, // 🔧 保存 provider
            system_prompt,
            conversation_history: Vec::new(),
            max_history_tokens: 2000,
            token_stats: TokenStats {
                input_tokens: 0,
                output_tokens: 0,
                total_tokens: 0,
                cost: 0.0,
            },
            use_tm,
            tm,
            target_language, // Phase 5: 目标语言
            batch_stats: BatchStats {
                total: 0,
                tm_hits: 0,
                deduplicated: 0,
                ai_translated: 0,
                tm_learned: 0,
            },
        })
    }

    /// 构建支持代理的HTTP客户端
    fn build_client_with_proxy(proxy: Option<ProxyConfig>) -> Result<HttpClient> {
        let mut builder = HttpClient::builder();

        // 检查是否需要启用代理
        let should_use_proxy = proxy.as_ref().map(|p| p.enabled).unwrap_or(false);

        if should_use_proxy {
            if let Some(proxy_cfg) = proxy {
                let proxy_url = format!("http://{}:{}", proxy_cfg.host, proxy_cfg.port);
                crate::app_log!("[AI翻译器] 使用代理: {}", proxy_url);

                let proxy =
                    reqwest::Proxy::all(&proxy_url).map_err(|e| anyhow!("代理配置错误: {}", e))?;
                builder = builder.proxy(proxy);
            }
        } else {
            // 🔧 关键修复：显式禁用代理，防止 reqwest 自动读取系统环境变量
            crate::app_log!("[AI翻译器] 代理已禁用（忽略系统代理设置）");
            builder = builder.no_proxy();
        }

        builder
            .build()
            .map_err(|e| anyhow!("HTTP客户端构建失败: {}", e))
    }

    /// Phase 3: 构建系统提示词（支持自定义 + 术语库拼接）
    ///
    /// custom_prompt: 用户自定义的基础提示词（None则使用DEFAULT_SYSTEM_PROMPT）
    /// term_library: 术语库（用于拼接风格总结）
    fn get_system_prompt(
        custom_prompt: Option<&str>,
        term_library: Option<&TermLibrary>,
    ) -> String {
        // 使用自定义提示词或默认提示词
        let base_prompt = custom_prompt.unwrap_or(DEFAULT_SYSTEM_PROMPT);

        // 如果有术语库的风格总结，注入到提示词中
        if let Some(library) = term_library {
            if let Some(style_summary) = &library.style_summary {
                return format!(
                    "{}\n\n【用户翻译风格偏好】（基于{}条术语学习）\n{}",
                    base_prompt, style_summary.based_on_terms, style_summary.prompt
                );
            }
        }

        base_prompt.to_string()
    }

    pub async fn translate_batch_with_callbacks(
        &mut self,
        texts: Vec<String>,
        progress_callback: Option<Box<dyn Fn(usize, String) + Send + Sync>>,
        stats_callback: Option<Box<dyn Fn(BatchStats, TokenStats) + Send + Sync>>,
    ) -> Result<Vec<String>> {
        self.translate_batch_internal(texts, progress_callback, Some(stats_callback), None)
            .await
    }

    pub async fn translate_batch(
        &mut self,
        texts: Vec<String>,
        progress_callback: Option<Box<dyn Fn(usize, String) + Send + Sync>>,
    ) -> Result<Vec<String>> {
        let (translations, _sources) = self
            .translate_batch_with_sources(texts, progress_callback, None)
            .await?;
        Ok(translations)
    }

    /// 翻译并返回每个条目的来源
    pub async fn translate_batch_with_sources(
        &mut self,
        texts: Vec<String>,
        progress_callback: Option<Box<dyn Fn(usize, String) + Send + Sync>>,
        stats_callback: Option<Option<Box<dyn Fn(BatchStats, TokenStats) + Send + Sync>>>,
    ) -> Result<(Vec<String>, Vec<String>)> {
        if texts.is_empty() {
            return Ok((Vec::new(), Vec::new()));
        }

        // 初始化来源跟踪
        let mut sources = vec![String::from("unknown"); texts.len()];

        let translations = self
            .translate_batch_internal(texts, progress_callback, stats_callback, Some(&mut sources))
            .await?;
        Ok((translations, sources))
    }

    async fn translate_batch_internal(
        &mut self,
        texts: Vec<String>,
        progress_callback: Option<Box<dyn Fn(usize, String) + Send + Sync>>,
        stats_callback: Option<Option<Box<dyn Fn(BatchStats, TokenStats) + Send + Sync>>>,
        mut sources: Option<&mut Vec<String>>, // 可选的来源跟踪
    ) -> Result<Vec<String>> {
        if texts.is_empty() {
            return Ok(Vec::new());
        }

        // 🔍 调试：检查回调是否传入
        if progress_callback.is_some() {
            crate::app_log!("[translate_batch] ✅ progress_callback 已传入");
        } else {
            crate::app_log!("[translate_batch] ℹ️ progress_callback 为 None（内部调用）");
        }

        // 重置统计
        self.batch_stats.total = texts.len();
        self.batch_stats.tm_hits = 0;
        self.batch_stats.deduplicated = 0;
        self.batch_stats.ai_translated = 0;
        self.batch_stats.tm_learned = 0;

        // Step 1: 使用翻译记忆库进行预翻译 + 去重（保持顺序）
        let mut result = vec![String::new(); texts.len()];
        let mut untranslated_indices = Vec::new();

        let mut unique_texts_ordered: Vec<String> = Vec::new();
        let mut unique_text_to_indices: std::collections::HashMap<String, Vec<usize>> =
            std::collections::HashMap::new();

        if let Some(ref mut tm) = self.tm {
            for (i, text) in texts.iter().enumerate() {
                if let Some(translation) = tm.get_translation(text) {
                    // TM命中
                    result[i] = translation.clone();
                    self.batch_stats.tm_hits += 1;
                    // 记录来源为TM
                    if let Some(ref mut sources_vec) = sources {
                        sources_vec[i] = String::from("tm");
                    }
                    // ❌ 此处不再上报进度，避免乱序
                } else {
                    // TM未命中，记录到去重map
                    untranslated_indices.push(i);

                    if !unique_text_to_indices.contains_key(text) {
                        unique_texts_ordered.push(text.clone());
                    }
                    unique_text_to_indices
                        .entry(text.clone())
                        .or_insert_with(Vec::new)
                        .push(i);
                }
            }
        } else {
            // 没有TM，直接去重
            for (i, text) in texts.iter().enumerate() {
                untranslated_indices.push(i);

                if !unique_text_to_indices.contains_key(text) {
                    unique_texts_ordered.push(text.clone());
                }
                unique_text_to_indices
                    .entry(text.clone())
                    .or_insert_with(Vec::new)
                    .push(i);
            }
        }

        let untranslated_count = texts.len() - self.batch_stats.tm_hits;
        let unique_count = unique_texts_ordered.len();
        self.batch_stats.deduplicated = untranslated_count - unique_count;

        // 📊 TM处理完成后推送第一次统计更新
        if let Some(ref stats_cb_opt) = stats_callback {
            if let Some(stats_cb) = stats_cb_opt {
                let current_stats = self.batch_stats.clone();
                let current_token_stats = self.token_stats.clone();
                stats_cb(current_stats, current_token_stats);
            }
        }

        // Step 2: 分批翻译去重后的文本
        if !unique_texts_ordered.is_empty() {
            let unique_list = unique_texts_ordered.clone();
            crate::app_log!(
                "[预处理] 原始{}条 -> TM命中{}条 -> 待翻译{}条 -> 去重节省{}条",
                texts.len(),
                self.batch_stats.tm_hits,
                untranslated_count,
                self.batch_stats.deduplicated
            );

            const BATCH_SIZE: usize = 25;
            let mut ai_translations = Vec::new();
            let total_batches = (unique_list.len() + BATCH_SIZE - 1) / BATCH_SIZE;

            for (batch_idx, chunk) in unique_list.chunks(BATCH_SIZE).enumerate() {
                crate::app_log!(
                    "[分批翻译] 批次 {}/{}, 当前批{}条",
                    batch_idx + 1,
                    total_batches,
                    chunk.len()
                );

                if batch_idx == 0 {
                    let sample_size = std::cmp::min(3, chunk.len());
                    let sample_texts: Vec<String> =
                        chunk.iter().take(sample_size).cloned().collect();
                    let user_prompt = self.build_user_prompt(&sample_texts);

                    // 构建提示词日志（只显示实际发送给AI的内容，不包括API参数）
                    let full_prompt = format!(
                        "【System Prompt】:\n{}\n【User Prompt】:\n{}",
                        self.current_system_prompt(),
                        user_prompt
                    );

                    let metadata = serde_json::json!({
                        "batch_index": batch_idx + 1,
                        "total_batches": total_batches,
                        "batch_size": chunk.len(),
                        "sample_size": sample_size,
                        "total_items": chunk.len(),
                        "sample_texts": sample_texts,
                        "model": self.model,
                        "temperature": 0.3,
                        "provider": self.provider.display_name(),
                    });
                    crate::services::log_prompt("批量翻译", full_prompt, Some(metadata));
                }

                let batch_translations = self.translate_with_ai(chunk.to_vec()).await?;

                if batch_idx == 0 {
                    let logs = crate::services::get_prompt_logs();
                    if let Some(last_idx) = logs.len().checked_sub(1) {
                        if !batch_translations.is_empty() {
                            let sample_size = std::cmp::min(3, batch_translations.len());
                            let sample_results: Vec<String> = batch_translations
                                .iter()
                                .take(sample_size)
                                .cloned()
                                .collect();
                            let mut response = format!(
                                "批次翻译结果（总 {} 条，显示前 {} 条）:\n",
                                batch_translations.len(),
                                sample_size
                            );
                            for (i, result) in sample_results.iter().enumerate() {
                                response.push_str(&format!("{}. {}\n", i + 1, result));
                            }
                            crate::services::update_prompt_response(last_idx, response);
                        }
                    }
                }

                ai_translations.extend(batch_translations);

                if let Some(ref stats_cb_opt) = stats_callback {
                    if let Some(stats_cb) = stats_cb_opt {
                        let current_stats = self.batch_stats.clone();
                        let current_token_stats = self.token_stats.clone();
                        stats_cb(current_stats, current_token_stats);
                    }
                }
            }

            self.batch_stats.ai_translated = unique_list.len();

            // Step 3: 将翻译结果分发到所有对应的索引
            for (unique_text, translation) in unique_list.iter().zip(ai_translations.iter()) {
                if let Some(indices) = unique_text_to_indices.get(unique_text) {
                    for (local_idx, &idx) in indices.iter().enumerate() {
                        result[idx] = translation.clone();
                        // 记录来源：第一个是AI翻译，其余是去重
                        if let Some(ref mut sources_vec) = sources {
                            sources_vec[idx] = if local_idx == 0 {
                                String::from("ai")
                            } else {
                                String::from("dedup")
                            };
                        }
                        // ❌ 此处不再上报进度，避免乱序
                    }
                }

                // Step 4: 更新翻译记忆库（每个unique文本只学习一次）
                if let Some(ref mut tm) = self.tm {
                    if is_simple_phrase(unique_text) && translation.len() <= 50 {
                        let builtin = crate::services::translation_memory::get_builtin_memory();
                        let exists_in_learned = tm.memory.contains_key(unique_text);
                        let exists_in_builtin = builtin.contains_key(unique_text);

                        if !exists_in_learned && !exists_in_builtin {
                            tm.add_translation(unique_text.clone(), translation.clone());
                            self.batch_stats.tm_learned += 1;
                            crate::app_log!("[TM学习] {} -> {}", unique_text, translation);
                        } else if exists_in_builtin {
                            crate::app_log!("[TM跳过] {} (已在内置词库)", unique_text);
                        } else {
                            crate::app_log!("[TM跳过] {} (已在学习记录)", unique_text);
                        }
                    }
                }
            }
        }

        // ✨ Step 5: 修复 - 在所有翻译完成后，按顺序统一上报进度
        if let Some(ref callback) = progress_callback {
            for (i, text) in texts.iter().enumerate() {
                if !result[i].is_empty() {
                    callback(i, result[i].clone());
                }
            }
        }

        crate::app_log!(
            "[统计] 总{}条 | TM命中{}条 | 去重节省{}条 | AI翻译{}条 | 学习{}条",
            self.batch_stats.total,
            self.batch_stats.tm_hits,
            self.batch_stats.deduplicated,
            self.batch_stats.ai_translated,
            self.batch_stats.tm_learned
        );

        // 📊 最终统计更新（包含TM学习数量）
        if let Some(ref stats_cb_opt) = stats_callback {
            if let Some(stats_cb) = stats_cb_opt {
                let final_stats = self.batch_stats.clone();
                let final_token_stats = self.token_stats.clone();
                stats_cb(final_stats, final_token_stats);
            }
        }

        Ok(result)
    }

    /// 使用自定义的用户提示词进行翻译（不使用标准提示词模板）
    /// 用于精翻等场景，提示词已经完整构建好
    pub async fn translate_with_custom_user_prompt(
        &mut self,
        user_prompt: String,
    ) -> Result<String> {
        // 构建消息数组
        let messages = if self.conversation_history.is_empty() {
            vec![
                ChatMessage {
                    role: "system".to_string(),
                    content: self.system_prompt.clone(),
                },
                ChatMessage {
                    role: "user".to_string(),
                    content: user_prompt.clone(),
                },
            ]
        } else {
            let mut msgs = self.conversation_history.clone();
            msgs.push(ChatMessage {
                role: "user".to_string(),
                content: user_prompt.clone(),
            });
            msgs
        };

        // 发送请求（带重试机制）
        let request = ChatRequest {
            model: self.model.clone(),
            messages,
            temperature: 0.3,
        };

        // 最多重试3次，指数退避策略
        let max_retries = 3;
        let mut chat_response: Option<ChatResponse> = None;
        let mut last_error: Option<anyhow::Error> = None;

        for retry in 0..max_retries {
            match self
                .client
                .post(&format!("{}/chat/completions", self.base_url))
                .header("Authorization", format!("Bearer {}", self.api_key))
                .header("Content-Type", "application/json")
                .json(&request)
                .send()
                .await
            {
                Ok(response) => match response.json().await {
                    Ok(parsed) => {
                        chat_response = Some(parsed);
                        break;
                    }
                    Err(e) => {
                        last_error = Some(anyhow::anyhow!("error decoding response body"));
                        if retry < max_retries - 1 {
                            let delay = 2u64.pow(retry as u32);
                            crate::app_log!(
                                "[重试] 解析响应失败，{}秒后重试 ({}/{})",
                                delay,
                                retry + 1,
                                max_retries
                            );
                            tokio::time::sleep(std::time::Duration::from_secs(delay)).await;
                        }
                    }
                },
                Err(e) => {
                    last_error = Some(anyhow::anyhow!("request failed: {}", e));
                    if retry < max_retries - 1 {
                        let delay = 2u64.pow(retry as u32);
                        crate::app_log!(
                            "[重试] 请求失败，{}秒后重试 ({}/{})",
                            delay,
                            retry + 1,
                            max_retries
                        );
                        tokio::time::sleep(std::time::Duration::from_secs(delay)).await;
                    }
                }
            }
        }

        let chat_response = chat_response
            .ok_or_else(|| last_error.unwrap_or_else(|| anyhow::anyhow!("未知错误")))?;

        let assistant_response = chat_response
            .choices
            .first()
            .and_then(|choice| Some(choice.message.content.clone()))
            .ok_or_else(|| anyhow::anyhow!("AI响应为空"))?;

        // 更新对话历史（如果需要）
        self.update_conversation_history(&user_prompt, &assistant_response);

        // 返回原始响应（不做解析）
        Ok(assistant_response.trim().to_string())
    }

    pub async fn translate_with_ai(&mut self, texts: Vec<String>) -> Result<Vec<String>> {
        // 单元测试模拟：如果 api_key 是 test_key，则直接返回原文作为译文，跳过网络请求
        if self.api_key == "test_key" {
            crate::app_log!("[测试模拟] 检测到 test_key，返回模拟翻译结果。");
            return Ok(texts);
        }

        let user_prompt = self.build_user_prompt(&texts);

        // 构建消息数组
        let messages = if self.conversation_history.is_empty() {
            vec![
                ChatMessage {
                    role: "system".to_string(),
                    content: self.system_prompt.clone(),
                },
                ChatMessage {
                    role: "user".to_string(),
                    content: user_prompt.clone(),
                },
            ]
        } else {
            let mut msgs = self.conversation_history.clone();
            msgs.push(ChatMessage {
                role: "user".to_string(),
                content: user_prompt.clone(),
            });
            msgs
        };

        // 发送请求（带重试机制）
        let request = ChatRequest {
            model: self.model.clone(),
            messages,
            temperature: 0.3,
        };

        // 最多重试3次，指数退避策略
        let max_retries = 3;
        let mut chat_response: Option<ChatResponse> = None;
        let mut last_error: Option<anyhow::Error> = None;

        for retry in 0..max_retries {
            match self
                .client
                .post(&format!("{}/chat/completions", self.base_url))
                .header("Authorization", format!("Bearer {}", self.api_key))
                .header("Content-Type", "application/json")
                .json(&request)
                .send()
                .await
            {
                Ok(response) => {
                    let status = response.status();
                    // 先获取原始文本用于调试
                    match response.text().await {
                        Ok(body_text) => {
                            // 简化日志：只记录关键信息
                            if !status.is_success() {
                                // 错误时记录完整响应
                                crate::app_log!(
                                    "[API错误] 状态码: {}, 响应: {}",
                                    status,
                                    &body_text
                                );
                            } else {
                                // 成功时提取关键内容
                                let summary = if let Ok(json) =
                                    serde_json::from_str::<serde_json::Value>(&body_text)
                                {
                                    // 提取 AI 返回的实际内容
                                    if let Some(content) =
                                        json["choices"][0]["message"]["content"].as_str()
                                    {
                                        format!("内容: \"{}\"", content)
                                    } else {
                                        format!(
                                            "tokens: {}, cost: 参考usage字段",
                                            json["usage"]["total_tokens"].as_u64().unwrap_or(0)
                                        )
                                    }
                                } else {
                                    // JSON 解析失败，显示前100字符
                                    if body_text.len() > 100 {
                                        format!(
                                            "{}... ({} 字符)",
                                            &body_text[..100],
                                            body_text.len()
                                        )
                                    } else {
                                        body_text.clone()
                                    }
                                };
                                crate::app_log!("[API响应] {} OK, {}", status.as_u16(), summary);
                            }

                            // 检查是否是错误响应
                            if !status.is_success() {
                                // 尝试解析通用错误格式
                                let error_msg = if let Ok(error_json) =
                                    serde_json::from_str::<serde_json::Value>(&body_text)
                                {
                                    // 提取错误信息
                                    let extracted_msg = error_json["error"]["message"]
                                        .as_str()
                                        .or_else(|| error_json["message"].as_str())
                                        .or_else(|| error_json["error"].as_str())
                                        .unwrap_or("API请求失败");

                                    // 根据状态码和错误信息生成友好提示
                                    match status.as_u16() {
                                        401 => format!("API Key无效或已过期: {}", extracted_msg),
                                        403 => format!("API访问被拒绝: {}", extracted_msg),
                                        429 => {
                                            // 429 可能是频率超限，也可能是余额不足
                                            if extracted_msg.contains("余额")
                                                || extracted_msg.contains("资源包")
                                            {
                                                format!("账户余额不足: {}", extracted_msg)
                                            } else {
                                                format!("API请求频率超限: {}", extracted_msg)
                                            }
                                        }
                                        500..=599 => format!("AI服务器错误: {}", extracted_msg),
                                        _ => format!(
                                            "API请求失败({}): {}",
                                            status.as_u16(),
                                            extracted_msg
                                        ),
                                    }
                                } else {
                                    format!("API请求失败({}): {}", status.as_u16(), body_text)
                                };

                                crate::app_log!("[错误] {}", error_msg);
                                last_error = Some(anyhow!(error_msg));
                                break; // 错误响应不重试
                            }

                            // 尝试解析为ChatResponse
                            match serde_json::from_str::<ChatResponse>(&body_text) {
                                Ok(parsed) => {
                                    chat_response = Some(parsed);
                                    break;
                                }
                                Err(e) => {
                                    let error_msg = format!(
                                        "无法解析AI响应格式 (模型: {}): {}\n响应内容: {}",
                                        self.model,
                                        e,
                                        if body_text.len() > 500 {
                                            format!("{}...(已截断)", &body_text[..500])
                                        } else {
                                            body_text.clone()
                                        }
                                    );
                                    crate::app_log!("[错误] {}", error_msg);
                                    last_error = Some(anyhow!(error_msg));
                                    break; // 格式错误不重试
                                }
                            }
                        }
                        Err(e) => {
                            let error_msg = format!("读取响应体失败: {}", e);
                            crate::app_log!("[错误] {}", error_msg);
                            last_error = Some(anyhow!(error_msg));

                            if retry < max_retries - 1 {
                                let delay_secs = 2_u64.pow(retry as u32);
                                tokio::time::sleep(tokio::time::Duration::from_secs(delay_secs))
                                    .await;
                            }
                        }
                    }
                }
                Err(e) => {
                    last_error = Some(e.into());
                    if retry < max_retries - 1 {
                        let delay_secs = 2_u64.pow(retry as u32); // 1s, 2s, 4s
                        crate::app_log!(
                            "[重试] 网络请求失败，{}秒后重试 ({}/{})",
                            delay_secs,
                            retry + 1,
                            max_retries
                        );
                        tokio::time::sleep(tokio::time::Duration::from_secs(delay_secs)).await;
                    }
                }
            }
        }

        let chat_response = chat_response.ok_or_else(|| {
            last_error.unwrap_or_else(|| anyhow!("翻译请求失败，已重试{}次", max_retries))
        })?;

        // 更新token统计（使用新架构精确计算）
        if let Some(usage) = chat_response.usage {
            self.token_stats.input_tokens += usage.prompt_tokens;
            self.token_stats.output_tokens += usage.completion_tokens;
            self.token_stats.total_tokens += usage.total_tokens;

            // 使用 ModelInfo 计算精确成本
            let model_info = self
                .provider
                .get_model_info(&self.model)
                .expect("模型信息必须存在，请检查 models/ 目录中的模型定义");

            use crate::services::ai::CostCalculator;
            let breakdown = CostCalculator::calculate_openai(
                &model_info,
                usage.prompt_tokens as usize,
                usage.completion_tokens as usize,
                0, // TODO: 支持从 API 响应中提取缓存 token
                0,
            );
            self.token_stats.cost += breakdown.total_cost;
        }

        let assistant_response = chat_response
            .choices
            .first()
            .map(|choice| &choice.message.content)
            .ok_or_else(|| anyhow!("No response content"))?;

        // 更新对话历史
        self.update_conversation_history(&user_prompt, assistant_response);

        // 解析翻译结果
        let translations = self.parse_translations(assistant_response, &texts)?;

        Ok(translations)
    }

    /// 获取当前使用的系统提示词（用于日志记录）
    pub fn current_system_prompt(&self) -> &str {
        &self.system_prompt
    }

    pub fn build_user_prompt(&self, texts: &[String]) -> String {
        // Phase 5: 根据目标语言生成提示词
        let target_lang_instruction = match self.target_language.as_deref() {
            Some("zh-Hans") => "简体中文",
            Some("zh-Hant") => "繁体中文",
            Some("en") => "English",
            Some("ja") => "日本語",
            Some("ko") => "한국어",
            Some("fr") => "Français",
            Some("de") => "Deutsch",
            Some("es") => "Español",
            Some("ru") => "Русский",
            Some("ar") => "العربية",
            Some(lang) => lang,
            None => "目标语言", // 默认（未指定语言）
        };

        // 精简提示词：移除冗余说明和空行
        let mut prompt = format!("翻译为{}（每行一条，带序号）:\n", target_lang_instruction);
        for (i, text) in texts.iter().enumerate() {
            prompt.push_str(&format!("{}. {}\n", i + 1, text));
        }
        prompt
    }

    fn update_conversation_history(&mut self, user_prompt: &str, assistant_response: &str) {
        if self.conversation_history.is_empty() {
            self.conversation_history.push(ChatMessage {
                role: "system".to_string(),
                content: self.system_prompt.clone(),
            });
        }

        self.conversation_history.push(ChatMessage {
            role: "user".to_string(),
            content: user_prompt.to_string(),
        });

        self.conversation_history.push(ChatMessage {
            role: "assistant".to_string(),
            content: assistant_response.to_string(),
        });

        // 防止历史过长：保留最近10轮对话
        if self.conversation_history.len() > 21 {
            let system_msg = self.conversation_history[0].clone();
            let recent_msgs: Vec<_> = self
                .conversation_history
                .iter()
                .rev()
                .take(20)
                .cloned()
                .collect();
            self.conversation_history = vec![system_msg];
            self.conversation_history
                .extend(recent_msgs.into_iter().rev());
        }
    }

    fn parse_translations(&self, response: &str, original_texts: &[String]) -> Result<Vec<String>> {
        let lines: Vec<&str> = response
            .lines()
            .map(|line| line.trim())
            .filter(|line| !line.is_empty())
            .collect();

        // 优先提取以数字序号开头的行（支持多种格式）
        let number_prefix_regex = regex::Regex::new(r"^\d+[\.\)、:\s]+(.+)$").unwrap();
        let mut translations = Vec::new();

        for line in lines.iter() {
            if let Some(captures) = number_prefix_regex.captures(line) {
                if let Some(content) = captures.get(1) {
                    let translation = content.as_str().trim().to_string();
                    translations.push(translation);
                }
            }
        }

        // 如果没有找到序号格式，降级为所有非空行（向后兼容）
        if translations.is_empty() {
            for line in lines {
                translations.push(line.to_string());
            }
        }

        // ⚠️ 验证翻译数量（只在出错时输出详细日志）
        if translations.len() != original_texts.len() {
            crate::app_log!(
                "[解析错误] 期望{}条，实际{}条\n[AI响应]\n{}",
                original_texts.len(),
                translations.len(),
                response
            );

            return Err(anyhow!(
                "翻译数量不匹配！请求 {} 条，实际返回 {} 条",
                original_texts.len(),
                translations.len()
            ));
        }

        // 验证特殊字符保留
        for (i, translation) in translations.iter_mut().enumerate() {
            let original = &original_texts[i];

            // 检查换行符
            if original.contains("\\n") && !translation.contains("\\n") {
                if original.ends_with("\\n") && !translation.ends_with("\\n") {
                    translation.push_str("\\n");
                }
            }

            // 检查占位符数量
            let original_placeholders = self.count_placeholders(original);
            let translation_placeholders = self.count_placeholders(translation);
            if original_placeholders != translation_placeholders {
                crate::app_log!(
                    "[占位符警告] '{}' 占位符数量不匹配：原文{}个，译文{}个",
                    original,
                    original_placeholders,
                    translation_placeholders
                );
            }
        }

        Ok(translations)
    }

    fn count_placeholders(&self, text: &str) -> usize {
        let mut count = 0;
        let mut chars = text.chars().peekable();

        while let Some(ch) = chars.next() {
            if ch == '{' {
                if let Some(&next) = chars.peek() {
                    if next.is_ascii_digit() {
                        count += 1;
                    }
                }
            } else if ch == '%' {
                if let Some(&next) = chars.peek() {
                    if next == '%' {
                        count += 1;
                        chars.next(); // 跳过第二个%
                    }
                }
            }
        }

        count
    }
}

impl AITranslator {
    pub fn get_token_stats(&self) -> &TokenStats {
        &self.token_stats
    }

    pub fn reset_stats(&mut self) {
        self.token_stats = TokenStats {
            input_tokens: 0,
            output_tokens: 0,
            total_tokens: 0,
            cost: 0.0,
        };
    }

    pub fn clear_conversation_history(&mut self) {
        self.conversation_history.clear();
    }

    pub fn get_translation_memory(&self) -> Option<&TranslationMemory> {
        self.tm.as_ref()
    }

    pub fn get_translation_memory_mut(&mut self) -> Option<&mut TranslationMemory> {
        self.tm.as_mut()
    }
}
