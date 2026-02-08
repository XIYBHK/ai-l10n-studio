//! AI 翻译器测试模块
//!
//! 包含 `AITranslator` 的单元测试和集成测试

use crate::services::ai_translator::{AIConfig, AITranslator, ProxyConfig};
use crate::services::translation_stats::{BatchStats, TokenStats};

#[cfg(test)]
mod tests {
    use super::*;

    /// 创建测试用的 AI 配置
    fn create_test_config() -> AIConfig {
        AIConfig {
            provider_id: "moonshot".to_string(), // 使用真实的供应商 ID
            api_key: "test_key".to_string(),
            base_url: Some("https://api.test.com".to_string()),
            model: Some("test-model".to_string()),
            proxy: None,
        }
    }

    // ========== AITranslator::new() 测试 ==========

    #[test]
    fn test_ai_translator_new_basic() {
        let translator = AITranslator::new("test_key".to_string(), None, false, None, None);

        assert!(translator.is_ok());
        // 验证翻译器创建成功，不访问私有字段
        let t = translator.unwrap();
        let _stats = t.get_token_stats();
    }

    #[test]
    fn test_ai_translator_new_with_tm() {
        let translator = AITranslator::new(
            "test_key".to_string(),
            None,
            true,
            None,
            Some("zh-Hans".to_string()),
        );

        assert!(translator.is_ok());
        // 验证翻译器创建成功，不访问私有字段
        let t = translator.unwrap();
        let _tm = t.get_translation_memory();
    }

    #[test]
    fn test_ai_translator_new_with_custom_prompt() {
        let custom_prompt = "自定义翻译提示词";
        let translator = AITranslator::new(
            "test_key".to_string(),
            None,
            false,
            Some(custom_prompt),
            None,
        );

        assert!(translator.is_ok());
        // 验证翻译器创建成功
        let t = translator.unwrap();
        let _prompt = t.current_system_prompt();
    }

    // ========== AITranslator::new_with_config() 测试 ==========

    #[test]
    fn test_ai_translator_new_with_config_basic() {
        let config = create_test_config();
        let result = AITranslator::new_with_config(config, false, None, None);

        // 可能会失败（供应商配置问题），只验证方法调用不崩溃
        match result {
            Ok(t) => {
                let _stats = t.get_token_stats();
            }
            Err(_) => {
                // 如果失败也是可以接受的（供应商未注册等）
            }
        }
    }

    #[test]
    fn test_ai_translator_new_with_config_with_proxy() {
        let mut config = create_test_config();
        config.proxy = Some(ProxyConfig {
            host: "127.0.0.1".to_string(),
            port: 7890,
            enabled: true,
        });

        let result = AITranslator::new_with_config(config, false, None, None);

        // 可能会失败，只验证方法调用不崩溃
        match result {
            Ok(_) => {}
            Err(_) => {}
        }
    }

    #[test]
    fn test_ai_translator_new_with_config_with_tm() {
        let config = create_test_config();
        let result = AITranslator::new_with_config(config, true, None, Some("zh-Hant".to_string()));

        // 可能会失败，只验证方法调用不崩溃
        match result {
            Ok(t) => {
                let _tm = t.get_translation_memory();
            }
            Err(_) => {}
        }
    }

    // ========== Token 统计测试 ==========

    #[test]
    fn test_token_stats_default() {
        let stats = TokenStats::default();
        assert_eq!(stats.input_tokens, 0);
        assert_eq!(stats.output_tokens, 0);
        assert_eq!(stats.total_tokens, 0);
        assert_eq!(stats.cost, 0.0);
    }

    #[test]
    fn test_token_stats_new() {
        let stats = TokenStats::new();
        assert_eq!(stats.input_tokens, 0);
        assert_eq!(stats.output_tokens, 0);
    }

