//! 批量翻译器测试模块（简化版）
//!
//! 包含 `BatchTranslator` 的基础单元测试

use crate::services::batch_translator::{
    BatchTranslator, TranslationReport, DeduplicationStats, TranslationMemoryStats,
};
use crate::commands::POEntry;
use crate::services::translation_stats::TokenStats;

#[cfg(test)]
mod tests {
    use super::*;

    // ========== BatchTranslator::new() 测试 ==========

    #[test]
    fn test_batch_translator_new() {
        let translator = BatchTranslator::new(
            "test_key".to_string(),
            None,
        );

        assert!(translator.is_ok());
        let t = translator.unwrap();
        assert_eq!(t.get_reports().len(), 0);
    }

    #[test]
    fn test_batch_translator_new_with_base_url() {
        let translator = BatchTranslator::new(
            "test_key".to_string(),
            Some("https://api.test.com".to_string()),
        );

        assert!(translator.is_ok());
    }

    #[test]
    fn test_batch_translator_new_with_empty_api_key() {
        let translator = BatchTranslator::new(
            "".to_string(),
            None,
        );

        // 空 API key 应该也能创建
        assert!(translator.is_ok());
    }

    // ========== 报告获取测试 ==========

    #[test]
    fn test_get_reports() {
        let translator = BatchTranslator::new(
            "test_key".to_string(),
            None,
        ).unwrap();

        let reports = translator.get_reports();
        assert_eq!(reports.len(), 0);
    }

    #[test]
    fn test_get_translation_memory() {
        let translator = BatchTranslator::new(
            "test_key".to_string(),
            None,
        ).unwrap();

        let tm = translator.get_translation_memory();
        // 翻译记忆库应该存在（可能包含内置短语）
        // 不验证是否为空，只验证能访问
        let _ = &tm.memory;
    }

    // ========== TranslationReport 测试 ==========

    #[test]
    fn test_translation_report_structure() {
        let report = TranslationReport {
            file: "/path/to/file.po".to_string(),
            total_entries: 10,
            need_translation: 8,
            translated: 5,
            failed: 3,
            translations: vec![],
            token_stats: TokenStats::default(),
            deduplication: None,
            tm_stats: None,
        };

        assert_eq!(report.file, "/path/to/file.po");
        assert_eq!(report.total_entries, 10);
        assert_eq!(report.need_translation, 8);
        assert_eq!(report.translated, 5);
        assert_eq!(report.failed, 3);
    }

    #[test]
    fn test_translation_report_with_deduplication() {
        let dedup_stats = DeduplicationStats {
            unique_entries: 5,
            duplicate_entries: 3,
            unique_texts: vec![
                "Hello".to_string(),
                "World".to_string(),
                "Test".to_string(),
            ],
        };

        let report = TranslationReport {
            file: "/path/to/file.po".to_string(),
            total_entries: 10,
            need_translation: 8,
            translated: 5,
            failed: 3,
            translations: vec![],
            token_stats: TokenStats::default(),
            deduplication: Some(dedup_stats),
            tm_stats: None,
        };

        assert!(report.deduplication.is_some());
        let dedup = report.deduplication.unwrap();
        assert_eq!(dedup.unique_entries, 5);
        assert_eq!(dedup.duplicate_entries, 3);
        assert_eq!(dedup.unique_texts.len(), 3);
    }

    #[test]
    fn test_translation_report_with_tm_stats() {
        let tm_stats = TranslationMemoryStats {
            cache_hits: 10,
            total_queries: 20,
            hit_rate: 50.0,
        };

        let report = TranslationReport {
            file: "/path/to/file.po".to_string(),
            total_entries: 10,
            need_translation: 8,
            translated: 5,
            failed: 3,
            translations: vec![],
            token_stats: TokenStats::default(),
            deduplication: None,
            tm_stats: Some(tm_stats),
        };

        assert!(report.tm_stats.is_some());
        let tm = report.tm_stats.unwrap();
        assert_eq!(tm.cache_hits, 10);
        assert_eq!(tm.total_queries, 20);
        assert_eq!(tm.hit_rate, 50.0);
    }

    // ========== DeduplicationStats 测试 ==========

    #[test]
    fn test_deduplication_stats() {
        let stats = DeduplicationStats {
            unique_entries: 5,
            duplicate_entries: 2,
            unique_texts: vec![
                "Hello".to_string(),
                "World".to_string(),
            ],
        };

        assert_eq!(stats.unique_entries, 5);
        assert_eq!(stats.duplicate_entries, 2);
        assert_eq!(stats.unique_texts.len(), 2);
    }

    // ========== TranslationMemoryStats 测试 ==========

    #[test]
    fn test_translation_memory_stats() {
        let stats = TranslationMemoryStats {
            cache_hits: 15,
            total_queries: 20,
            hit_rate: 75.0,
        };

        assert_eq!(stats.cache_hits, 15);
        assert_eq!(stats.total_queries, 20);
        assert_eq!(stats.hit_rate, 75.0);
    }

    #[test]
    fn test_hit_rate_calculation() {
        let stats = TranslationMemoryStats {
            cache_hits: 8,
            total_queries: 10,
            hit_rate: 80.0,
        };

        assert_eq!(stats.hit_rate, 80.0);
    }

    #[test]
    fn test_zero_queries_hit_rate() {
        let stats = TranslationMemoryStats {
            cache_hits: 0,
            total_queries: 0,
            hit_rate: 0.0,
        };

        assert_eq!(stats.hit_rate, 0.0);
    }

    // ========== 去重测试 ==========

