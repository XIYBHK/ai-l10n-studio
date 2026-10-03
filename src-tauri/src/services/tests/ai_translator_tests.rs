#![allow(clippy::unwrap_used, clippy::expect_used)]

use crate::services::ai::{
    ModelInfo,
    provider::{AIProvider, with_global_registry_mut},
};
use crate::services::ai_translator::{AIConfig, AITranslator, parse_translations, preview};
use crate::services::batch_progress_channel::{TranslationInput, TranslationSource};
use crate::services::model_config::ModelApi;
use crate::services::prompt_builder::build_inputs_prompt;
use crate::services::translation_memory::{
    TranslationMemory, canonical_target_language, memory_key,
};
use std::io::{Read, Write};
use std::net::TcpListener;
use std::time::Duration;

struct TestProvider;
impl AIProvider for TestProvider {
    fn id(&self) -> &str {
        "local-test"
    }
    fn display_name(&self) -> &str {
        "Local test"
    }
    fn default_url(&self) -> &str {
        "http://127.0.0.1:1"
    }
    fn api(&self) -> ModelApi {
        ModelApi::OpenaiCompletions
    }
    fn default_model(&self) -> &str {
        "local-test"
    }
    fn get_models(&self) -> Vec<ModelInfo> {
        vec![ModelInfo {
            id: "local-test".into(),
            name: "Local test".into(),
            provider: "local-test".into(),
            context_window: 4096,
            max_output_tokens: 2048,
            input_price: 1.0,
            output_price: 2.0,
            cache_reads_price: None,
            cache_writes_price: None,
            supports_cache: false,
            supports_images: false,
            description: None,
            recommended: false,
        }]
    }
}

pub(crate) fn register_test_provider() -> AIConfig {
    with_global_registry_mut(|registry| registry.register(TestProvider)).unwrap();
    AIConfig {
        provider_id: "local-test".into(),
        catalog_provider_id: Some("local-test".into()),
        api_key: "unused".into(),
        api: ModelApi::OpenaiCompletions,
        base_url: "http://127.0.0.1:1".into(),
        model: "local-test".into(),
        max_tokens: None,
        proxy: None,
    }
}

fn input(text: &str, context: Option<&str>) -> TranslationInput {
    TranslationInput {
        text: text.into(),
        context: context.map(str::to_string),
    }
}

#[test]
fn language_and_context_isolation() {
    let mut tm = TranslationMemory::new();
    tm.clear();
    tm.add_translation("Open".into(), "打开".into(), Some("verb"), "zh-CN");
    tm.add_translation("Open".into(), "开放".into(), Some("adjective"), "zh-Hans");
    assert_eq!(
        tm.get_translation("Open", Some("verb"), "zh-Hans")
            .as_deref(),
        Some("打开")
    );
    assert_eq!(
        tm.get_translation("Open", Some("adjective"), "zh-CN")
            .as_deref(),
        Some("开放")
    );
    for lang in ["zh-TW", "zh-HK", "zh-Hant", "ja", ""] {
        assert!(tm.get_translation("Open", Some("verb"), lang).is_none());
    }
    assert!(tm.get_translation("Open", None, "zh-Hans").is_none());
    tm.memory.insert("Open".into(), "legacy".into());
    assert!(tm.get_translation("Open", None, "en").is_none());
    assert_eq!(canonical_target_language("ZH_tw"), "zh-Hant");
    assert_ne!(
        memory_key("a|b", Some("c"), "en"),
        memory_key("a", Some("b|c"), "en")
    );
}

