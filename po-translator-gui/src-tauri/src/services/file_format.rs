// ========== Phase 4: 文件格式检测与元数据 ==========

use anyhow::{Result, anyhow};
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::fs;

/// 文件格式枚举
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum FileFormat {
    PO,
    JSON,
    XLIFF,
    YAML,
}

impl FileFormat {
    /// 根据扩展名推测格式
    pub fn from_extension(filename: &str) -> Self {
        let lowercase = filename.to_lowercase();
        let ext = lowercase
            .rsplit('.')
            .next()
            .unwrap_or("");
        
        match ext {
            "po" => FileFormat::PO,
            "json" => FileFormat::JSON,
            "xliff" | "xlf" => FileFormat::XLIFF,
            "yaml" | "yml" => FileFormat::YAML,
            _ => FileFormat::PO, // 默认
        }
    }
    
    /// 格式显示名称
    pub fn display_name(&self) -> &str {
        match self {
            FileFormat::PO => "PO (gettext)",
            FileFormat::JSON => "JSON",
            FileFormat::XLIFF => "XLIFF",
            FileFormat::YAML => "YAML",
        }
    }
    
    /// 支持的扩展名
    pub fn extensions(&self) -> Vec<&str> {
        match self {
            FileFormat::PO => vec![".po"],
            FileFormat::JSON => vec![".json"],
            FileFormat::XLIFF => vec![".xliff", ".xlf"],
            FileFormat::YAML => vec![".yaml", ".yml"],
        }
    }
}

/// 文件元数据
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileMetadata {
    pub format: FileFormat,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source_language: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub target_language: Option<String>,
    pub total_entries: usize,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub file_path: Option<String>,
}

/// 检测文件格式（基于扩展名和内容）
pub fn detect_file_format(file_path: &str) -> Result<FileFormat> {
    let path = Path::new(file_path);
    
    if !path.exists() {
        return Err(anyhow!("文件不存在: {}", file_path));
    }
    
    // 第一步：基于扩展名
    let filename = path
        .file_name()
        .and_then(|n| n.to_str())
        .ok_or_else(|| anyhow!("无效的文件名"))?;
    
    let format_from_ext = FileFormat::from_extension(filename);
    
    // 第二步：验证内容（简单验证）
    let content = fs::read_to_string(path)
        .map_err(|e| anyhow!("读取文件失败: {}", e))?;
    
    // 内容验证逻辑
    let verified_format = match format_from_ext {
        FileFormat::PO => {
            if content.contains("msgid") && content.contains("msgstr") {
                FileFormat::PO
            } else {
                return Err(anyhow!("文件内容不符合 PO 格式"));
            }
        }
        FileFormat::JSON => {
            // 简单 JSON 验证
            if content.trim_start().starts_with('{') || content.trim_start().starts_with('[') {
                FileFormat::JSON
            } else {
                return Err(anyhow!("文件内容不符合 JSON 格式"));
            }
        }
        FileFormat::XLIFF => {
            if content.contains("<xliff") || content.contains("<xliff") {
                FileFormat::XLIFF
            } else {
                return Err(anyhow!("文件内容不符合 XLIFF 格式"));
            }
        }
        FileFormat::YAML => {
            // YAML 较难验证，暂时只检查非 JSON/XML
            if !content.trim_start().starts_with('{') && !content.trim_start().starts_with('<') {
                FileFormat::YAML
            } else {
                return Err(anyhow!("文件内容不符合 YAML 格式"));
            }
        }
    };
    
    crate::app_log!("[文件格式检测] {} → {:?}", file_path, verified_format);
    Ok(verified_format)
}

/// 获取文件元数据
pub fn get_file_metadata(file_path: &str) -> Result<FileMetadata> {
    let format = detect_file_format(file_path)?;
    
    // 根据格式提取元数据
    let metadata = match format {
        FileFormat::PO => extract_po_metadata(file_path)?,
        FileFormat::JSON => extract_json_metadata(file_path)?,
        FileFormat::XLIFF => extract_xliff_metadata(file_path)?,
        FileFormat::YAML => extract_yaml_metadata(file_path)?,
    };
    
    Ok(metadata)
}

