//! AI 翻译器模块
//!
//! 提供基于大语言模型的翻译功能，支持多供应商、代理配置、翻译记忆等功能。
//!
//! # 主要功能
//!
//! - 支持多种 AI 供应商（OpenAI、DeepSeek、Moonshot 等）
//! - 集成翻译记忆库（TM）提高翻译效率和一致性
//! - 支持自定义系统提示词和术语库
//! - 自动 token 统计和成本计算
//! - 批量翻译优化（去重、分批处理）
//!
//! # 使用示例
//!
//! ```rust
//! use crate::services::ai_translator::AITranslator;
//!
//! // 创建基础翻译器
//! let mut translator = AITranslator::new(
//!     "your-api-key".to_string(),
//!     None,
//!     true,
//!     None,
//!     Some("zh-Hans".to_string()),
//! )?;
//!
//! // 批量翻译
//! let texts = vec!["Hello".to_string(), "World".to_string()];
//! let translations = translator.translate_batch(texts, None).await?;
//! ```
//!
//! # 架构设计
//!
//! - `AITranslator`: 核心翻译器，管理 HTTP 客户端和翻译状态
//! - `TranslationMemory`: 翻译记忆库，缓存常用短语
//! - `TermLibrary`: 术语库，提供专业术语翻译和风格指导
//! - `prompt_builder`: 提示词构建器，生成系统提示和用户提示
//! - `translation_stats`: 统计模块，记录 token 使用和成本

use crate::error::AppError;
use crate::services::term_library::TermLibrary;
use crate::services::translation_memory::TranslationMemory;
// 🆕 使用新的提示词和统计模块
use crate::services::prompt_builder;
use crate::services::translation_stats::{BatchStats, TokenStats};
use crate::utils::common::is_simple_phrase;
use crate::utils::paths::get_translation_memory_path;
use reqwest::Client as HttpClient;
use serde::{Deserialize, Serialize};

#[cfg(feature = "ts-rs")]
use ts_rs::TS;

// ========== 重新导出类型 ==========
pub use crate::services::prompt_builder::DEFAULT_SYSTEM_PROMPT;

// ========== Phase 1: AI 供应商配置系统 ==========

// ========== 废弃代码已移除 ==========
// 旧的 ProviderType 枚举及其实现已完全移除
// 请使用插件化供应商系统：crate::services::ai::provider

/// 代理配置
///
/// 用于配置 HTTP 代理，支持通过代理服务器访问 AI API。
///
/// # 字段说明
///
/// - `host`: 代理服务器地址（如 "127.0.0.1"）
/// - `port`: 代理服务器端口（如 7890）
/// - `enabled`: 是否启用代理
///
/// # 示例
///
/// ```rust
/// use crate::services::ai_translator::ProxyConfig;
///
/// let proxy = ProxyConfig {
///     host: "127.0.0.1".to_string(),
///     port: 7890,
///     enabled: true,
/// };
/// ```
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")] // 🔧 序列化时使用 camelCase 命名，与前端保持一致
#[cfg_attr(feature = "ts-rs", derive(TS))]
#[cfg_attr(feature = "ts-rs", ts(export, export_to = "../src/types/generated/"))]
pub struct ProxyConfig {
    pub host: String,
    pub port: u16,
    pub enabled: bool,
}

/// AI 配置（插件化版本）
///
/// 包含连接 AI 服务所需的配置信息，支持插件化供应商系统。
///
/// # 字段说明
///
/// - `provider_id`: 供应商 ID（如 "openai", "deepseek", "moonshot"）
/// - `api_key`: API 密钥
/// - `base_url`: 可选的自定义 API 地址（默认使用供应商的默认地址）
/// - `model`: 可选的自定义模型名称（默认使用供应商的默认模型）
/// - `proxy`: 可选的代理配置
///
/// # 示例
///
/// ```rust
/// use crate::services::ai_translator::{AIConfig, ProxyConfig};
///
/// let config = AIConfig {
///     provider_id: "openai".to_string(),
///     api_key: "sk-...".to_string(),
///     base_url: Some("https://api.openai.com/v1".to_string()),
///     model: Some("gpt-4".to_string()),
///     proxy: Some(ProxyConfig {
///         host: "127.0.0.1".to_string(),
///         port: 7890,
///         enabled: true,
///     }),
/// };
/// ```
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")] // 🔧 序列化时使用 camelCase 命名，与前端保持一致
#[cfg_attr(feature = "ts-rs", derive(TS))]
#[cfg_attr(feature = "ts-rs", ts(export, export_to = "../src/types/generated/"))]
pub struct AIConfig {
    /// 供应商ID（如 "openai", "deepseek", "moonshot"）
    pub provider_id: String,
    pub api_key: String,
    pub base_url: Option<String>, // 可选的自定义URL
    pub model: Option<String>,    // 可选的自定义模型
    pub proxy: Option<ProxyConfig>,
}