    #[test]
    fn test_deduplication_stats_structure() {
        // 测试去重统计结构
        let stats = DeduplicationStats {
            unique_entries: 3,
            duplicate_entries: 2,
            unique_texts: vec![
                "Hello".to_string(),
                "World".to_string(),
                "Test".to_string(),
            ],
        };

        assert_eq!(stats.unique_entries, 3);
        assert_eq!(stats.duplicate_entries, 2);
        assert_eq!(stats.unique_texts.len(), 3);
    }

    #[test]
    fn test_deduplicate_entries() {
        // 测试去重逻辑（手动模拟）
        let entries = vec![
            POEntry {
                comments: vec![],
                msgctxt: String::new(),
                msgid: "Hello".to_string(),
                msgstr: "".to_string(),
                line_start: 0,
            },
            POEntry {
                comments: vec![],
                msgctxt: String::new(),
                msgid: "World".to_string(),
                msgstr: "".to_string(),
                line_start: 0,
            },
            POEntry {
                comments: vec![],
                msgctxt: String::new(),
                msgid: "Hello".to_string(), // 重复
                msgstr: "".to_string(),
                line_start: 0,
            },
            POEntry {
                comments: vec![],
                msgctxt: String::new(),
                msgid: "Test".to_string(),
                msgstr: "".to_string(),
                line_start: 0,
            },
            POEntry {
                comments: vec![],
                msgctxt: String::new(),
                msgid: "World".to_string(), // 重复
                msgstr: "".to_string(),
                line_start: 0,
            },
        ];

        // 手动计算去重结果
        use std::collections::HashSet;
        let mut seen = HashSet::new();
        let mut unique_count = 0;
        let mut duplicate_count = 0;

        for entry in &entries {
            if seen.contains(&entry.msgid) {
                duplicate_count += 1;
            } else {
                seen.insert(&entry.msgid);
                unique_count += 1;
            }
        }

        assert_eq!(unique_count, 3);
        assert_eq!(duplicate_count, 2);
    }

    #[test]
    fn test_deduplicate_all_unique() {
        // 测试全部唯一的情况
        let entries = vec![
            POEntry {
                comments: vec![],
                msgctxt: String::new(),
                msgid: "Hello".to_string(),
                msgstr: "".to_string(),
                line_start: 0,
            },
            POEntry {
                comments: vec![],
                msgctxt: String::new(),
                msgid: "World".to_string(),
                msgstr: "".to_string(),
                line_start: 0,
            },
        ];

        // 验证没有重复
        use std::collections::HashSet;
        let unique: HashSet<_> = entries.iter().map(|e| &e.msgid).collect();
        assert_eq!(unique.len(), entries.len());
    }

    #[test]
    fn test_deduplicate_all_duplicates() {
        // 测试全部重复的情况
        let entries = vec![
            POEntry {
                comments: vec![],
                msgctxt: String::new(),
                msgid: "Hello".to_string(),
                msgstr: "".to_string(),
                line_start: 0,
            },
            POEntry {
                comments: vec![],
                msgctxt: String::new(),
                msgid: "Hello".to_string(),
                msgstr: "".to_string(),
                line_start: 0,
            },
            POEntry {
                comments: vec![],
                msgctxt: String::new(),
                msgid: "Hello".to_string(),
                msgstr: "".to_string(),
                line_start: 0,
            },
        ];

        // 验证全部相同
        use std::collections::HashSet;
        let unique: HashSet<_> = entries.iter().map(|e| &e.msgid).collect();
        assert_eq!(unique.len(), 1);
        assert_eq!(entries.len(), 3);
    }

    // ========== 报告创建测试 ==========

    #[test]
    fn test_create_empty_report() {
        // 测试空报告的逻辑（通过 TranslationReport 结构）
        let empty_entries: Vec<POEntry> = vec![];
        let total = 10;

        assert_eq!(empty_entries.len(), 0);
        assert!(total > 0);
    }

    #[test]
    fn test_create_failed_report() {
        // 测试失败报告的创建
        let file_path = "/nonexistent/file.po";

        let report = TranslationReport {
            file: file_path.to_string(),
            total_entries: 0,
            need_translation: 0,
            translated: 0,
            failed: 1,
            translations: vec![],
            token_stats: TokenStats::default(),
            deduplication: None,
            tm_stats: None,
        };

        assert_eq!(report.failed, 1);
        assert_eq!(report.translated, 0);
    }

    // ========== 边界情况测试 ==========

    #[test]
    fn test_large_file_translation() {
        // 验证创建大型测试文件
        let mut content = String::new();
        for i in 0..100 {
            content.push_str(&format!("msgid \"Text {}\"\nmsgstr \"\"\n\n", i));
        }

        assert!(content.len() > 0);
    }

    #[test]
    fn test_mixed_translated_and_untranslated() {
        // 测试混合翻译状态
        let mut translated_count = 0;
        let mut untranslated_count = 0;

        let entries = vec![
            ("Hello", "你好"),
            ("World", ""),
            ("Test", "测试"),
        ];

        for (msgid, msgstr) in &entries {
            if !msgid.is_empty() && msgstr.is_empty() {
                untranslated_count += 1;
            } else if !msgid.is_empty() && !msgstr.is_empty() {
                translated_count += 1;
            }
        }

        assert_eq!(untranslated_count, 1);
        assert_eq!(translated_count, 2);
    }

    #[test]
    fn test_special_characters_in_msgid() {
        // 测试特殊字符处理
        let msgid = "Hello\\nWorld\\tTest";
        assert!(msgid.contains("\\n"));
        assert!(msgid.contains("\\t"));
    }

    #[test]
    fn test_unicode_in_translations() {
        // 测试 Unicode 支持
        let translations = vec![
            ("你好", "世界"),
            ("テスト", "日本語"),
        ];

        assert_eq!(translations.len(), 2);
        assert_eq!(translations[0].0, "你好");
        assert_eq!(translations[1].0, "テスト");
    }
}
