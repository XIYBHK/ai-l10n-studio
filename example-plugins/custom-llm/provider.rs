/**
 * 自定义 LLM 供应商插件实现
 * 
 * 展示如何创建支持本地或私有 LLM 服务的插件
 * 支持 OpenAI 兼容 API（如 Ollama、LocalAI、vLLM 等）
 */

use super::super::super::provider::AIProvider;
use super::super::super::ModelInfo;

/// 自定义 LLM 供应商实现
pub struct CustomLLMProvider;

impl AIProvider for CustomLLMProvider {
    fn id(&self) -> &'static str {
        "custom_llm"
    }

    fn display_name(&self) -> &'static str {
        "Custom LLM"
    }

    fn default_url(&self) -> &'static str {
        "http://localhost:11434/v1"  // Ollama 默认地址
    }

    fn default_model(&self) -> &'static str {
        "llama3.2"
    }

    fn get_models(&self) -> Vec<ModelInfo> {
        vec![
            // Llama 3.2 - 推荐的通用模型
            ModelInfo {
                id: "llama3.2".to_string(),
                name: "Llama 3.2".to_string(),
                max_input_tokens: 128000,  // 128K context
                max_output_tokens: 4096,
                input_price: 0.0,   // 本地模型免费
                output_price: 0.0,  // 本地模型免费
                cache_reads_price: None,
                cache_writes_price: None,
                supports_cache: false,
                supports_images: false,
                recommended: true,
                description: Some("Meta 的 Llama 3.2 模型，在本地运行，保护数据隐私".to_string()),
            },
            
            // Code Llama - 代码专用
            ModelInfo {
                id: "codellama".to_string(),
                name: "Code Llama".to_string(),
                max_input_tokens: 100000,
                max_output_tokens: 4096,
                input_price: 0.0,
                output_price: 0.0,
                cache_reads_price: None,
                cache_writes_price: None,
                supports_cache: false,
                supports_images: false,
                recommended: false,
                description: Some("专门为代码理解和生成优化的 Llama 模型".to_string()),
            },
            
            // Mixtral 8x7B - 高性能混合专家模型
            ModelInfo {
                id: "mixtral-8x7b".to_string(),
                name: "Mixtral 8x7B".to_string(),
                max_input_tokens: 32768,
                max_output_tokens: 4096,
                input_price: 0.0,
                output_price: 0.0,
                cache_reads_price: None,
                cache_writes_price: None,
                supports_cache: false,
                supports_images: false,
                recommended: false,
                description: Some("Mistral AI 的混合专家模型，在复杂推理任务上表现出色".to_string()),
            },
            
            // Qwen 2.5 - 多语言优化
            ModelInfo {
                id: "qwen2.5".to_string(),
                name: "Qwen 2.5".to_string(),
                max_input_tokens: 128000,
                max_output_tokens: 8192,
                input_price: 0.0,
                output_price: 0.0,
                cache_reads_price: None,
                cache_writes_price: None,
                supports_cache: false,
                supports_images: false,
                recommended: false,
                description: Some("阿里巴巴的 Qwen 2.5，对中文和多语言任务优化".to_string()),
            },
            
            // Llama 3.2 Vision - 支持图像（如果可用）
            ModelInfo {
                id: "llama3.2-vision".to_string(),
                name: "Llama 3.2 Vision".to_string(),
                max_input_tokens: 128000,
                max_output_tokens: 4096,
                input_price: 0.0,
                output_price: 0.0,
                cache_reads_price: None,
                cache_writes_price: None,
                supports_cache: false,
                supports_images: true,
                recommended: false,
                description: Some("支持图像理解的 Llama 3.2 模型".to_string()),
            },
        ]
    }
}

/// 创建自定义 LLM 供应商实例
pub fn create_custom_llm_provider() -> CustomLLMProvider {
    CustomLLMProvider
}

/// 自定义 LLM 相关的工具和配置
pub mod custom_llm_utils {
    /// 支持的提示词格式
    #[derive(Debug, Clone)]
    pub enum PromptFormat {
        /// Llama 格式：<|system|>\n{content}\n<|user|>\n{content}\n<|assistant|>\n
        Llama,
        /// ChatML 格式：<|im_start|>system\n{content}<|im_end|>
        ChatML,
        /// Alpaca 格式：### Instruction:\n{content}\n### Response:\n
        Alpaca,
        /// 自定义格式
        Custom { 
            system_prefix: String, 
            user_prefix: String, 
            assistant_prefix: String 
        },
    }
    
    /// 认证方式
    #[derive(Debug, Clone)]
    pub enum AuthType {
        /// 无认证
        None,
        /// Bearer Token
        Bearer(String),
        /// Basic 认证
        Basic { username: String, password: String },
        /// API Key 头部
        ApiKey { header: String, key: String },
    }
    
    /// 自定义 LLM 配置
    #[derive(Debug, Clone)]
    pub struct CustomLLMConfig {
        pub base_url: String,
        pub auth: AuthType,
        pub prompt_format: PromptFormat,
        pub timeout_seconds: u64,
        pub max_retries: u32,
        pub default_temperature: f32,
        pub default_max_tokens: u32,
    }
    
    impl Default for CustomLLMConfig {
        fn default() -> Self {
            Self {
                base_url: "http://localhost:11434/v1".to_string(),
                auth: AuthType::None,
                prompt_format: PromptFormat::Llama,
                timeout_seconds: 120,
                max_retries: 3,
                default_temperature: 0.7,
                default_max_tokens: 2048,
            }
        }
    }
    
    /// 常见本地 LLM 服务的预设配置
    pub mod presets {
        use super::*;
        