// ========== Chat API 数据结构 ==========
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

/// AI 翻译器
///
/// 核心翻译器，负责与 AI 服务交互，管理翻译流程和状态。
///
/// # 功能特性
///
/// - 支持批量翻译（自动分批、去重）
/// - 集成翻译记忆库（TM）
/// - 自动 token 统计和成本计算
/// - 支持自定义系统提示词
/// - 术语库集成
/// - 目标语言支持
///
/// # 状态管理
///
/// - `conversation_history`: 对话历史（用于上下文翻译）
/// - `token_stats`: token 使用统计
/// - `batch_stats`: 批量翻译统计
/// - `tm`: 翻译记忆库（可选）
/// - `target_language`: 目标语言（可选）
///
/// # 示例
///
/// ```rust
/// use crate::services::ai_translator::AITranslator;
///
/// // 创建基础翻译器
/// let mut translator = AITranslator::new(
///     "your-api-key".to_string(),
///     None,
///     true,
///     None,
///     Some("zh-Hans".to_string()),
/// )?;
///
/// // 批量翻译
/// let texts = vec!["Hello".to_string(), "World".to_string()];
/// let translations = translator.translate_batch(texts, None).await?;
/// ```
#[derive(Debug, Clone)]
pub struct AITranslator {
    client: HttpClient,
    api_key: String,
    base_url: String,
    model: String,
    provider_id: String, // 🔧 插件化：使用 provider_id 字符串
    provider_info: Option<crate::services::ai::ProviderInfo>, // 🔧 缓存供应商信息
    system_prompt: String,
    conversation_history: Vec<ChatMessage>,
    #[allow(dead_code)]
    max_history_tokens: usize,
    token_stats: TokenStats,
    #[allow(dead_code)]
    use_tm: bool,
    tm: Option<TranslationMemory>,
    // Phase 5: 目标语言（用于生成翻译提示词）
    target_language: Option<String>,
    // 统计信息
    pub batch_stats: BatchStats,
}

impl AITranslator {
    /// 创建新的 AI 翻译器
    ///
    /// # 参数
    ///
    /// - `api_key`: API 密钥
    /// - `base_url`: 可选的自定义 API 地址（默认使用 Moonshot）
    /// - `use_tm`: 是否启用翻译记忆库
    /// - `custom_system_prompt`: 可选的自定义系统提示词
    /// - `target_language`: 可选的目标语言代码（如 "zh-Hans", "en" 等）
    ///
    /// # 返回
    ///
    /// 成功返回 `AITranslator` 实例，失败返回 `AppError`。
    ///
    /// # 示例
    ///
    /// ```rust
    /// use crate::services::ai_translator::AITranslator;
    ///
    /// let translator = AITranslator::new(
    ///     "your-api-key".to_string(),
    ///     None,
    ///     true,
    ///     None,
    ///     Some("zh-Hans".to_string()),
    /// )?;
    /// ```
    ///
    /// # 错误
    ///
    /// - 加载翻译记忆库失败时返回错误
    /// - 加载术语库失败时会记录日志但不返回错误
    pub fn new(
        api_key: String,
        base_url: Option<String>,
        use_tm: bool,
        custom_system_prompt: Option<&str>,
        target_language: Option<String>,
    ) -> Result<Self, AppError> {
        let client = HttpClient::new();
        let base_url = base_url.unwrap_or_else(|| "https://api.moonshot.cn/v1".to_string());

        // 加载术语库并构建系统提示词
        let term_library_path = crate::utils::paths::get_term_library_path();
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

        let system_prompt =
            prompt_builder::build_system_prompt(custom_system_prompt, term_library.as_ref());

        // 从文件加载TM（合并内置短语和已保存的翻译）
        let tm = if use_tm {
            Some(TranslationMemory::new_from_file(
                get_translation_memory_path(),
            )?)
        } else {
            None
        };

        Ok(Self {
            client,
            api_key,
            base_url,
            model: "moonshot-v1-auto".to_string(),
            provider_id: "moonshot".to_string(), // 🔧 插件化：默认使用 Moonshot
            provider_info: None,                 // 延迟加载
            system_prompt,
            conversation_history: Vec::new(),
            max_history_tokens: 2000,
            token_stats: TokenStats::default(),
            use_tm,
            tm,
            target_language, // Phase 5: 目标语言
            batch_stats: BatchStats::default(),
        })
    }

