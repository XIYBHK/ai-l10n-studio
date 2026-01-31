use anyhow::{Result, bail};
use std::path::{Path, PathBuf};

pub struct SafePathValidator {
    allowed_extensions: Vec<String>,
}

impl SafePathValidator {
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

    pub fn validate_file_path(&self, path: &str) -> Result<PathBuf> {
        let path_buf = PathBuf::from(path);

        if !path_buf.exists() && !path.contains("new_") {
            bail!("路径不存在: {}", path);
        }

        let canonical = if path_buf.exists() {
            path_buf
                .canonicalize()
                .map_err(|e| anyhow::anyhow!("无法规范化路径: {}", e))?
        } else if let Some(parent) = path_buf.parent() {
            if !parent.exists() {
                bail!("父目录不存在: {:?}", parent);
            }
            parent
                .canonicalize()
                .map_err(|e| anyhow::anyhow!("无法规范化父目录: {}", e))?
                .join(
                    path_buf
                        .file_name()
                        .ok_or_else(|| anyhow::anyhow!("Invalid file path: no file name"))?,
                )
        } else {
            path_buf
        };

        if let Some(ext) = canonical.extension() {
            let ext_str = ext.to_str().unwrap_or("");
            if !self.allowed_extensions.contains(&ext_str.to_lowercase()) {
                bail!("不支持的文件类型: .{}", ext_str);
            }
        }

        self.check_forbidden_directories(&canonical)?;

        Ok(canonical)
    }

    pub fn validate_dir_path(&self, path: &str) -> Result<PathBuf> {
        let path_buf = PathBuf::from(path);

        if !path_buf.exists() {
            bail!("目录不存在: {}", path);
        }

        if !path_buf.is_dir() {
            bail!("不是有效的目录: {}", path);
        }

        let canonical = path_buf
            .canonicalize()
            .map_err(|e| anyhow::anyhow!("无法规范化目录路径: {}", e))?;

        self.check_forbidden_directories(&canonical)?;

        Ok(canonical)
    }

    fn check_forbidden_directories(&self, path: &Path) -> Result<()> {
        let forbidden_patterns = [
            "system32",
            "windows",
            "program files",
            ".ssh",
            ".git",
            "node_modules",
        ];

        let path_str = path.to_str().unwrap_or("").to_lowercase();
        for pattern in &forbidden_patterns {
            if path_str.contains(pattern) {
                bail!("禁止访问敏感目录: {}", pattern);
            }
        }
        Ok(())
    }
}

impl Default for SafePathValidator {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
#[allow(clippy::unwrap_used)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_po_file() {
        let _validator = SafePathValidator::new();
        // 这个测试需要实际文件存在才能通过
        // 仅作为示例
    }

    #[test]
    fn test_reject_forbidden_extension() {
        let _validator = SafePathValidator::new();
        let _result = _validator.validate_file_path("test.exe");
        assert!(_result.is_err());
    }
}
