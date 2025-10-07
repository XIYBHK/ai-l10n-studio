// 配置管理模块测试

#[cfg(test)]
mod config_manager_tests {
    use po_translator_gui::services::{AppConfig, AIConfig, ProviderType, ProxyConfig};

    #[test]
    fn test_add_first_ai_config_auto_sets_active() {
        let mut config = AppConfig::default();
        assert!(config.ai_configs.is_empty());
        assert_eq!(config.active_config_index, None);

        let ai_config = AIConfig {
            provider: ProviderType::Moonshot,
            api_key: "test-key".to_string(),
            base_url: None,
            model: None,
            proxy: None,
        };

        config.add_ai_config(ai_config);

        assert_eq!(config.ai_configs.len(), 1);
        assert_eq!(config.active_config_index, Some(0));
    }

    #[test]
    fn test_add_second_ai_config_keeps_first_active() {
        let mut config = AppConfig::default();

        let config1 = AIConfig {
            provider: ProviderType::Moonshot,
            api_key: "key1".to_string(),
            base_url: None,
            model: None,
            proxy: None,
        };

        let config2 = AIConfig {
            provider: ProviderType::OpenAI,
            api_key: "key2".to_string(),
            base_url: None,
            model: None,
            proxy: None,
        };

        config.add_ai_config(config1);
        config.add_ai_config(config2);

        assert_eq!(config.ai_configs.len(), 2);
        assert_eq!(config.active_config_index, Some(0)); // 仍然是第一个
    }

    #[test]
    fn test_get_active_ai_config() {
        let mut config = AppConfig::default();

        let ai_config = AIConfig {
            provider: ProviderType::Moonshot,
            api_key: "test-key".to_string(),
            base_url: Some("https://api.test.com".to_string()),
            model: Some("test-model".to_string()),
            proxy: None,
        };

        config.add_ai_config(ai_config.clone());

        let active = config.get_active_ai_config();
        assert!(active.is_some());
        
        let active_config = active.unwrap();
        assert_eq!(active_config.provider, ProviderType::Moonshot);
        assert_eq!(active_config.api_key, "test-key");
        assert_eq!(active_config.base_url, Some("https://api.test.com".to_string()));
    }

    #[test]
    fn test_update_ai_config() {
        let mut config = AppConfig::default();

        let original = AIConfig {
            provider: ProviderType::Moonshot,
            api_key: "old-key".to_string(),
            base_url: None,
            model: None,
            proxy: None,
        };

        config.add_ai_config(original);

        let updated = AIConfig {
            provider: ProviderType::OpenAI,
            api_key: "new-key".to_string(),
            base_url: Some("https://new-url.com".to_string()),
            model: Some("new-model".to_string()),
            proxy: None,
        };

        let result = config.update_ai_config(0, updated);
        assert!(result.is_ok());

        let active = config.get_active_ai_config().unwrap();
        assert_eq!(active.provider, ProviderType::OpenAI);
        assert_eq!(active.api_key, "new-key");
    }

