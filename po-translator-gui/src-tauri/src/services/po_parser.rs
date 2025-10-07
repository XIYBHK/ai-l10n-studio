use anyhow::{anyhow, Result};
use regex::Regex;
use std::fs;
use std::path::Path;

use crate::commands::POEntry;
use crate::services::file_chunker::FileAnalyzer;  // Phase 8: 性能优化
use crate::app_log;

#[derive(Debug, thiserror::Error)]
pub enum POParseError {
    #[error("File not found: {0}")]
    FileNotFound(String),
    #[error("Parse error: {0}")]
    ParseError(String),
    #[error("Encoding error: {0}")]
    EncodingError(String),
}

#[derive(Debug, Clone)]
pub struct POParser {
    comment_regex: Regex,
    msgctxt_regex: Regex,
    msgid_regex: Regex,
    msgstr_regex: Regex,
}

impl POParser {
    pub fn new() -> Result<Self> {
        Ok(Self {
            comment_regex: Regex::new(r"^#\s*(.+)$")?,
            msgctxt_regex: Regex::new(r#"^msgctxt\s+"(.+)"$"#)?,
            msgid_regex: Regex::new(r#"^msgid\s+"(.+)"$"#)?,
            msgstr_regex: Regex::new(r#"^msgstr\s+"(.+)"$"#)?,
        })
    }

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
        content.push_str("\n");

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

            content.push_str("\n");
        }

        fs::write(file_path, content)?;
        Ok(())
    }
}

impl Default for POParser {
    fn default() -> Self {
        Self::new().expect("Failed to create POParser")
    }
}
