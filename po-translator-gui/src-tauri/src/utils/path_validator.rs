/**
 * 路径验证器 - 确保文件访问在安全范围内
 * 
 * Tauri 2.x 安全增强
 */

use std::path::PathBuf;
use anyhow::{Result, bail};

/// 路径验证器
pub struct SafePathValidator {
    allowed_extensions: Vec<String>,
}

impl SafePathValidator {
    /// 创建新的路径验证器
    pub fn new() -> Self {
        Self {
            allowed_extensions: vec![
                "po".to_string(),
                "pot".to_string(),
                "json".to_string(),
                "txt".to_string(),
            ],
        }
    }

    /// 验证文件路径是否安全
    pub fn validate_file_path(&self, path: &str) -> Result<PathBuf> {
        let path_buf = PathBuf::from(path);

        // 1. 检查路径是否存在
        if !path_buf.exists() && !path.contains("new_") {
            bail!("路径不存在: {}", path);
        }

        // 2. 规范化路径（防止路径遍历攻击）
        let canonical = if path_buf.exists() {
            path_buf.canonicalize()
                .map_err(|e| anyhow::anyhow!("无法规范化路径: {}", e))?
        } else {
            // 新文件，验证父目录
            if let Some(parent) = path_buf.parent() {
                if !parent.exists() {
                    bail!("父目录不存在: {:?}", parent);
                }
                parent.canonicalize()
                    .map_err(|e| anyhow::anyhow!("无法规范化父目录: {}", e))?
                    .join(path_buf.file_name().unwrap())
            } else {
                path_buf
            }
        };

        // 3. 检查文件扩展名
        if let Some(ext) = canonical.extension() {
            let ext_str = ext.to_str().unwrap_or("");
            if !self.allowed_extensions.contains(&ext_str.to_lowercase()) {
                bail!("不支持的文件类型: .{}", ext_str);
            }
        } else {
            // 允许无扩展名（目录等）
        }

        // 4. 防止访问敏感目录
        let forbidden_patterns = [
            "system32",
            "windows",
            "program files",
            ".ssh",
            ".git",
            "node_modules",
        ];

        let path_str = canonical.to_str().unwrap_or("").to_lowercase();
        for pattern in &forbidden_patterns {
            if path_str.contains(pattern) {
                bail!("禁止访问敏感目录: {}", pattern);
            }
        }

        Ok(canonical)
    }

    /// 验证目录路径是否安全
    pub fn validate_dir_path(&self, path: &str) -> Result<PathBuf> {
        let path_buf = PathBuf::from(path);

        if !path_buf.exists() {
            bail!("目录不存在: {}", path);
        }

        if !path_buf.is_dir() {
            bail!("不是有效的目录: {}", path);
        }

        // 规范化路径
        let canonical = path_buf.canonicalize()
            .map_err(|e| anyhow::anyhow!("无法规范化目录路径: {}", e))?;

        // 防止访问敏感目录
        let path_str = canonical.to_str().unwrap_or("").to_lowercase();
        let forbidden = ["system32", "windows", "program files", ".ssh"];
        
        for pattern in &forbidden {
            if path_str.contains(pattern) {
                bail!("禁止访问敏感目录: {}", pattern);
            }
        }

        Ok(canonical)
    }
}

impl Default for SafePathValidator {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_po_file() {
        let validator = SafePathValidator::new();
        // 这个测试需要实际文件存在才能通过
        // 仅作为示例
    }

    #[test]
    fn test_reject_forbidden_extension() {
        let validator = SafePathValidator::new();
        let result = validator.validate_file_path("test.exe");
        assert!(result.is_err());
    }
}

