// Phase 7: Contextual Refine 功能测试

use po_translator_gui::commands::ContextualRefineRequest;

/// 测试：ContextualRefineRequest 结构体创建
#[test]
fn test_contextual_refine_request_creation() {
    let request = ContextualRefineRequest {
        msgid: "Hello".to_string(),
        msgctxt: Some("Greeting".to_string()),
        comment: Some("Friendly greeting".to_string()),
        previous_entry: Some("Welcome".to_string()),
        next_entry: Some("Goodbye".to_string()),
    };

    assert_eq!(request.msgid, "Hello");
    assert_eq!(request.msgctxt, Some("Greeting".to_string()));
    assert_eq!(request.comment, Some("Friendly greeting".to_string()));
    assert_eq!(request.previous_entry, Some("Welcome".to_string()));
    assert_eq!(request.next_entry, Some("Goodbye".to_string()));
}

/// 测试：ContextualRefineRequest 可选字段
#[test]
fn test_contextual_refine_request_optional_fields() {
    let request = ContextualRefineRequest {
        msgid: "Hello".to_string(),
        msgctxt: None,
        comment: None,
        previous_entry: None,
        next_entry: None,
    };

    assert_eq!(request.msgid, "Hello");
    assert!(request.msgctxt.is_none());
    assert!(request.comment.is_none());
    assert!(request.previous_entry.is_none());
    assert!(request.next_entry.is_none());
}

/// 测试：ContextualRefineRequest 序列化/反序列化
#[test]
fn test_contextual_refine_request_serde() {
    let request = ContextualRefineRequest {
        msgid: "Hello".to_string(),
        msgctxt: Some("Greeting".to_string()),
        comment: Some("Friendly greeting".to_string()),
        previous_entry: Some("Welcome".to_string()),
        next_entry: Some("Goodbye".to_string()),
    };

    // 序列化
    let json = serde_json::to_string(&request).expect("序列化失败");
    
    // 反序列化
    let deserialized: ContextualRefineRequest = 
        serde_json::from_str(&json).expect("反序列化失败");

    assert_eq!(deserialized.msgid, request.msgid);
    assert_eq!(deserialized.msgctxt, request.msgctxt);
    assert_eq!(deserialized.comment, request.comment);
}

/// 测试：批量 ContextualRefineRequest
#[test]
fn test_multiple_contextual_refine_requests() {
    let requests = vec![
        ContextualRefineRequest {
            msgid: "Hello".to_string(),
            msgctxt: Some("Greeting".to_string()),
            comment: None,
            previous_entry: None,
            next_entry: Some("Goodbye".to_string()),
        },
        ContextualRefineRequest {
            msgid: "Goodbye".to_string(),
            msgctxt: None,
            comment: Some("Farewell".to_string()),
            previous_entry: Some("Hello".to_string()),
            next_entry: None,
        },
    ];

    assert_eq!(requests.len(), 2);
    assert_eq!(requests[0].msgid, "Hello");
    assert_eq!(requests[1].msgid, "Goodbye");
}

/// 测试：空 msgid（应该允许，但不推荐）
#[test]
fn test_empty_msgid() {
    let request = ContextualRefineRequest {
        msgid: String::new(),
        msgctxt: None,
        comment: None,
        previous_entry: None,
        next_entry: None,
    };

    assert_eq!(request.msgid, "");
}

/// 测试：长文本字段
#[test]
fn test_long_text_fields() {
    let long_text = "A".repeat(1000);
    
    let request = ContextualRefineRequest {
        msgid: long_text.clone(),
        msgctxt: Some(long_text.clone()),
        comment: Some(long_text.clone()),
        previous_entry: Some(long_text.clone()),
        next_entry: Some(long_text.clone()),
    };

    assert_eq!(request.msgid.len(), 1000);
    assert_eq!(request.msgctxt.unwrap().len(), 1000);
}

/// 测试：特殊字符处理
#[test]
fn test_special_characters() {
    let request = ContextualRefineRequest {
        msgid: "Hello \"World\" \n\t".to_string(),
        msgctxt: Some("Context with 中文".to_string()),
        comment: Some("Comment with émojis 🚀".to_string()),
        previous_entry: Some("Previous with ñ".to_string()),
        next_entry: Some("Next with 日本語".to_string()),
    };

    assert!(request.msgid.contains("\""));
    assert!(request.msgid.contains("\n"));
    assert!(request.msgctxt.unwrap().contains("中文"));
    assert!(request.comment.unwrap().contains("🚀"));
}

#[cfg(test)]
mod integration_tests {
    use super::*;

    /// 测试：典型的精翻场景
    #[test]
    fn test_typical_refine_scenario() {
        // 模拟一个待确认条目的精翻请求
        let request = ContextualRefineRequest {
            msgid: "Save File".to_string(),
            msgctxt: Some("Menu action".to_string()),
            comment: Some("// Save current file to disk".to_string()),
            previous_entry: Some("保存配置".to_string()),
            next_entry: Some("另存为...".to_string()),
        };

        // 验证请求包含足够的上下文信息
        assert!(!request.msgid.is_empty());
        assert!(request.msgctxt.is_some());
        assert!(request.comment.is_some());
        assert!(request.previous_entry.is_some());
        assert!(request.next_entry.is_some());
    }

    /// 测试：最小上下文场景
    #[test]
    fn test_minimal_context_scenario() {
        // 只有 msgid，没有其他上下文
        let request = ContextualRefineRequest {
            msgid: "OK".to_string(),
            msgctxt: None,
            comment: None,
            previous_entry: None,
            next_entry: None,
        };

        // 仍然应该是有效的请求
        assert!(!request.msgid.is_empty());
    }
}