#[test]
fn tm_round_trip_and_clear_preserve_empty_state() {
    let directory = tempfile::tempdir().unwrap();
    let path = directory.path().join("tm.json");
    let mut tm = TranslationMemory::new();
    tm.clear();
    tm.add_translation("a\n\"b".into(), "翻译".into(), Some("c|d"), "zh-HK");
    tm.save_to_file(&path).unwrap();
    let mut loaded = TranslationMemory::new_from_file(&path).unwrap();
    assert_eq!(
        loaded
            .get_translation("a\n\"b", Some("c|d"), "zh-Hant")
            .as_deref(),
        Some("翻译")
    );
    loaded.clear();
    loaded.save_to_file(&path).unwrap();
    assert_eq!(
        TranslationMemory::new_from_file(&path).unwrap().get_size(),
        0
    );
    std::fs::write(&path, r#"{"learned":{"Open":"打开"}}"#).unwrap();
    assert!(TranslationMemory::new_from_file(&path).is_err());
}

#[test]
fn structured_response_preserves_newlines_numbers_and_whitespace() {
    let parsed = parse_translations(r#"["  1. 开始\n下一行  ","{0} %% | \\"]"#, 2).unwrap();
    assert_eq!(parsed[0], "  1. 开始\n下一行  ");
    assert_eq!(parsed[1], "{0} %% | \\");
    assert!(parse_translations(r#"["one"]"#, 2).is_err());
    assert!(parse_translations(r#"["one", 2]"#, 2).is_err());
    assert!(parse_translations(r#"[""]"#, 1).is_err());
    assert!(parse_translations("1. translated", 1).is_err());
    assert_eq!(
        parse_translations("```json\n[\"yes\"]\n```", 1).unwrap(),
        ["yes"]
    );
    assert_eq!(
        parse_translations("```json\r\n[\"yes\"]\r\n```", 1).unwrap(),
        ["yes"]
    );
    assert_eq!(preview("你好𠮷世界", 3), "你好𠮷…");
}

#[test]
fn prompt_keeps_context_and_text_in_separate_json_fields() {
    let prompt = build_inputs_prompt(&[input("a\nb", Some("menu\"title"))], "zh-TW", None);
    let body: serde_json::Value = serde_json::from_str(prompt.split_once('\n').unwrap().1).unwrap();
    assert_eq!(body["entries"][0]["text"], "a\nb");
    assert_eq!(body["entries"][0]["context"], "menu\"title");
    assert!(prompt.contains("zh-Hant"));
}

fn serve_once(content: &str) -> (String, std::thread::JoinHandle<serde_json::Value>) {
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let url = format!("http://{}", listener.local_addr().unwrap());
    let body = serde_json::json!({"choices":[{"message":{"role":"assistant","content":content}}],"usage":{"prompt_tokens":4,"completion_tokens":2,"total_tokens":6}}).to_string();
    let server = std::thread::spawn(move || {
        let (mut stream, _) = listener.accept().unwrap();
        stream
            .set_read_timeout(Some(Duration::from_secs(5)))
            .unwrap();
        let mut bytes = Vec::new();
        let mut buffer = [0; 2048];
        let request = loop {
            let count = stream.read(&mut buffer).unwrap();
            assert_ne!(count, 0);
            bytes.extend_from_slice(&buffer[..count]);
            if let Some(end) = bytes.windows(4).position(|window| window == b"\r\n\r\n") {
                let headers = String::from_utf8_lossy(&bytes[..end]);
                let size: usize = headers
                    .lines()
                    .find_map(|line| {
                        line.to_lowercase()
                            .strip_prefix("content-length:")
                            .map(|value| value.trim().parse().unwrap())
                    })
                    .unwrap();
                if bytes.len() >= end + 4 + size {
                    break serde_json::from_slice(&bytes[end + 4..end + 4 + size]).unwrap();
                }
            }
        };
        write!(stream, "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}", body.len(), body).unwrap();
        request
    });
    (url, server)
}

#[tokio::test]
async fn empty_response_preserves_reported_usage() {
    let (url, server) = serve_once("");
    let mut config = register_test_provider();
    config.base_url = url;
    config.catalog_provider_id = None;
    let mut translator =
        AITranslator::new_with_config(config, false, None, Some("zh-CN".into())).unwrap();
    let error = translator
        .translate_inputs(vec![input("Empty response usage probe", None)])
        .await
        .unwrap_err();
    server.join().unwrap();
    assert!(error.to_string().contains("AI响应为空"));
    assert_eq!(translator.get_token_stats().input_tokens, 4);
    assert_eq!(translator.get_token_stats().output_tokens, 2);
    assert_eq!(translator.get_token_stats().total_tokens, 6);
    assert_eq!(translator.get_token_stats().unpriced_requests, 1);
}

#[tokio::test]
async fn library_phrase_rules_are_sent_in_real_request_without_other_language_or_context() {
    use crate::services::term_library::TermLibrary;
    let (url, server) = serve_once(r#"["打开文件"]"#);
    let mut library = TermLibrary::new();
    library
        .add_term(
            "Open".into(),
            "打开".into(),
            "旧译".into(),
            None,
            "zh-CN".into(),
        )
        .unwrap();
    library
        .add_term(
            "Open".into(),
            "開く".into(),
            "旧訳".into(),
            None,
            "ja".into(),
        )
        .unwrap();
    library
        .add_term(
            "Open".into(),
            "开放".into(),
            "旧译".into(),
            Some("adjective".into()),
            "zh-CN".into(),
        )
        .unwrap();
    library
        .update_style_summary("Japanese only style".into(), "ja".into(), None)
        .unwrap();
    let mut memory = TranslationMemory::new();
    memory.clear();
    memory.add_translation("Open file".into(), "过期译文".into(), Some("verb"), "zh-CN");
    let mut translator = AITranslator::for_test(url, Some("zh-CN"), Some(memory));
    translator.set_test_term_library(library);
    let items = translator
        .translate_inputs(vec![input("Open file", Some("verb"))])
        .await
        .unwrap();
    assert_eq!(items[0].translation, "打开文件");
    assert!(matches!(items[0].source, TranslationSource::Ai));
    let request = server.join().unwrap();
    let prompt = request["messages"][1]["content"].as_str().unwrap();
    let payload: serde_json::Value =
        serde_json::from_str(prompt.split_once('\n').unwrap().1).unwrap();
    assert_eq!(
        payload["entries"][0]["phrase_rules"],
        serde_json::json!([{"source":"Open","translation":"打开"}])
    );
    assert!(payload["entries"][0]["style_guidance"].is_null());
    assert!(!prompt.contains("Japanese only style"));
    assert!(!prompt.contains("開く"));
    assert!(!prompt.contains("开放"));
}

#[tokio::test]
async fn library_rejects_ai_output_that_ignores_an_explicit_phrase_rule() {
    use crate::services::term_library::TermLibrary;
    let (url, server) = serve_once(r#"["错误译法"]"#);
    let mut library = TermLibrary::new();
    library
        .add_term(
            "Open".into(),
            "打开".into(),
            "旧译".into(),
            None,
            "zh-CN".into(),
        )
        .unwrap();
    let mut translator = AITranslator::for_test(url, Some("zh-CN"), None);
    translator.set_test_term_library(library);
    let error = translator
        .translate_inputs(vec![input("Open", None)])
        .await
        .unwrap_err();
    assert!(error.to_string().contains("术语规则"));
    assert!(!error.is_retryable());
    server.join().unwrap();
}

#[tokio::test]
async fn library_contextual_refinement_sends_and_validates_scoped_rules() {
    use crate::services::term_library::TermLibrary;
    let (url, server) = serve_once("打开");
    let mut library = TermLibrary::new();
    library
        .add_term(
            "Open".into(),
            "打开".into(),
            "旧译".into(),
            Some("verb".into()),
            "zh-CN".into(),
        )
        .unwrap();
    let mut translator = AITranslator::for_test(url, Some("zh-CN"), None);
    translator.set_test_term_library(library);
    assert_eq!(
        translator
            .translate_with_context_prompt(
                input("Open", Some("verb")),
                "Refine this translation".into()
            )
            .await
            .unwrap(),
        "打开"
    );
    let request = server.join().unwrap();
    let prompt = request["messages"][1]["content"].as_str().unwrap();
    let payload: serde_json::Value = serde_json::from_str(prompt.lines().last().unwrap()).unwrap();
    assert_eq!(
        payload["phrase_rules"],
        serde_json::json!([{"source":"Open","translation":"打开"}])
    );
    assert_eq!(payload["context"], "verb");
}

#[tokio::test]
async fn library_human_correction_is_the_first_persisted_translation_and_next_tm_hit() {
    use crate::services::translation_memory::ConfirmedTranslation;
    let (url, server) = serve_once(r#"["错误"]"#);
    let mut memory = TranslationMemory::new();
    memory.clear();
    let mut translator = AITranslator::for_test(url, Some("zh-CN"), Some(memory));
    translator
        .translate_inputs(vec![input("Open", Some("verb"))])
        .await
        .unwrap();
    server.join().unwrap();
    assert_eq!(translator.get_translation_memory().unwrap().memory.len(), 0);
    assert_eq!(translator.batch_stats.tm_learned, 0);
    let temp = tempfile::tempdir().unwrap();
    let path = temp.path().join("tm.json");
    TranslationMemory::confirm(
        &path,
        vec![ConfirmedTranslation {
            source: "Open".into(),
            translation: "打开".into(),
            context: Some("verb".into()),
            language: "zh-CN".into(),
        }],
    )
    .unwrap();
    let mut confirmed = AITranslator::for_test(
        "http://127.0.0.1:1".into(),
        Some("zh-Hans"),
        Some(TranslationMemory::new_from_file(path).unwrap()),
    );
    let items = confirmed
        .translate_inputs(vec![input("Open", Some("verb"))])
        .await
        .unwrap();
    assert_eq!(items[0].translation, "打开");
    assert!(matches!(items[0].source, TranslationSource::Tm));
}

#[tokio::test]
async fn real_http_deduplicates_only_equal_context_and_reports_sources() {
    register_test_provider();
    let (url, server) = serve_once(r#"["打开", "开放"]"#);
    let mut tm = TranslationMemory::new();
    tm.clear();
    tm.add_translation("Save".into(), "保存".into(), None, "zh-CN");
    let mut translator = AITranslator::for_test(url, Some("zh-CN"), Some(tm));
    let items = translator
        .translate_inputs(vec![
            input("Open", Some("verb")),
            input("Open", Some("adjective")),
            input("Open", Some("verb")),
            input("Save", None),
        ])
        .await
        .unwrap();
    assert_eq!(
        items
            .iter()
            .map(|item| item.translation.as_str())
            .collect::<Vec<_>>(),
        ["打开", "开放", "打开", "保存"]
    );
    assert!(matches!(items[0].source, TranslationSource::Ai));
    assert!(matches!(items[2].source, TranslationSource::Dedup));
    assert!(matches!(items[3].source, TranslationSource::Tm));
    assert_eq!(translator.batch_stats.ai_translated, 2);
    assert_eq!(translator.batch_stats.deduplicated, 1);
    assert_eq!(translator.get_token_stats().total_tokens, 6);
    assert!(translator.get_token_stats().cost > 0.0);
    let request = server.join().unwrap();
    let prompt = request["messages"][1]["content"].as_str().unwrap();
    let payload: serde_json::Value =
        serde_json::from_str(prompt.split_once('\n').unwrap().1).unwrap();
    assert_eq!(payload["entries"].as_array().unwrap().len(), 2);
    assert_eq!(translator.batch_stats.tm_learned, 0);
    let memory = translator.get_translation_memory().unwrap();
    assert!(
        !memory
            .memory
            .contains_key(&memory_key("Open", Some("verb"), "zh-CN"))
    );
    assert_eq!(memory.memory.len(), 1);
}

#[tokio::test]
async fn missing_target_fails_before_request() {
    let mut translator = AITranslator::for_test("http://127.0.0.1:1".into(), None, None);
    assert!(
        translator
            .translate_inputs(vec![input("Open", None)])
            .await
            .is_err()
    );
    assert!(
        translator
            .translate_inputs(Vec::new())
            .await
            .unwrap()
            .is_empty()
    );
}

#[tokio::test]
async fn dropping_pending_http_future_cancels_without_retry() {
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let url = format!("http://{}", listener.local_addr().unwrap());
    let cancellation = tokio_util::sync::CancellationToken::new();
    let cancel_on_accept = cancellation.clone();
    let (release_tx, release_rx) = std::sync::mpsc::channel();
    let server = std::thread::spawn(move || {
        let (stream, _) = listener.accept().unwrap();
        cancel_on_accept.cancel();
        release_rx.recv_timeout(Duration::from_secs(5)).unwrap();
        drop(stream);
        listener.set_nonblocking(true).unwrap();
        assert!(listener.accept().is_err());
    });
    let mut translator = AITranslator::for_test(url, Some("en"), None);
    let result = tokio::time::timeout(Duration::from_secs(2), async {
        tokio::select! {
            biased;
            _ = cancellation.cancelled() => true,
            _ = translator.translate_inputs(vec![input("Hello", None)]) => false,
        }
    })
    .await;
    release_tx.send(()).unwrap();
    server.join().unwrap();
    assert!(result.unwrap());
    assert_eq!(translator.batch_stats.ai_translated, 0);
}