    #[test]
    fn test_update_ai_config_out_of_bounds() {
        let mut config = AppConfig::default();
        
        let ai_config = AIConfig {
            provider: ProviderType::Moonshot,
            api_key: "test-key".to_string(),
            base_url: None,
            model: None,
            proxy: None,
        };

        let result = config.update_ai_config(0, ai_config);
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("配置索引超出范围"));
    }

    #[test]
    fn test_remove_ai_config_adjusts_active_index() {
        let mut config = AppConfig::default();

        // 添加 3 个配置
        for i in 0..3 {
            config.add_ai_config(AIConfig {
                provider: ProviderType::Moonshot,
                api_key: format!("key-{}", i),
                base_url: None,
                model: None,
                proxy: None,
            });
        }

        // 设置第 2 个（索引 1）为启用
        config.set_active_ai_config(1).unwrap();
        assert_eq!(config.active_config_index, Some(1));

        // 删除第 0 个，启用索引应调整为 0（原来的第 1 个）
        config.remove_ai_config(0).unwrap();
        assert_eq!(config.ai_configs.len(), 2);
        assert_eq!(config.active_config_index, Some(0));
    }

    #[test]
    fn test_remove_active_config_sets_to_first() {
        let mut config = AppConfig::default();

        config.add_ai_config(AIConfig {
            provider: ProviderType::Moonshot,
            api_key: "key-0".to_string(),
            base_url: None,
            model: None,
            proxy: None,
        });

        config.add_ai_config(AIConfig {
            provider: ProviderType::OpenAI,
            api_key: "key-1".to_string(),
            base_url: None,
            model: None,
            proxy: None,
        });

        // 删除第 0 个（当前启用的）
        config.remove_ai_config(0).unwrap();

        assert_eq!(config.ai_configs.len(), 1);
        assert_eq!(config.active_config_index, Some(0)); // 应该设置为剩下的第一个
    }

    #[test]
    fn test_remove_last_config_sets_active_to_none() {
        let mut config = AppConfig::default();

        config.add_ai_config(AIConfig {
            provider: ProviderType::Moonshot,
            api_key: "test-key".to_string(),
            base_url: None,
            model: None,
            proxy: None,
        });

        config.remove_ai_config(0).unwrap();

        assert!(config.ai_configs.is_empty());
        assert_eq!(config.active_config_index, None);
    }

    #[test]
    fn test_set_active_ai_config() {
        let mut config = AppConfig::default();

        config.add_ai_config(AIConfig {
            provider: ProviderType::Moonshot,
            api_key: "key-0".to_string(),
            base_url: None,
            model: None,
            proxy: None,
        });

        config.add_ai_config(AIConfig {
            provider: ProviderType::OpenAI,
            api_key: "key-1".to_string(),
            base_url: None,
            model: None,
            proxy: None,
        });

        let result = config.set_active_ai_config(1);
        assert!(result.is_ok());
        assert_eq!(config.active_config_index, Some(1));

        let active = config.get_active_ai_config().unwrap();
        assert_eq!(active.provider, ProviderType::OpenAI);
    }

    #[test]
    fn test_set_active_ai_config_out_of_bounds() {
        let mut config = AppConfig::default();

        config.add_ai_config(AIConfig {
            provider: ProviderType::Moonshot,
            api_key: "test-key".to_string(),
            base_url: None,
            model: None,
            proxy: None,
        });

        let result = config.set_active_ai_config(5);
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("配置索引超出范围"));
    }

    #[test]
    fn test_proxy_config_in_ai_config() {
        let mut config = AppConfig::default();

        let ai_config = AIConfig {
            provider: ProviderType::Moonshot,
            api_key: "test-key".to_string(),
            base_url: None,
            model: None,
            proxy: Some(ProxyConfig {
                host: "127.0.0.1".to_string(),
                port: 7890,
                enabled: true,
            }),
        };

        config.add_ai_config(ai_config);

        let active = config.get_active_ai_config().unwrap();
        assert!(active.proxy.is_some());
        
        let proxy = active.proxy.as_ref().unwrap();
        assert_eq!(proxy.host, "127.0.0.1");
        assert_eq!(proxy.port, 7890);
        assert!(proxy.enabled);
    }

    #[test]
    fn test_get_all_ai_configs() {
        let mut config = AppConfig::default();

        config.add_ai_config(AIConfig {
            provider: ProviderType::Moonshot,
            api_key: "key-0".to_string(),
            base_url: None,
            model: None,
            proxy: None,
        });

        config.add_ai_config(AIConfig {
            provider: ProviderType::OpenAI,
            api_key: "key-1".to_string(),
            base_url: None,
            model: None,
            proxy: None,
        });

        let all_configs = config.get_all_ai_configs();
        assert_eq!(all_configs.len(), 2);
        assert_eq!(all_configs[0].provider, ProviderType::Moonshot);
        assert_eq!(all_configs[1].provider, ProviderType::OpenAI);
    }
}