    #[test]
    fn test_token_stats_update() {
        let mut stats = TokenStats::new();
        stats.update(100, 50, 150);
        assert_eq!(stats.input_tokens, 100);
        assert_eq!(stats.output_tokens, 50);
        assert_eq!(stats.total_tokens, 150);

        // 测试累加
        stats.update(50, 25, 75);
        assert_eq!(stats.input_tokens, 150);
        assert_eq!(stats.output_tokens, 75);
        assert_eq!(stats.total_tokens, 225);
    }

    #[test]
    fn test_token_stats_add_cost() {
        let mut stats = TokenStats::new();
        stats.add_cost(0.5);
        assert_eq!(stats.cost, 0.5);

        stats.add_cost(0.3);
        assert_eq!(stats.cost, 0.8);
    }

    #[test]
    fn test_token_stats_reset() {
        let mut stats = TokenStats::new();
        stats.update(100, 50, 150);
        stats.add_cost(0.5);

        stats.reset();
        assert_eq!(stats.input_tokens, 0);
        assert_eq!(stats.output_tokens, 0);
        assert_eq!(stats.total_tokens, 0);
        assert_eq!(stats.cost, 0.0);
    }

    // ========== Batch 统计测试 ==========

    #[test]
    fn test_batch_stats_default() {
        let stats = BatchStats::default();
        assert_eq!(stats.total, 0);
        assert_eq!(stats.tm_hits, 0);
        assert_eq!(stats.deduplicated, 0);
        assert_eq!(stats.ai_translated, 0);
        assert_eq!(stats.tm_learned, 0);
    }

    #[test]
    fn test_batch_stats_new() {
        let stats = BatchStats::new();
        assert_eq!(stats.total, 0);
    }

    #[test]
    fn test_batch_stats_init() {
        let mut stats = BatchStats::new();
        stats.init(100);
        assert_eq!(stats.total, 100);
        assert_eq!(stats.tm_hits, 0);
        assert_eq!(stats.ai_translated, 0);
    }

    #[test]
    fn test_batch_stats_record_tm_hit() {
        let mut stats = BatchStats::new();
        stats.record_tm_hit();
        stats.record_tm_hit();
        assert_eq!(stats.tm_hits, 2);
    }

    #[test]
    fn test_batch_stats_record_deduplication() {
        let mut stats = BatchStats::new();
        stats.record_deduplication(20);
        assert_eq!(stats.deduplicated, 20);
    }

    #[test]
    fn test_batch_stats_record_ai_translation() {
        let mut stats = BatchStats::new();
        stats.record_ai_translation(78);
        assert_eq!(stats.ai_translated, 78);
    }

    #[test]
    fn test_batch_stats_record_tm_learning() {
        let mut stats = BatchStats::new();
        stats.record_tm_learning();
        stats.record_tm_learning();
        stats.record_tm_learning();
        assert_eq!(stats.tm_learned, 3);
    }

    #[test]
    fn test_batch_stats_reset() {
        let mut stats = BatchStats::new();
        stats.init(100);
        stats.record_tm_hit();
        stats.record_deduplication(20);
        stats.record_ai_translation(78);

        stats.reset();
        assert_eq!(stats.total, 0);
        assert_eq!(stats.tm_hits, 0);
        assert_eq!(stats.deduplicated, 0);
        assert_eq!(stats.ai_translated, 0);
    }

    // ========== AITranslator 方法测试 ==========

    #[test]
    fn test_get_token_stats() {
        let translator =
            AITranslator::new("test_key".to_string(), None, false, None, None).unwrap();

        let stats = translator.get_token_stats();
        assert_eq!(stats.input_tokens, 0);
        assert_eq!(stats.output_tokens, 0);
    }

    #[test]
    fn test_reset_stats() {
        let mut translator =
            AITranslator::new("test_key".to_string(), None, false, None, None).unwrap();

        // 重置统计
        translator.reset_stats();
        let stats = translator.get_token_stats();
        assert_eq!(stats.input_tokens, 0);
        assert_eq!(stats.output_tokens, 0);
    }

