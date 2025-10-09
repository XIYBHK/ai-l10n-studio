///! 文件分块处理工具
///! 用于优化大文件的读取和处理性能

use std::path::Path;
use std::fs::metadata;
use anyhow::{Result, Context};

/// 文件大小常量（单位：字节）
pub const MB: u64 = 1024 * 1024;
pub const LARGE_FILE_THRESHOLD: u64 = 10 * MB;  // 10MB
pub const HUGE_FILE_THRESHOLD: u64 = 50 * MB;   // 50MB
pub const CHUNK_SIZE: usize = 1000;              // 每次处理的条目数

/// 文件大小分类
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FileSizeCategory {
    /// 小文件 (< 10MB)
    Small,
    /// 大文件 (10MB - 50MB)
    Large,
    /// 超大文件 (> 50MB)
    Huge,
}

impl FileSizeCategory {
    /// 建议的分块大小
    pub fn suggested_chunk_size(&self) -> usize {
        match self {
            FileSizeCategory::Small => 1000,   // 一次处理1000个条目
            FileSizeCategory::Large => 500,    // 一次处理500个条目
            FileSizeCategory::Huge => 200,     // 一次处理200个条目
        }
    }

    /// 是否需要分块处理
    pub fn needs_chunking(&self) -> bool {
        matches!(self, FileSizeCategory::Large | FileSizeCategory::Huge)
    }

    /// 是否需要显示警告
    pub fn needs_warning(&self) -> bool {
        matches!(self, FileSizeCategory::Huge)
    }

    /// 获取警告消息
    pub fn warning_message(&self) -> Option<String> {
        match self {
            FileSizeCategory::Huge => {
                Some("检测到超大文件（>50MB），将采用分块处理以优化性能。".to_string())
            }
            FileSizeCategory::Large => {
                Some("检测到大文件（10-50MB），将优化处理策略。".to_string())
            }
            _ => None,
        }
    }
}

/// 文件分析器
pub struct FileAnalyzer;

impl FileAnalyzer {
    /// 分析文件大小并返回分类
    pub fn analyze<P: AsRef<Path>>(file_path: P) -> Result<(u64, FileSizeCategory)> {
        let path = file_path.as_ref();
        let metadata = metadata(path)
            .with_context(|| format!("无法读取文件元数据: {}", path.display()))?;
        
        let size = metadata.len();
        let category = Self::categorize(size);
        
        Ok((size, category))
    }

    /// 根据文件大小分类
    fn categorize(size: u64) -> FileSizeCategory {
        if size > HUGE_FILE_THRESHOLD {
            FileSizeCategory::Huge
        } else if size > LARGE_FILE_THRESHOLD {
            FileSizeCategory::Large
        } else {
            FileSizeCategory::Small
        }
    }

    /// 估算条目数量（基于文件大小的粗略估算）
    /// 假设每个条目平均占用200字节
    pub fn estimate_entries(size: u64) -> usize {
        (size / 200) as usize
    }

    /// 格式化文件大小为人类可读格式
    pub fn format_size(size: u64) -> String {
        if size < 1024 {
            format!("{} B", size)
        } else if size < MB {
            format!("{:.2} KB", size as f64 / 1024.0)
        } else if size < 1024 * MB {
            format!("{:.2} MB", size as f64 / MB as f64)
        } else {
            format!("{:.2} GB", size as f64 / (1024.0 * MB as f64))
        }
    }
}

/// 分块迭代器辅助函数
pub fn chunk_vec<T: Clone>(items: Vec<T>, chunk_size: usize) -> Vec<Vec<T>> {
    if items.is_empty() {
        return vec![];
    }

    items
        .chunks(chunk_size)
        .map(|chunk| chunk.to_vec())
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_categorize() {
        assert_eq!(FileAnalyzer::categorize(5 * MB), FileSizeCategory::Small);
        assert_eq!(FileAnalyzer::categorize(20 * MB), FileSizeCategory::Large);
        assert_eq!(FileAnalyzer::categorize(100 * MB), FileSizeCategory::Huge);
    }

    #[test]
    fn test_suggested_chunk_size() {
        assert_eq!(FileSizeCategory::Small.suggested_chunk_size(), 1000);
        assert_eq!(FileSizeCategory::Large.suggested_chunk_size(), 500);
        assert_eq!(FileSizeCategory::Huge.suggested_chunk_size(), 200);
    }

    #[test]
    fn test_format_size() {
        assert_eq!(FileAnalyzer::format_size(512), "512 B");
        assert_eq!(FileAnalyzer::format_size(1024), "1.00 KB");
        assert_eq!(FileAnalyzer::format_size(10 * MB), "10.00 MB");
        assert_eq!(FileAnalyzer::format_size(2048 * MB), "2.00 GB");
    }

    #[test]
    fn test_estimate_entries() {
        assert_eq!(FileAnalyzer::estimate_entries(20000), 100);
        assert_eq!(FileAnalyzer::estimate_entries(10 * MB), 52_428);
    }

    #[test]
    fn test_chunk_vec() {
        let items = vec![1, 2, 3, 4, 5, 6, 7];
        let chunks = chunk_vec(items, 3);
        assert_eq!(chunks.len(), 3);
        assert_eq!(chunks[0], vec![1, 2, 3]);
        assert_eq!(chunks[1], vec![4, 5, 6]);
        assert_eq!(chunks[2], vec![7]);
    }

    #[test]
    fn test_chunk_vec_empty() {
        let items: Vec<i32> = vec![];
        let chunks = chunk_vec(items, 3);
        assert_eq!(chunks.len(), 0);
    }
}

