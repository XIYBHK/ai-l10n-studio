use anyhow::{Result, anyhow, bail};
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

        if !path_buf.is_file() {
            bail!("不是可读取的文件: {}", path);
        }
        let canonical = path_buf.canonicalize()?;
        self.validate_file_target(&canonical)?;
        Ok(canonical)
    }

    pub fn validate_output_path(&self, path: &str) -> Result<PathBuf> {
        let target = Path::new(path);
        if target.exists() {
            return self.validate_file_path(path);
        }
        let parent = target
            .parent()
            .filter(|parent| parent.is_dir())
            .ok_or_else(|| anyhow!("父目录不存在: {}", path))?;
        let name = target
            .file_name()
            .ok_or_else(|| anyhow!("文件名无效: {}", path))?;
        let canonical = parent.canonicalize()?.join(name);
        self.validate_file_target(&canonical)?;
        Ok(canonical)
    }

    fn validate_file_target(&self, path: &Path) -> Result<()> {
        let extension = path
            .extension()
            .and_then(|value| value.to_str())
            .unwrap_or("");
        if !self.allowed_extensions.contains(&extension.to_lowercase()) {
            bail!("不支持的文件类型: .{}", extension);
        }
        self.check_forbidden_directories(path)
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

        for pattern in &forbidden_patterns {
            if path.components().any(|component| {
                component
                    .as_os_str()
                    .to_string_lossy()
                    .eq_ignore_ascii_case(pattern)
            }) {
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
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("output.po");
        let validator = SafePathValidator::new();
        assert!(
            validator
                .validate_output_path(&file.to_string_lossy())
                .is_ok()
        );
        assert!(
            validator
                .validate_file_path(&file.to_string_lossy())
                .is_err()
        );
        std::fs::write(&file, "").unwrap();
        assert!(
            validator
                .validate_file_path(&file.to_string_lossy())
                .is_ok()
        );
        assert!(
            validator
                .validate_output_path(&file.to_string_lossy())
                .is_ok()
        );
        assert!(
            validator
                .validate_output_path(&dir.path().to_string_lossy())
                .is_err()
        );
    }

    #[test]
    fn test_reject_forbidden_extension() {
        let dir = tempfile::tempdir().unwrap();
        let validator = SafePathValidator::new();
        for name in ["test.exe", "no-extension", "missing/output.po"] {
            assert!(
                validator
                    .validate_output_path(&dir.path().join(name).to_string_lossy())
                    .is_err()
            );
        }
    }
}