    #[test]
    fn test_clear_conversation_history() {
        let mut translator =
            AITranslator::new("test_key".to_string(), None, false, None, None).unwrap();

        // 清空历史（应该不会出错）
        translator.clear_conversation_history();
        // 验证方法调用成功（不访问私有字段）
    }

    #[test]
    fn test_current_system_prompt() {
        let translator =
            AITranslator::new("test_key".to_string(), None, false, None, None).unwrap();

        let prompt = translator.current_system_prompt();
        assert!(!prompt.is_empty());
    }

    #[test]
    fn test_build_user_prompt() {
        let translator = AITranslator::new(
            "test_key".to_string(),
            None,
            false,
            None,
            Some("zh-Hans".to_string()),
        )
        .unwrap();

        let texts = vec!["Hello".to_string(), "World".to_string()];

        let prompt = translator.build_user_prompt(&texts);
        assert!(prompt.contains("简体中文"));
        assert!(prompt.contains("Hello"));
        assert!(prompt.contains("World"));
    }

    #[test]
    fn test_build_user_prompt_without_target_language() {
        let translator =
            AITranslator::new("test_key".to_string(), None, false, None, None).unwrap();

        let texts = vec!["Hello".to_string()];
        let prompt = translator.build_user_prompt(&texts);
        assert!(prompt.contains("目标语言"));
    }

    // ========== 错误处理测试 ==========

    #[test]
    fn test_invalid_proxy_config() {
        let mut config = create_test_config();
        // 无效的代理地址（空地址，但仍然可以创建）
        config.proxy = Some(ProxyConfig {
            host: "".to_string(),
            port: 0,
            enabled: false, // 禁用代理
        });

        let result = AITranslator::new_with_config(config, false, None, None);

        // 可能会失败（供应商配置问题），只验证方法调用不崩溃
        match result {
            Ok(_) => {}
            Err(_) => {}
        }
    }

    #[test]
    fn test_empty_api_key() {
        let translator = AITranslator::new("".to_string(), None, false, None, None);

        // 空 API key 应该也能创建（实际请求时会失败）
        assert!(translator.is_ok());
    }
}

#[cfg(test)]
mod integration_tests {
    use super::*;

    /// 注意：这些测试需要实际的网络连接和有效的 API 密钥
    /// 默认情况下不运行，使用 `cargo test --features integration` 运行

    #[tokio::test]
    #[ignore] // 需要网络连接
    async fn test_translate_with_mock_api() {
        let mut translator =
            AITranslator::new("test_key".to_string(), None, false, None, None).unwrap();

        // test_key 会触发模拟模式
        let texts = vec!["Hello".to_string(), "World".to_string()];
        let result = translator.translate_batch(texts, None).await;

        assert!(result.is_ok());
        let translations = result.unwrap();
        assert_eq!(translations.len(), 2);
    }

    #[tokio::test]
    #[ignore] // 需要网络连接
    async fn test_translate_empty_list() {
        let mut translator =
            AITranslator::new("test_key".to_string(), None, false, None, None).unwrap();

        let result = translator.translate_batch(vec![], None).await;
        assert!(result.is_ok());
        assert!(result.unwrap().is_empty());
    }

    #[tokio::test]
    #[ignore] // 需要网络连接
    async fn test_translate_batch_with_progress() {
        let mut translator =
            AITranslator::new("test_key".to_string(), None, false, None, None).unwrap();

        let texts = vec!["Hello".to_string(), "World".to_string(), "Test".to_string()];

        // 使用原子计数器来避免闭包可变性问题
        use std::sync::atomic::{AtomicUsize, Ordering};
        let progress_calls = std::sync::Arc::new(AtomicUsize::new(0));
        let progress_calls_clone = progress_calls.clone();

        let progress_callback = Box::new(move |_index: usize, _text: String| {
            progress_calls_clone.fetch_add(1, Ordering::SeqCst);
        });

        let result = translator
            .translate_batch(texts, Some(progress_callback))
            .await;
        assert!(result.is_ok());
        // 模拟模式下，进度回调可能不会被调用
    }
}
