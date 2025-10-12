// AI 供应商类型测试

#[cfg(test)]
mod provider_type_tests {
    use po_translator_gui::services::ProviderType;

    #[test]
    fn test_provider_default_urls() {
        assert_eq!(
            ProviderType::Moonshot.default_url(),
            "https://api.moonshot.cn/v1"
        );
        assert_eq!(
            ProviderType::OpenAI.default_url(),
            "https://api.openai.com/v1"
        );
        assert_eq!(
            ProviderType::SparkDesk.default_url(),
            "https://spark-api.xf-yun.com/v1"
        );
        assert_eq!(
            ProviderType::Wenxin.default_url(),
            "https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop"
        );
        assert_eq!(
            ProviderType::Qianwen.default_url(),
            "https://dashscope.aliyuncs.com/api/v1"
        );
        assert_eq!(
            ProviderType::GLM.default_url(),
            "https://open.bigmodel.cn/api/paas/v4"
        );
        assert_eq!(
            ProviderType::Claude.default_url(),
            "https://api.anthropic.com/v1"
        );
        assert_eq!(
            ProviderType::Gemini.default_url(),
            "https://generativelanguage.googleapis.com/v1"
        );
    }

    #[test]
    fn test_provider_display_names() {
        assert_eq!(ProviderType::Moonshot.display_name(), "Moonshot AI");
        assert_eq!(ProviderType::OpenAI.display_name(), "OpenAI");
        assert_eq!(ProviderType::SparkDesk.display_name(), "讯飞星火");
        assert_eq!(ProviderType::Wenxin.display_name(), "百度文心一言");
        assert_eq!(ProviderType::Qianwen.display_name(), "阿里通义千问");
        assert_eq!(ProviderType::GLM.display_name(), "智谱AI (GLM)");
        assert_eq!(ProviderType::Claude.display_name(), "Claude (Anthropic)");
        assert_eq!(ProviderType::Gemini.display_name(), "Google Gemini");
    }

    #[test]
    fn test_provider_default_models() {
        assert_eq!(ProviderType::Moonshot.default_model(), "moonshot-v1-auto");
        assert_eq!(ProviderType::OpenAI.default_model(), "gpt-3.5-turbo");
        assert_eq!(ProviderType::SparkDesk.default_model(), "generalv3.5");
        assert_eq!(ProviderType::Wenxin.default_model(), "ernie-bot-turbo");
        assert_eq!(ProviderType::Qianwen.default_model(), "qwen-turbo");
        assert_eq!(ProviderType::GLM.default_model(), "glm-4");
        assert_eq!(
            ProviderType::Claude.default_model(),
            "claude-3-haiku-20240307"
        );
        assert_eq!(ProviderType::Gemini.default_model(), "gemini-pro");
    }

    #[test]
    fn test_provider_serialization() {
        use serde_json;

        let provider = ProviderType::Moonshot;
        let json = serde_json::to_string(&provider).unwrap();
        assert_eq!(json, "\"Moonshot\"");

        let deserialized: ProviderType = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized, ProviderType::Moonshot);
    }

    #[test]
    fn test_all_providers_serialization() {
        use serde_json;

        let providers = vec![
            ProviderType::Moonshot,
            ProviderType::OpenAI,
            ProviderType::SparkDesk,
            ProviderType::Wenxin,
            ProviderType::Qianwen,
            ProviderType::GLM,
            ProviderType::Claude,
            ProviderType::Gemini,
        ];

        for provider in providers {
            let json = serde_json::to_string(&provider).unwrap();
            let deserialized: ProviderType = serde_json::from_str(&json).unwrap();
            assert_eq!(deserialized, provider);
        }
    }
}
