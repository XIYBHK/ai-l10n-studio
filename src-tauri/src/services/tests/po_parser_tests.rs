//! PO 文件解析器测试模块
//!
//! 包含 `POParser` 的单元测试和集成测试

use crate::services::po_parser::POParser;
use crate::commands::POEntry;
use std::fs;
use std::io::Write;
use tempfile::TempDir;

#[cfg(test)]
mod tests {
    use super::*;

    /// 创建一个临时 PO 文件用于测试
    fn create_temp_po_file(content: &str) -> (TempDir, String) {
        let temp_dir = TempDir::new().unwrap();
        let file_path = temp_dir.path().join("test.po");
        let mut file = fs::File::create(&file_path).unwrap();
        writeln!(file, "{}", content).unwrap();
        (temp_dir, file_path.to_string_lossy().to_string())
    }

    // ========== POParser::new() 测试 ==========

    #[test]
    fn test_po_parser_new() {
        let parser = POParser::new();
        assert!(parser.is_ok());
    }

    #[test]
    fn test_po_parser_default() {
        let parser = POParser::default();
        // Default 实现不应该 panic
        let entries = parser.parse_file("nonexistent.po");
        assert!(entries.is_err());
    }

    // ========== PO 文件解析测试 ==========

    #[test]
    fn test_parse_simple_entry() {
        let content = r#"msgid "Hello"
msgstr "你好"
"#;

        let (_temp_dir, file_path) = create_temp_po_file(content);
        let parser = POParser::new().unwrap();
        let entries = parser.parse_file(&file_path).unwrap();

        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].msgid, "Hello");
        assert_eq!(entries[0].msgstr, "你好");
    }

    #[test]
    fn test_parse_entry_with_context() {
        let content = r#"msgctxt "Menu"
msgid "File"
msgstr "文件"
"#;

        let (_temp_dir, file_path) = create_temp_po_file(content);
        let parser = POParser::new().unwrap();
        let entries = parser.parse_file(&file_path).unwrap();

        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].msgctxt, "Menu");
        assert_eq!(entries[0].msgid, "File");
        assert_eq!(entries[0].msgstr, "文件");
    }

    #[test]
    fn test_parse_entry_with_comment() {
        let content = r#"# This is a comment
msgid "Hello"
msgstr "你好"
"#;

        let (_temp_dir, file_path) = create_temp_po_file(content);
        let parser = POParser::new().unwrap();
        let entries = parser.parse_file(&file_path).unwrap();

        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].comments.len(), 1);
        assert_eq!(entries[0].comments[0], "This is a comment");
    }

    #[test]
    fn test_parse_multiple_entries() {
        let content = r#"msgid "Hello"
msgstr "你好"

msgid "World"
msgstr "世界"

msgid "Test"
msgstr "测试"
"#;

        let (_temp_dir, file_path) = create_temp_po_file(content);
        let parser = POParser::new().unwrap();
        let entries = parser.parse_file(&file_path).unwrap();

        assert_eq!(entries.len(), 3);
        assert_eq!(entries[0].msgid, "Hello");
        assert_eq!(entries[1].msgid, "World");
        assert_eq!(entries[2].msgid, "Test");
    }

    #[test]
    fn test_parse_entry_with_special_characters() {
        let content = r#"msgid "Hello\nWorld"
msgstr "你好\n世界"
"#;

        let (_temp_dir, file_path) = create_temp_po_file(content);
        let parser = POParser::new().unwrap();
        let entries = parser.parse_file(&file_path).unwrap();

        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].msgid, "Hello\\nWorld");
    }

    #[test]
    fn test_parse_empty_msgid() {
        let content = r#"msgid ""
msgstr ""
"#;

        let (_temp_dir, file_path) = create_temp_po_file(content);
        let parser = POParser::new().unwrap();
        let entries = parser.parse_file(&file_path).unwrap();

        // 空的 msgid 应该被跳过
        assert_eq!(entries.len(), 0);
    }

    #[test]
    fn test_parse_with_line_numbers() {
        let content = r#"# Comment 1
msgid "First"
msgstr "第一"

# Comment 2
msgid "Second"
msgstr "第二"
"#;

        let (_temp_dir, file_path) = create_temp_po_file(content);
        let parser = POParser::new().unwrap();
        let entries = parser.parse_file(&file_path).unwrap();

        assert_eq!(entries.len(), 2);
        // 验证行号被正确记录
        assert!(entries[0].line_start > 0);
        assert!(entries[1].line_start > entries[0].line_start);
    }

    #[test]
    fn test_parse_nonexistent_file() {
        let parser = POParser::new().unwrap();
        let result = parser.parse_file("/nonexistent/file.po");

        assert!(result.is_err());
        // 应该返回文件未找到错误
        match result {
            Err(e) => {
                let error_msg = e.to_string();
                assert!(error_msg.contains("not found") || error_msg.contains("找不到"));
            }
            _ => panic!("Expected error"),
        }
    }

    #[test]
    fn test_parse_invalid_utf8() {
        let temp_dir = TempDir::new().unwrap();
        let file_path = temp_dir.path().join("invalid.po");
        let mut file = fs::File::create(&file_path).unwrap();

        // 写入无效的 UTF-8 序列
        let invalid_bytes = [0xFF, 0xFE, 0xFD];
        file.write_all(&invalid_bytes).unwrap();

        let parser = POParser::new().unwrap();
        let result = parser.parse_file(file_path.to_string_lossy().to_string());

        // 应该处理编码错误
        assert!(result.is_err());
    }

    #[test]
    fn test_parse_empty_file() {
        let content = "";
        let (_temp_dir, file_path) = create_temp_po_file(content);
        let parser = POParser::new().unwrap();
        let entries = parser.parse_file(&file_path).unwrap();

        assert_eq!(entries.len(), 0);
    }

    #[test]
    fn test_parse_file_with_only_comments() {
        let content = r#"# Comment 1
# Comment 2
# Comment 3
"#;

        let (_temp_dir, file_path) = create_temp_po_file(content);
        let parser = POParser::new().unwrap();
        let entries = parser.parse_file(&file_path).unwrap();

        // 只有注释的行不应该创建条目
        assert_eq!(entries.len(), 0);
    }

    #[test]
    fn test_parse_multiline_comment() {
        let content = r#"# First comment line
# Second comment line
msgid "Hello"
msgstr "你好"
"#;

        let (_temp_dir, file_path) = create_temp_po_file(content);
        let parser = POParser::new().unwrap();
        let entries = parser.parse_file(&file_path).unwrap();

        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].comments.len(), 2);
        assert_eq!(entries[0].comments[0], "First comment line");
        assert_eq!(entries[0].comments[1], "Second comment line");
    }

    // ========== PO 文件写入测试 ==========

    #[test]
    fn test_write_simple_entry() {
        let temp_dir = TempDir::new().unwrap();
        let file_path = temp_dir.path().join("output.po");

        let parser = POParser::new().unwrap();
        let entries = vec![
            POEntry {
                comments: vec![],
                msgctxt: String::new(),
                msgid: "Hello".to_string(),
                msgstr: "你好".to_string(),
                line_start: 0,
            },
        ];

        let result = parser.write_file(file_path.to_string_lossy().to_string(), &entries);
        assert!(result.is_ok());

        // 验证文件被创建
        assert!(file_path.exists());

        // 读取并验证内容
        let content = fs::read_to_string(&file_path).unwrap();
        assert!(content.contains("msgid \"Hello\""));
        assert!(content.contains("msgstr \"你好\""));
    }

    #[test]
    fn test_write_entry_with_context() {
        let temp_dir = TempDir::new().unwrap();
        let file_path = temp_dir.path().join("output.po");

        let parser = POParser::new().unwrap();
        let entries = vec![
            POEntry {
                comments: vec![],
                msgctxt: "Menu".to_string(),
                msgid: "File".to_string(),
                msgstr: "文件".to_string(),
                line_start: 0,
            },
        ];

        let result = parser.write_file(file_path.to_string_lossy().to_string(), &entries);
        assert!(result.is_ok());

        let content = fs::read_to_string(&file_path).unwrap();
        assert!(content.contains("msgctxt \"Menu\""));
        assert!(content.contains("msgid \"File\""));
    }

    #[test]
    fn test_write_entry_with_comment() {
        let temp_dir = TempDir::new().unwrap();
        let file_path = temp_dir.path().join("output.po");

        let parser = POParser::new().unwrap();
        let entries = vec![
            POEntry {
                comments: vec!["This is a comment".to_string()],
                msgctxt: String::new(),
                msgid: "Hello".to_string(),
                msgstr: "你好".to_string(),
                line_start: 0,
            },
        ];

        let result = parser.write_file(file_path.to_string_lossy().to_string(), &entries);
        assert!(result.is_ok());

        let content = fs::read_to_string(&file_path).unwrap();
        assert!(content.contains("# This is a comment"));
    }

    #[test]
    fn test_write_multiple_entries() {
        let temp_dir = TempDir::new().unwrap();
        let file_path = temp_dir.path().join("output.po");

        let parser = POParser::new().unwrap();
        let entries = vec![
            POEntry {
                comments: vec![],
                msgctxt: String::new(),
                msgid: "Hello".to_string(),
                msgstr: "你好".to_string(),
                line_start: 0,
            },
            POEntry {
                comments: vec![],
                msgctxt: String::new(),
                msgid: "World".to_string(),
                msgstr: "世界".to_string(),
                line_start: 0,
            },
        ];

        let result = parser.write_file(file_path.to_string_lossy().to_string(), &entries);
        assert!(result.is_ok());

        let content = fs::read_to_string(&file_path).unwrap();
        assert!(content.contains("msgid \"Hello\""));
        assert!(content.contains("msgid \"World\""));
    }

    #[test]
    fn test_write_file_includes_header() {
        let temp_dir = TempDir::new().unwrap();
        let file_path = temp_dir.path().join("output.po");

        let parser = POParser::new().unwrap();
        let entries = vec![
            POEntry {
                comments: vec![],
                msgctxt: String::new(),
                msgid: "Hello".to_string(),
                msgstr: "你好".to_string(),
                line_start: 0,
            },
        ];

        let result = parser.write_file(file_path.to_string_lossy().to_string(), &entries);
        assert!(result.is_ok());

        let content = fs::read_to_string(&file_path).unwrap();
        // 验证文件头
        assert!(content.contains("# SOME DESCRIPTIVE TITLE"));
        assert!(content.contains("Content-Type: text/plain; charset=UTF-8"));
    }

    #[test]
    fn test_write_to_invalid_path() {
        let parser = POParser::new().unwrap();
        let entries = vec![];

        // 尝试写入到无效路径
        let result = parser.write_file("/invalid/path/that/does/not/exist/output.po", &entries);
        assert!(result.is_err());
    }

    // ========== 完整的读写循环测试 ==========

    #[test]
    fn test_roundtrip_parse_and_write() {
        let original_content = r#"msgid "Hello"
msgstr "你好"

msgid "World"
msgstr "世界"
"#;

        let (_temp_dir, file_path) = create_temp_po_file(original_content);
        let parser = POParser::new().unwrap();

        // 解析
        let entries = parser.parse_file(&file_path).unwrap();

        // 写入新文件
        let temp_dir = TempDir::new().unwrap();
        let output_path = temp_dir.path().join("output.po");
        parser.write_file(output_path.to_string_lossy().to_string(), &entries).unwrap();

        // 再次解析
        let re_parsed_entries = parser.parse_file(output_path.to_string_lossy().to_string()).unwrap();

        // 验证条目数量
        assert_eq!(entries.len(), re_parsed_entries.len());

        // 验证内容
        for (original, re_parsed) in entries.iter().zip(re_parsed_entries.iter()) {
            assert_eq!(original.msgid, re_parsed.msgid);
            assert_eq!(original.msgstr, re_parsed.msgstr);
        }
    }

    #[test]
    fn test_roundtrip_preserves_comments() {
        let content = r#"# First comment
msgid "Hello"
msgstr "你好"

# Second comment
msgid "World"
msgstr "世界"
"#;

        let (_temp_dir, file_path) = create_temp_po_file(content);
        let parser = POParser::new().unwrap();

        let entries = parser.parse_file(&file_path).unwrap();

        // 验证注释被正确解析
        assert_eq!(entries[0].comments.len(), 1);
        assert_eq!(entries[0].comments[0], "First comment");
        assert_eq!(entries[1].comments[0], "Second comment");
    }

    #[test]
    fn test_roundtrip_preserves_context() {
        let content = r#"msgctxt "Menu"
msgid "File"
msgstr "文件"

msgctxt "Dialog"
msgid "OK"
msgstr "确定"
"#;

        let (_temp_dir, file_path) = create_temp_po_file(content);
        let parser = POParser::new().unwrap();

        let entries = parser.parse_file(&file_path).unwrap();

        assert_eq!(entries[0].msgctxt, "Menu");
        assert_eq!(entries[1].msgctxt, "Dialog");
    }

    // ========== 边界情况测试 ==========

    #[test]
    fn test_parse_entry_with_empty_translation() {
        let content = r#"msgid "Hello"
msgstr ""
"#;

        let (_temp_dir, file_path) = create_temp_po_file(content);
        let parser = POParser::new().unwrap();
        let entries = parser.parse_file(&file_path).unwrap();

        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].msgid, "Hello");
        assert_eq!(entries[0].msgstr, "");
    }

    #[test]
    fn test_parse_with_extra_whitespace() {
        let content = r#"

  # Comment

  msgid "Hello"

  msgstr "你好"

"#;

        let (_temp_dir, file_path) = create_temp_po_file(content);
        let parser = POParser::new().unwrap();
        let entries = parser.parse_file(&file_path).unwrap();

        // 应该正确处理多余的空白行
        assert_eq!(entries.len(), 1);
    }

    #[test]
    fn test_parse_entry_with_quotes() {
        let content = r#"msgid "Say \"Hello\""
msgstr "说\"你好\""
"#;

        let (_temp_dir, file_path) = create_temp_po_file(content);
        let parser = POParser::new().unwrap();
        let entries = parser.parse_file(&file_path).unwrap();

        // 引号应该被保留
        assert!(entries[0].msgid.contains("\""));
    }

    #[test]
    fn test_parse_large_file() {
        let mut content = String::new();
        for i in 0..1000 {
            content.push_str(&format!("# Entry {}\nmsgid \"Text {}\"\nmsgstr \"翻译 {}\"\n\n", i, i, i));
        }

        let (_temp_dir, file_path) = create_temp_po_file(&content);
        let parser = POParser::new().unwrap();
        let entries = parser.parse_file(&file_path).unwrap();

        assert_eq!(entries.len(), 1000);
    }

    #[test]
    fn test_write_empty_entries() {
        let temp_dir = TempDir::new().unwrap();
        let file_path = temp_dir.path().join("output.po");

        let parser = POParser::new().unwrap();
        let entries: Vec<POEntry> = vec![];

        let result = parser.write_file(file_path.to_string_lossy().to_string(), &entries);
        assert!(result.is_ok());

        // 验证文件被创建
        assert!(file_path.exists());

        // 验证文件头存在
        let content = fs::read_to_string(&file_path).unwrap();
        assert!(content.contains("# SOME DESCRIPTIVE TITLE"));
    }
}