/// 提取 PO 文件元数据
fn extract_po_metadata(file_path: &str) -> Result<FileMetadata> {
    use crate::services::POParser;
    
    let parser = POParser::new()?;
    let entries = parser.parse_file(file_path)?;
    
    // 从 PO header 提取语言信息（简化实现）
    let content = fs::read_to_string(file_path)?;
    let source_lang = extract_po_language(&content, "Language:");
    let target_lang = extract_po_language(&content, "Language:");
    
    Ok(FileMetadata {
        format: FileFormat::PO,
        source_language: source_lang,
        target_language: target_lang,
        total_entries: entries.len(),
        file_path: Some(file_path.to_string()),
    })
}

/// 提取 JSON 文件元数据（Phase 4 简化实现）
fn extract_json_metadata(file_path: &str) -> Result<FileMetadata> {
    let content = fs::read_to_string(file_path)?;
    let json: serde_json::Value = serde_json::from_str(&content)
        .map_err(|e| anyhow!("JSON 解析失败: {}", e))?;
    
    // 计算条目数（简化：假设是 key-value 对象）
    let total_entries = if json.is_object() {
        json.as_object().map(|obj| obj.len()).unwrap_or(0)
    } else if json.is_array() {
        json.as_array().map(|arr| arr.len()).unwrap_or(0)
    } else {
        0
    };
    
    Ok(FileMetadata {
        format: FileFormat::JSON,
        source_language: None, // JSON 格式暂不提取
        target_language: None,
        total_entries,
        file_path: Some(file_path.to_string()),
    })
}

/// 提取 XLIFF 文件元数据（占位实现）
fn extract_xliff_metadata(file_path: &str) -> Result<FileMetadata> {
    // Phase 4 暂不完整实现，返回基础元数据
    Ok(FileMetadata {
        format: FileFormat::XLIFF,
        source_language: None,
        target_language: None,
        total_entries: 0,
        file_path: Some(file_path.to_string()),
    })
}

/// 提取 YAML 文件元数据（占位实现）
fn extract_yaml_metadata(file_path: &str) -> Result<FileMetadata> {
    // Phase 4 暂不完整实现，返回基础元数据
    Ok(FileMetadata {
        format: FileFormat::YAML,
        source_language: None,
        target_language: None,
        total_entries: 0,
        file_path: Some(file_path.to_string()),
    })
}

/// 从 PO 内容提取语言信息（辅助函数）
fn extract_po_language(content: &str, key: &str) -> Option<String> {
    content
        .lines()
        .find(|line| line.contains(key))
        .and_then(|line| {
            line.split(':')
                .nth(1)
                .map(|s| s.trim().trim_matches('\\').trim().to_string())
        })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_format_from_extension() {
        assert_eq!(FileFormat::from_extension("test.po"), FileFormat::PO);
        assert_eq!(FileFormat::from_extension("test.json"), FileFormat::JSON);
        assert_eq!(FileFormat::from_extension("test.xliff"), FileFormat::XLIFF);
        assert_eq!(FileFormat::from_extension("test.xlf"), FileFormat::XLIFF);
        assert_eq!(FileFormat::from_extension("test.yaml"), FileFormat::YAML);
        assert_eq!(FileFormat::from_extension("test.yml"), FileFormat::YAML);
        assert_eq!(FileFormat::from_extension("test.unknown"), FileFormat::PO); // 默认
    }

    #[test]
    fn test_format_display_name() {
        assert_eq!(FileFormat::PO.display_name(), "PO (gettext)");
        assert_eq!(FileFormat::JSON.display_name(), "JSON");
        assert_eq!(FileFormat::XLIFF.display_name(), "XLIFF");
        assert_eq!(FileFormat::YAML.display_name(), "YAML");
    }

    #[test]
    fn test_format_extensions() {
        assert_eq!(FileFormat::PO.extensions(), vec![".po"]);
        assert_eq!(FileFormat::JSON.extensions(), vec![".json"]);
        assert_eq!(FileFormat::XLIFF.extensions(), vec![".xliff", ".xlf"]);
        assert_eq!(FileFormat::YAML.extensions(), vec![".yaml", ".yml"]);
    }
}

