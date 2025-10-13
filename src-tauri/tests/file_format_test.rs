#![allow(clippy::unwrap_used)]

// ========== Phase 4: 文件格式检测测试 ==========

use po_translator_gui::services::file_format::{FileFormat, detect_file_format, get_file_metadata};
use std::fs;
use std::path::PathBuf;

// 辅助函数：创建临时测试文件
fn create_test_file(filename: &str, content: &str) -> PathBuf {
    let test_dir = std::env::temp_dir().join("po_translator_test");
    fs::create_dir_all(&test_dir).unwrap();

    let file_path = test_dir.join(filename);
    fs::write(&file_path, content).unwrap();

    file_path
}

// 辅助函数：清理测试文件
fn cleanup_test_file(path: &PathBuf) {
    let _ = fs::remove_file(path);
}

#[test]
fn test_detect_po_format() {
    let content = r#"
msgid ""
msgstr ""
"Language: zh-Hans\n"

msgid "Hello"
msgstr "你好"
    "#;

    let file_path = create_test_file("test.po", content);
    let result = detect_file_format(file_path.to_str().unwrap());

    assert!(result.is_ok());
    assert_eq!(result.unwrap(), FileFormat::PO);

    cleanup_test_file(&file_path);
}

#[test]
fn test_detect_json_format() {
    let content = r#"{
        "hello": "你好",
        "world": "世界"
    }"#;

    let file_path = create_test_file("test.json", content);
    let result = detect_file_format(file_path.to_str().unwrap());

    assert!(result.is_ok());
    assert_eq!(result.unwrap(), FileFormat::JSON);

    cleanup_test_file(&file_path);
}

#[test]
fn test_detect_xliff_format() {
    let content = r#"<?xml version="1.0"?>
<xliff version="1.2">
    <file source-language="en" target-language="zh-Hans">
        <body>
            <trans-unit id="1">
                <source>Hello</source>
                <target>你好</target>
            </trans-unit>
        </body>
    </file>
</xliff>"#;

    let file_path = create_test_file("test.xliff", content);
    let result = detect_file_format(file_path.to_str().unwrap());

    assert!(result.is_ok());
    assert_eq!(result.unwrap(), FileFormat::XLIFF);

    cleanup_test_file(&file_path);
}

#[test]
fn test_detect_yaml_format() {
    let content = r#"
en:
  hello: "Hello"
  world: "World"

zh-Hans:
  hello: "你好"
  world: "世界"
    "#;

    let file_path = create_test_file("test.yaml", content);
    let result = detect_file_format(file_path.to_str().unwrap());

    assert!(result.is_ok());
    assert_eq!(result.unwrap(), FileFormat::YAML);

    cleanup_test_file(&file_path);
}

#[test]
fn test_detect_format_invalid_content() {
    // PO 扩展名但内容不符合
    let content = "This is not a valid PO file";
    let file_path = create_test_file("invalid.po", content);
    let result = detect_file_format(file_path.to_str().unwrap());

    assert!(result.is_err());
    assert!(result.unwrap_err().to_string().contains("不符合 PO 格式"));

    cleanup_test_file(&file_path);
}

#[test]
fn test_detect_format_nonexistent_file() {
    let result = detect_file_format("/nonexistent/file.po");

    assert!(result.is_err());
    assert!(result.unwrap_err().to_string().contains("文件不存在"));
}

#[test]
fn test_get_po_metadata() {
    let content = r#"
msgid ""
msgstr ""
"Language: zh-Hans\n"

msgid "Hello"
msgstr "你好"

msgid "World"
msgstr "世界"
    "#;

    let file_path = create_test_file("metadata_test.po", content);
    let result = get_file_metadata(file_path.to_str().unwrap());

    assert!(result.is_ok());
    let metadata = result.unwrap();

    assert_eq!(metadata.format, FileFormat::PO);
    assert_eq!(metadata.total_entries, 2); // 2个翻译条目（不含header）
    assert!(metadata.file_path.is_some());

    cleanup_test_file(&file_path);
}

#[test]
fn test_get_json_metadata() {
    let content = r#"{
        "key1": "value1",
        "key2": "value2",
        "key3": "value3"
    }"#;

    let file_path = create_test_file("metadata_test.json", content);
    let result = get_file_metadata(file_path.to_str().unwrap());

    assert!(result.is_ok());
    let metadata = result.unwrap();

    assert_eq!(metadata.format, FileFormat::JSON);
    assert_eq!(metadata.total_entries, 3); // 3个键值对

    cleanup_test_file(&file_path);
}

#[test]
fn test_format_from_extension() {
    assert_eq!(FileFormat::from_extension("test.po"), FileFormat::PO);
    assert_eq!(FileFormat::from_extension("test.PO"), FileFormat::PO); // 大小写不敏感
    assert_eq!(FileFormat::from_extension("test.json"), FileFormat::JSON);
    assert_eq!(FileFormat::from_extension("test.JSON"), FileFormat::JSON);
    assert_eq!(FileFormat::from_extension("test.xliff"), FileFormat::XLIFF);
    assert_eq!(FileFormat::from_extension("test.xlf"), FileFormat::XLIFF);
    assert_eq!(FileFormat::from_extension("test.yaml"), FileFormat::YAML);
    assert_eq!(FileFormat::from_extension("test.yml"), FileFormat::YAML);
}

#[test]
fn test_format_from_extension_default() {
    // 未知扩展名应返回默认格式 (PO)
    assert_eq!(FileFormat::from_extension("test.txt"), FileFormat::PO);
    assert_eq!(FileFormat::from_extension("test.unknown"), FileFormat::PO);
    assert_eq!(FileFormat::from_extension("noextension"), FileFormat::PO);
}
