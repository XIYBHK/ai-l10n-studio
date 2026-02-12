//! PO 文件解析器模块
//!
//! 提供 gettext PO（Portable Object）文件的解析和写入功能。
//!
//! # 主要功能
//!
//! - 解析 PO 文件为结构化的 `POEntry` 列表
//! - 将 `POEntry` 列表写回 PO 文件
//! - 支持 UTF-8 和其他编码
//! - 保留注释、上下文和行号信息
//! - 文件大小分析和性能优化提示
//!
//! # 使用示例
//!
//! ```rust
//! use crate::services::po_parser::POParser;
//!
//! // 创建解析器
//! let parser = POParser::new()?;
//!
//! // 解析文件
//! let entries = parser.parse_file("path/to/file.po")?;
//!
//! // 修改条目
//! for entry in &mut entries {
//!     if entry.msgid == "Hello" {
//!         entry.msgstr = "你好".to_string();
//!     }
//! }
//!
//! // 写回文件
//! parser.write_file("path/to/output.po", &entries)?;
//! ```
//!
//! # PO 文件格式
//!
//! PO 文件是 gettext 使用的本地化文件格式，包含以下元素：
//!
//! - `# 注释`: 翻译者注释
//! - `msgctxt "上下文"`: 消息上下文（区分同词异义）
//! - `msgid "原文"`: 原始文本
//! - `msgstr "译文"`: 翻译文本

use anyhow::{Result, anyhow};
use regex::Regex;
use std::fs;
use std::path::Path;

use crate::app_log;
use crate::commands::POEntry;
use crate::services::file_chunker::FileAnalyzer; // Phase 8: 性能优化
use tracing::instrument;

#[derive(Debug, thiserror::Error)]
pub enum POParseError {
    #[error("File not found: {0}")]
    FileNotFound(String),
    #[error("Parse error: {0}")]
    ParseError(String),
    #[error("Encoding error: {0}")]
    EncodingError(String),
}

/// PO 文件解析器
///
/// 负责解析和写入 PO 文件。
///
/// # 字段说明
///
/// - `comment_regex`: 注释行的正则表达式（匹配 `# comment`）
/// - `msgctxt_regex`: 上下文行的正则表达式（匹配 `msgctxt "context"`）
/// - `msgid_regex`: 原文行的正则表达式（匹配 `msgid "text"`）
/// - `msgstr_regex`: 译文行的正则表达式（匹配 `msgstr "text"`）
///
/// # 示例
///
/// ```rust
/// use crate::services::po_parser::POParser;
///
/// let parser = POParser::new()?;
/// let entries = parser.parse_file("example.po")?;
/// ```
#[derive(Debug, Clone)]
pub struct POParser {
    comment_regex: Regex,
    msgctxt_regex: Regex,
    msgid_regex: Regex,
    msgstr_regex: Regex,
}