        /// Ollama 配置
        pub fn ollama() -> CustomLLMConfig {
            CustomLLMConfig {
                base_url: "http://localhost:11434/v1".to_string(),
                auth: AuthType::None,
                prompt_format: PromptFormat::Llama,
                ..Default::default()
            }
        }
        
        /// LocalAI 配置
        pub fn local_ai() -> CustomLLMConfig {
            CustomLLMConfig {
                base_url: "http://localhost:8080/v1".to_string(),
                auth: AuthType::None,
                prompt_format: PromptFormat::ChatML,
                ..Default::default()
            }
        }
        
        /// vLLM 配置
        pub fn vllm() -> CustomLLMConfig {
            CustomLLMConfig {
                base_url: "http://localhost:8000/v1".to_string(),
                auth: AuthType::None,
                prompt_format: PromptFormat::Llama,
                ..Default::default()
            }
        }
        
        /// LM Studio 配置
        pub fn lm_studio() -> CustomLLMConfig {
            CustomLLMConfig {
                base_url: "http://localhost:1234/v1".to_string(),
                auth: AuthType::None,
                prompt_format: PromptFormat::ChatML,
                ..Default::default()
            }
        }
    }
    
    /// 检测本地服务是否可用
    pub async fn check_service_health(base_url: &str) -> Result<bool, Box<dyn std::error::Error>> {
        let client = reqwest::Client::new();
        let health_url = format!("{}/health", base_url.trim_end_matches("/v1"));
        
        match client.get(&health_url).timeout(std::time::Duration::from_secs(5)).send().await {
            Ok(response) => Ok(response.status().is_success()),
            Err(_) => {
                // 尝试模型列表端点
                let models_url = format!("{}/models", base_url);
                match client.get(&models_url).timeout(std::time::Duration::from_secs(5)).send().await {
                    Ok(response) => Ok(response.status().is_success()),
                    Err(_) => Ok(false),
                }
            }
        }
    }
    
    /// 获取可用模型列表
    pub async fn fetch_available_models(config: &CustomLLMConfig) -> Result<Vec<String>, Box<dyn std::error::Error>> {
        let client = reqwest::Client::new();
        let models_url = format!("{}/models", config.base_url);
        
        let mut request = client.get(&models_url);
        
        // 添加认证
        request = match &config.auth {
            AuthType::Bearer(token) => request.bearer_auth(token),
            AuthType::Basic { username, password } => request.basic_auth(username, Some(password)),
            AuthType::ApiKey { header, key } => request.header(header, key),
            AuthType::None => request,
        };
        
        let response = request.send().await?;
        let json: serde_json::Value = response.json().await?;
        
        // 解析模型列表（OpenAI 格式）
        if let Some(data) = json.get("data") {
            if let Some(models) = data.as_array() {
                let model_ids: Vec<String> = models
                    .iter()
                    .filter_map(|model| model.get("id")?.as_str())
                    .map(|s| s.to_string())
                    .collect();
                return Ok(model_ids);
            }
        }
        
        Ok(vec![])
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use super::custom_llm_utils::*;

    #[test]
    fn test_custom_llm_provider_info() {
        let provider = CustomLLMProvider;
        
        assert_eq!(provider.id(), "custom_llm");
        assert_eq!(provider.display_name(), "Custom LLM");
        assert!(provider.default_url().contains("localhost"));
        assert_eq!(provider.default_model(), "llama3.2");
    }

    #[test]
    fn test_custom_llm_models() {
        let provider = CustomLLMProvider;
        let models = provider.get_models();
        
        assert!(models.len() >= 5);
        
        // 检查推荐模型
        let recommended_models: Vec<_> = models.iter()
            .filter(|m| m.recommended)
            .collect();
        assert_eq!(recommended_models.len(), 1);
        assert_eq!(recommended_models[0].id, "llama3.2");
        
        // 所有本地模型应该是免费的
        for model in &models {
            assert_eq!(model.input_price, 0.0);
            assert_eq!(model.output_price, 0.0);
        }
        
        // 检查图像支持
        let vision_models: Vec<_> = models.iter()
            .filter(|m| m.supports_images)
            .collect();
        assert!(vision_models.len() >= 1);
    }

    #[test]
    fn test_prompt_formats() {
        let llama_format = PromptFormat::Llama;
        let chatml_format = PromptFormat::ChatML;
        let alpaca_format = PromptFormat::Alpaca;
        
        // 这里可以添加格式化逻辑的测试
        match llama_format {
            PromptFormat::Llama => assert!(true),
            _ => assert!(false),
        }
    }

    #[test]
    fn test_auth_types() {
        let no_auth = AuthType::None;
        let bearer_auth = AuthType::Bearer("token123".to_string());
        let basic_auth = AuthType::Basic {
            username: "user".to_string(),
            password: "pass".to_string(),
        };
        
        match no_auth {
            AuthType::None => assert!(true),
            _ => assert!(false),
        }
        
        match bearer_auth {
            AuthType::Bearer(token) => assert_eq!(token, "token123"),
            _ => assert!(false),
        }
    }

    #[test]
    fn test_preset_configs() {
        let ollama_config = presets::ollama();
        assert!(ollama_config.base_url.contains("11434"));
        
        let local_ai_config = presets::local_ai();
        assert!(local_ai_config.base_url.contains("8080"));
        
        let vllm_config = presets::vllm();
        assert!(vllm_config.base_url.contains("8000"));
        
        let lm_studio_config = presets::lm_studio();
        assert!(lm_studio_config.base_url.contains("1234"));
    }

    #[test]
    fn test_default_config() {
        let config = CustomLLMConfig::default();
        assert_eq!(config.default_temperature, 0.7);
        assert_eq!(config.max_retries, 3);
        assert_eq!(config.timeout_seconds, 120);
    }
}