    /// 使用 AIConfig 创建翻译器（插件化版本）
    ///
    /// # 参数
    ///
    /// - `config`: AI 配置（包含供应商 ID、API 密钥、代理等）
    /// - `use_tm`: 是否启用翻译记忆库
    /// - `custom_system_prompt`: 可选的自定义系统提示词
    /// - `target_language`: 可选的目标语言代码
    ///
    /// # 返回
    ///
    /// 成功返回 `AITranslator` 实例，失败返回 `AppError`。
    ///
    /// # 示例
    ///
    /// ```rust
    /// use crate::services::ai_translator::{AITranslator, AIConfig};
    ///
    /// let config = AIConfig {
    ///     provider_id: "openai".to_string(),
    ///     api_key: "sk-...".to_string(),
    ///     base_url: None,
    ///     model: None,
    ///     proxy: None,
    /// };
    ///
    /// let translator = AITranslator::new_with_config(
    ///     config,
    ///     true,
    ///     None,
    ///     Some("zh-Hans".to_string()),
    /// )?;
    /// ```
    ///
    /// # 错误
    ///
    /// - 代理配置无效时返回错误
    /// - 加载翻译记忆库失败时返回错误
    /// - 加载术语库失败时会记录日志但不返回错误
    pub fn new_with_config(
        config: AIConfig,
        use_tm: bool,
        custom_system_prompt: Option<&str>,
        target_language: Option<String>,
    ) -> Result<Self, AppError> {
        // 构建HTTP客户端（支持代理）
        let client = Self::build_client_with_proxy(config.proxy.clone())?;

        // 从插件系统获取供应商信息
        let provider_info = Self::get_provider_info(&config.provider_id)?;

        // 使用自定义URL或默认URL
        let base_url = config
            .base_url
            .unwrap_or_else(|| provider_info.default_url.clone());

        // 使用自定义模型或默认模型
        let model = config
            .model
            .unwrap_or_else(|| provider_info.default_model.clone());

        // 加载术语库并构建系统提示词
        let term_library_path = crate::utils::paths::get_term_library_path();
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

        let system_prompt =
            prompt_builder::build_system_prompt(custom_system_prompt, term_library.as_ref());

        // 从文件加载TM
        let tm = if use_tm {
            Some(TranslationMemory::new_from_file(
                get_translation_memory_path(),
            )?)
        } else {
            None
        };

        crate::app_log!(
            "[AI翻译器] 使用配置创建: 供应商={}, 模型={}, 代理={}",
            provider_info.display_name,
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
            provider_id: config.provider_id.clone(),
            provider_info: Some(provider_info), // 🔧 缓存 provider 信息
            system_prompt,
            conversation_history: Vec::new(),
            max_history_tokens: 2000,
            token_stats: TokenStats::default(),
            use_tm,
            tm,
            target_language, // Phase 5: 目标语言
            batch_stats: BatchStats::default(),
        })
    }

    /// 从插件系统获取供应商信息
    fn get_provider_info(provider_id: &str) -> Result<crate::services::ai::ProviderInfo, AppError> {
        use crate::services::ai::provider::with_global_registry;

        with_global_registry(|registry| {
            registry
                .get_provider_info(provider_id)
                .ok_or_else(|| AppError::plugin(format!("未找到供应商: {}", provider_id)))
        })
    }

    /// 获取供应商显示名称（带缓存）
    fn get_provider_display_name(&self) -> String {
        if let Some(ref info) = self.provider_info {
            info.display_name.clone()
        } else {
            // 尝试动态获取
            Self::get_provider_info(&self.provider_id)
                .map(|info| info.display_name)
                .unwrap_or_else(|_| self.provider_id.clone())
        }
    }

    /// 构建支持代理的HTTP客户端
    fn build_client_with_proxy(proxy: Option<ProxyConfig>) -> Result<HttpClient, AppError> {
        let mut builder = HttpClient::builder();

        // 检查是否需要启用代理
        let should_use_proxy = proxy.as_ref().map(|p| p.enabled).unwrap_or(false);

        if should_use_proxy {
            if let Some(proxy_cfg) = proxy {
                let proxy_url = format!("http://{}:{}", proxy_cfg.host, proxy_cfg.port);
                crate::app_log!("[AI翻译器] 使用代理: {}", proxy_url);

                let proxy = reqwest::Proxy::all(&proxy_url)?;
                builder = builder.proxy(proxy);
            }
        } else {
            // 🔧 关键修复：显式禁用代理，防止 reqwest 自动读取系统环境变量
            crate::app_log!("[AI翻译器] 代理已禁用（忽略系统代理设置）");
            builder = builder.no_proxy();
        }

        builder.build().map_err(AppError::from)
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

    #[tracing::instrument(
        name = "translate_batch_with_callbacks",
        skip(self, progress_callback, stats_callback),
        fields(text_count = texts.len())
    )]
    /// 批量翻译（带回调函数）
    ///
    /// 翻译一批文本，支持进度回调和统计回调。
    ///
    /// # 参数
    ///
    /// - `texts`: 待翻译的文本列表
    /// - `progress_callback`: 可选的进度回调函数 `(index, translation)`
    /// - `stats_callback`: 可选的统计回调函数 `(batch_stats, token_stats)`
    ///
    /// # 返回
    ///
    /// 成功返回翻译结果列表，失败返回 `AppError`。
    ///
    /// # 特性
    ///
    /// - 自动使用翻译记忆库（TM）进行预翻译
    /// - 自动去重（相同原文只翻译一次）
    /// - 自动分批处理（每批 25 条）
    /// - 按原始顺序返回结果
    ///
    /// # 示例
    ///
    /// ```rust
    /// let texts = vec![
    ///     "Hello".to_string(),
    ///     "World".to_string(),
    ///     "Test".to_string(),
    /// ];
    ///
    /// let progress_callback = Box::new(|index, translation| {
    ///     println!("翻译进度: {} = {}", index, translation);
    /// });
    ///
    /// let stats_callback = Box::new(|batch_stats, token_stats| {
    ///     println!("TM命中: {}", batch_stats.tm_hits);
    ///     println!("Token使用: {}", token_stats.total_tokens);
    /// });
    ///
    /// let translations = translator.translate_batch_with_callbacks(
    ///     texts,
    ///     Some(progress_callback),
    ///     Some(stats_callback),
    /// ).await?;
    /// ```
    pub async fn translate_batch_with_callbacks(
        &mut self,
        texts: Vec<String>,
        progress_callback: Option<Box<dyn Fn(usize, String) + Send + Sync>>,
        stats_callback: Option<Box<dyn Fn(BatchStats, TokenStats) + Send + Sync>>,
    ) -> Result<Vec<String>, AppError> {
        self.translate_batch_internal(texts, progress_callback, Some(stats_callback), None)
            .await
    }

    #[tracing::instrument(
        name = "translate_batch",
        skip(self, progress_callback),
        fields(text_count = texts.len())
    )]
    /// 批量翻译（简化版本）
    ///
    /// 翻译一批文本，不提供进度回调。
    ///
    /// # 参数
    ///
    /// - `texts`: 待翻译的文本列表
    /// - `progress_callback`: 可选的进度回调函数
    ///
    /// # 返回
    ///
    /// 成功返回翻译结果列表，失败返回 `AppError`。
    ///
    /// # 示例
    ///
    /// ```rust
    /// let texts = vec!["Hello".to_string(), "World".to_string()];
    /// let translations = translator.translate_batch(texts, None).await?;
    /// ```
    pub async fn translate_batch(
        &mut self,
        texts: Vec<String>,
        progress_callback: Option<Box<dyn Fn(usize, String) + Send + Sync>>,
    ) -> Result<Vec<String>, AppError> {
        let (translations, _sources) = self
            .translate_batch_with_sources(texts, progress_callback, None)
            .await?;
        Ok(translations)
    }

    /// 翻译并返回每个条目的来源
    #[tracing::instrument(
        name = "translate_batch_with_sources",
        skip(self, progress_callback, stats_callback),
        fields(text_count = texts.len())
    )]
    pub async fn translate_batch_with_sources(
        &mut self,
        texts: Vec<String>,
        progress_callback: Option<Box<dyn Fn(usize, String) + Send + Sync>>,
        stats_callback: Option<Option<Box<dyn Fn(BatchStats, TokenStats) + Send + Sync>>>,
    ) -> Result<(Vec<String>, Vec<String>), AppError> {
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
    ) -> Result<Vec<String>, AppError> {
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
                // 🔧 修复：传入目标语言，避免跨语言命中
                if let Some(translation) = tm.get_translation(text, self.target_language.as_deref())
                {
                    // TM命中
                    result[i] = translation.clone();
                    self.batch_stats.tm_hits += 1;
                    // 记录来源为TM
                    if let Some(ref mut sources_vec) = sources {
                        sources_vec[i] = String::from("tm");
                    }
                    // ✅ 按顺序上报TM命中进度
                    if let Some(ref callback) = progress_callback {
                        callback(i, translation.clone());
                    }
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
            let unique_list = unique_texts_ordered;
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
                    let user_prompt = prompt_builder::build_translation_prompt(
                        &sample_texts,
                        self.target_language.as_deref(),
                    );

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
                        "temperature": 1.0,
                        "provider": self.get_provider_display_name(),
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

            // Step 3: 将翻译结果分发到所有对应的索引（按原始顺序）
            // 收集所有 (index, translation) 对并排序，确保按顺序上报
            let mut updates: Vec<(usize, String)> = Vec::new();
            for (unique_text, translation) in unique_list.iter().zip(ai_translations.iter()) {
                if let Some(indices) = unique_text_to_indices.get(unique_text) {
                    for (local_idx, &idx) in indices.iter().enumerate() {
                        if idx >= result.len() {
                            crate::app_log!("[翻译] 索引越界: idx={}, result.len={}", idx, result.len());
                            continue;
                        }
                        result[idx] = translation.clone();
                        // 记录来源：第一个是AI翻译，其余是去重
                        if let Some(ref mut sources_vec) = sources {
                            sources_vec[idx] = if local_idx == 0 {
                                String::from("ai")
                            } else {
                                String::from("dedup")
                            };
                        }
                        // 收集更新，稍后按顺序上报
                        updates.push((idx, translation.clone()));
                    }
                }
            }
            // 按索引排序后上报进度，确保顺序正确
            updates.sort_by_key(|&(idx, _)| idx);
            if let Some(ref callback) = progress_callback {
                for (idx, translation) in updates {
                    callback(idx, translation);
                }
            }

            // Step 4: 更新翻译记忆库（每个unique文本只学习一次）
            // 只检查当前记忆库，不检查代码内置词库（用户清空后内置词库不参与）
            if let Some(ref mut tm) = self.tm {
                for (unique_text, translation) in unique_list.iter().zip(ai_translations.iter()) {
                    if is_simple_phrase(unique_text) && translation.len() <= 50 {
                        // 🔧 修复：构造带语言的键来检查是否已存在
                        let check_key = if let Some(lang) = self.target_language.as_deref() {
                            format!("{}|{}", unique_text, lang)
                        } else {
                            unique_text.clone()
                        };

                        if !tm.memory.contains_key(&check_key) {
                            // 🔧 修复：保存时记录目标语言
                            tm.add_translation(
                                unique_text.clone(),
                                translation.clone(),
                                self.target_language.as_deref(),
                            );
                            self.batch_stats.tm_learned += 1;
                            crate::app_log!(
                                "[TM学习] {} -> {} ({})",
                                unique_text,
                                translation,
                                self.target_language.as_deref().unwrap_or("无语言")
                            );
                        } else {
                            crate::app_log!("[TM跳过] {} (已在记忆库)", unique_text);
                        }
                    }
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

    /// 使用自定义用户提示词进行翻译
    ///
    /// 不使用标准的批量翻译提示词模板，用于精翻等需要完整控制提示词的场景。
    ///
    /// # 参数
    ///
    /// - `user_prompt`: 完整的用户提示词（已构建好）
    ///
    /// # 返回
    ///
    /// 成功返回 AI 的原始响应，失败返回 `AppError`。
    ///
    /// # 特性
    ///
    /// - 支持对话历史（连续翻译）
    /// - 自动重试（最多 3 次，指数退避）
    /// - 更新对话历史
    ///
    /// # 示例
    ///
    /// ```rust
    /// let custom_prompt = "请将以下文本翻译成简体中文，只返回翻译结果：\n\nHello World";
    /// let result = translator.translate_with_custom_user_prompt(custom_prompt).await?;
    /// ```
    pub async fn translate_with_custom_user_prompt(
        &mut self,
        user_prompt: String,
    ) -> Result<String, AppError> {
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
            temperature: 1.0,
        };

        // 最多重试3次，指数退避策略
        let max_retries = 3;
        let mut chat_response: Option<ChatResponse> = None;
        let mut last_error: Option<AppError> = None;

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
                    Err(_e) => {
                        last_error = Some(AppError::translation("解析响应体失败", true));
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
                    last_error = Some(AppError::from(e));
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

        let chat_response = chat_response.ok_or_else(|| {
            last_error.unwrap_or_else(|| AppError::translation("未知错误", false))
        })?;

        let assistant_response = chat_response
            .choices
            .first()
            .and_then(|choice| Some(choice.message.content.clone()))
            .ok_or_else(|| AppError::translation("AI响应为空", false))?;

        // 更新对话历史（如果需要）
        self.update_conversation_history(&user_prompt, &assistant_response);

        // 返回原始响应（不做解析）
        Ok(assistant_response.trim().to_string())
    }

    #[tracing::instrument(
        name = "translate_with_ai",
        skip(self),
        fields(
            text_count = texts.len(),
            provider = %self.provider_id,
            model = %self.model
        )
    )]
    pub async fn translate_with_ai(&mut self, texts: Vec<String>) -> Result<Vec<String>, AppError> {
        // 单元测试模拟：如果 api_key 是 test_key，则直接返回原文作为译文，跳过网络请求
        if self.api_key == "test_key" {
            crate::app_log!("[测试模拟] 检测到 test_key，返回模拟翻译结果。");
            return Ok(texts);
        }

        let user_prompt =
            prompt_builder::build_translation_prompt(&texts, self.target_language.as_deref());

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
            temperature: 1.0,
        };

        // 最多重试3次，指数退避策略
        let max_retries = 3;
        let mut chat_response: Option<ChatResponse> = None;
        let mut last_error: Option<AppError> = None;

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
                                last_error = Some(AppError::translation(error_msg, false));
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
                                    last_error = Some(AppError::translation(error_msg, false));
                                    break; // 格式错误不重试
                                }
                            }
                        }
                        Err(e) => {
                            let error_msg = format!("读取响应体失败: {}", e);
                            crate::app_log!("[错误] {}", error_msg);
                            last_error = Some(AppError::translation(error_msg, false));

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
            last_error.unwrap_or_else(|| {
                AppError::translation(format!("翻译请求失败，已重试{}次", max_retries), false)
            })
        })?;

        // 更新token统计（使用新架构精确计算）
        if let Some(usage) = chat_response.usage {
            self.token_stats.input_tokens += usage.prompt_tokens;
            self.token_stats.output_tokens += usage.completion_tokens;
            self.token_stats.total_tokens += usage.total_tokens;

            // 使用 ModelInfo 计算精确成本
            // Fail Fast 架构设计：多AI供应商架构要求强制 ModelInfo 存在
            // 模型不存在 = 配置错误，应立即返回错误（见 docs/Architecture.md:195）
            let model_info = {
                use crate::services::ai::provider::with_global_registry;
                with_global_registry(|registry| {
                    registry
                        .get_provider(&self.provider_id)
                        .and_then(|provider| provider.get_model_info(&self.model))
                        .ok_or_else(|| {
                            AppError::plugin(format!(
                                "模型信息不存在: provider={}, model={}. 请检查插件系统中的模型定义",
                                self.provider_id, self.model
                            ))
                        })
                })?
            };

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
            .ok_or_else(|| AppError::translation("AI响应为空", false))?;

        // 更新对话历史
        self.update_conversation_history(&user_prompt, assistant_response);

        // 解析翻译结果
        let translations = self.parse_translations(assistant_response, &texts)?;

        Ok(translations)
    }

    /// 获取当前使用的系统提示词（用于日志记录）
    #[inline]
    pub fn current_system_prompt(&self) -> &str {
        &self.system_prompt
    }

    /// 构建用户提示词（包装方法，用于向后兼容）
    #[inline]
    pub fn build_user_prompt(&self, texts: &[String]) -> String {
        prompt_builder::build_translation_prompt(texts, self.target_language.as_deref())
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

    fn parse_translations(
        &self,
        response: &str,
        original_texts: &[String],
    ) -> Result<Vec<String>, AppError> {
        let lines: Vec<&str> = response
            .lines()
            .map(|line| line.trim())
            .filter(|line| !line.is_empty())
            .collect();

        // 优先提取以数字序号开头的行（支持多种格式）
        // 正则表达式是常量，编译时保证正确性
        #[allow(clippy::unwrap_used)]
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

            return Err(AppError::parse(format!(
                "翻译数量不匹配！请求 {} 条，实际返回 {} 条",
                original_texts.len(),
                translations.len()
            )));
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
        self.token_stats = TokenStats::default();
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