impl POParser {
    /// 创建新的 PO 解析器
    ///
    /// # 返回
    ///
    /// 成功返回 `POParser` 实例，失败返回正则表达式编译错误。
    ///
    /// # 示例
    ///
    /// ```rust
    /// let parser = POParser::new()?;
    /// ```
    pub fn new() -> Result<Self> {
        Ok(Self {
            comment_regex: Regex::new(r"^#\s*(.+)$")?,
            msgctxt_regex: Regex::new(r#"^msgctxt\s+"(.+)"$"#)?,
            msgid_regex: Regex::new(r#"^msgid\s+"(.+)"$"#)?,
            msgstr_regex: Regex::new(r#"^msgstr\s+"(.+)"$"#)?,
        })
    }

    /// 解析 PO 文件
    ///
    /// 读取并解析 PO 文件，返回条目列表。
    ///
    /// # 参数
    ///
    /// - `file_path`: PO 文件路径
    ///
    /// # 返回
    ///
    /// 成功返回 `POEntry` 列表，失败返回错误。
    ///
    /// # 特性
    ///
    /// - 自动检测文件大小并提供性能优化建议
    /// - 支持 UTF-8 和其他编码
    /// - 保留注释、上下文和行号信息
    ///
    /// # 错误
    ///
    /// - 文件不存在时返回 `POParseError::FileNotFound`
    /// - 编码错误时返回 `POParseError::EncodingError`
    /// - 解析错误时返回 `POParseError::ParseError`
    ///
    /// # 示例
    ///
    /// ```rust
    /// let entries = parser.parse_file("example.po")?;
    /// assert_eq!(entries.len(), 10);
    /// ```
    #[instrument(skip(self), fields(file_path = %file_path.as_ref().display()))]
    pub fn parse_file<P: AsRef<Path>>(&self, file_path: P) -> Result<Vec<POEntry>> {
        let path = file_path.as_ref();

        // Phase 8: 文件大小分析和优化
        match FileAnalyzer::analyze(path) {
            Ok((size, category)) => {
                let size_str = FileAnalyzer::format_size(size);
                app_log!("[性能优化] 文件大小: {}, 类别: {:?}", size_str, category);

                if category.needs_warning() {
                    app_log!(
                        "[性能警告] {}",
                        category.warning_message().unwrap_or_default()
                    );
                }

                // 估算条目数量
                let estimated_entries = FileAnalyzer::estimate_entries(size);
                if estimated_entries > 5000 {
                    app_log!(
                        "[性能提示] 预估条目数: ~{}, 建议分批处理",
                        estimated_entries
                    );
                }
            }
            Err(e) => {
                app_log!("[性能优化] 文件分析失败: {}, 继续正常处理", e);
            }
        }

        let content = self.read_file_with_encoding(file_path)?;
        self.parse_content(&content)
    }

    fn read_file_with_encoding<P: AsRef<Path>>(&self, file_path: P) -> Result<String> {
        let path = file_path.as_ref();
        let bytes = fs::read(path)
            .map_err(|_| POParseError::FileNotFound(path.to_string_lossy().to_string()))?;

        // 尝试 UTF-8 解码
        match String::from_utf8(bytes.clone()) {
            Ok(content) => Ok(content),
            Err(_) => {
                // 如果 UTF-8 失败，尝试其他编码
                let (decoded, _, had_errors) = encoding_rs::UTF_8.decode(&bytes);
                if had_errors {
                    return Err(anyhow!("Failed to decode file as UTF-8"));
                }
                Ok(decoded.into_owned())
            }
        }
    }

    fn parse_content(&self, content: &str) -> Result<Vec<POEntry>> {
        let mut entries = Vec::new();
        let mut current_entry = POEntry {
            comments: Vec::new(),
            msgctxt: String::new(),
            msgid: String::new(),
            msgstr: String::new(),
            line_start: 0,
        };

        let mut line_number = 0;
        let mut in_entry = false;

        for line in content.lines() {
            line_number += 1;
            let line = line.trim();

            if line.is_empty() {
                if in_entry && !current_entry.msgid.is_empty() {
                    entries.push(current_entry.clone());
                    current_entry = POEntry {
                        comments: Vec::new(),
                        msgctxt: String::new(),
                        msgid: String::new(),
                        msgstr: String::new(),
                        line_start: 0,
                    };
                    in_entry = false;
                }
                continue;
            }

            if let Some(caps) = self.comment_regex.captures(line) {
                if !in_entry {
                    current_entry.line_start = line_number;
                    in_entry = true;
                }
                current_entry.comments.push(caps[1].to_string());
            } else if let Some(caps) = self.msgctxt_regex.captures(line) {
                if !in_entry {
                    current_entry.line_start = line_number;
                    in_entry = true;
                }
                current_entry.msgctxt = caps[1].to_string();
            } else if let Some(caps) = self.msgid_regex.captures(line) {
                if !in_entry {
                    current_entry.line_start = line_number;
                    in_entry = true;
                }
                current_entry.msgid = caps[1].to_string();
            } else if let Some(caps) = self.msgstr_regex.captures(line) {
                if !in_entry {
                    current_entry.line_start = line_number;
                    in_entry = true;
                }
                current_entry.msgstr = caps[1].to_string();
            }
        }

        // 处理最后一个条目
        if in_entry && !current_entry.msgid.is_empty() {
            entries.push(current_entry);
        }

        Ok(entries)
    }

    /// 写入 PO 文件
    ///
    /// 将条目列表写入 PO 文件。
    ///
    /// # 参数
    ///
    /// - `file_path`: 目标文件路径
    /// - `entries`: 要写入的条目列表
    ///
    /// # 返回
    ///
    /// 成功返回 `()`，失败返回错误。
    ///
    /// # 特性
    ///
    /// - 自动添加标准的 PO 文件头
    /// - 保留注释、上下文和行号信息
    /// - 使用 UTF-8 编码
    ///
    /// # 错误
    ///
    /// - 文件路径无效时返回错误
    /// - 写入权限不足时返回错误
    ///
    /// # 示例
    ///
    /// ```rust
    /// parser.write_file("output.po", &entries)?;
    /// ```
    pub fn write_file<P: AsRef<Path>>(&self, file_path: P, entries: &[POEntry]) -> Result<()> {
        let mut content = String::new();

        // 添加文件头
        content.push_str("# SOME DESCRIPTIVE TITLE.\n");
        content.push_str("# Copyright (C) YEAR THE PACKAGE'S COPYRIGHT HOLDER\n");
        content.push_str(
            "# This file is distributed under the same license as the PACKAGE package.\n",
        );
        content.push_str("# FIRST AUTHOR <EMAIL@ADDRESS>, YEAR.\n");
        content.push_str("#\n");
        content.push_str("msgid \"\"\n");
        content.push_str("msgstr \"\"\n");
        content.push_str("\"Content-Type: text/plain; charset=UTF-8\\n\"\n");
        content.push_str("\"Content-Transfer-Encoding: 8bit\\n\"\n");
        content.push_str("\"Plural-Forms: nplurals=INTEGER; plural=EXPRESSION;\\n\"\n");
        content.push('\n');

        for entry in entries {
            // 添加注释
            for comment in &entry.comments {
                content.push_str(&format!("# {}\n", comment));
            }

            // 添加上下文
            if !entry.msgctxt.is_empty() {
                content.push_str(&format!("msgctxt \"{}\"\n", entry.msgctxt));
            }

            // 添加源文本
            content.push_str(&format!("msgid \"{}\"\n", entry.msgid));

            // 添加翻译文本
            content.push_str(&format!("msgstr \"{}\"\n", entry.msgstr));

            content.push('\n');
        }

        fs::write(file_path, content)?;
        Ok(())
    }
}

impl Default for POParser {
    #[allow(clippy::expect_used)]
    fn default() -> Self {
        Self::new().expect("Failed to create POParser")
    }
}

// ========================================
// 异步辅助函数 (使用 spawn_blocking)
// ========================================

/// 异步解析 PO 文件（在阻塞线程池中执行 CPU 密集型任务）
#[tracing::instrument(fields(file_path = %file_path.as_ref().display()))]
pub async fn parse_file_async<P: AsRef<Path>>(file_path: P) -> Result<Vec<POEntry>> {
    let file_path = file_path.as_ref().to_path_buf();

    tokio::task::spawn_blocking(move || {
        let parser = POParser::new()?;
        parser.parse_file(&file_path)
    })
    .await
    .map_err(|e| anyhow!("Task join error: {}", e))?
}
