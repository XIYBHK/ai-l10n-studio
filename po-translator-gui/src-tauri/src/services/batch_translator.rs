use anyhow::{anyhow, Result};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};

use crate::commands::POEntry;
use crate::services::{POParser, AITranslator, TranslationMemory, TokenStats};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranslationReport {
    pub file: String,
    pub total_entries: usize,
    pub need_translation: usize,
    pub translated: usize,
    pub failed: usize,
    pub translations: Vec<TranslationPair>,
    pub token_stats: TokenStats,
    pub deduplication: Option<DeduplicationStats>,
    pub tm_stats: Option<TranslationMemoryStats>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranslationPair {
    pub original: String,
    pub translation: String,
}

// TokenStats 已从 ai_translator 模块导入

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeduplicationStats {
    pub unique_entries: usize,
    pub duplicate_entries: usize,
    pub unique_texts: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranslationMemoryStats {
    pub cache_hits: usize,
    pub total_queries: usize,
    pub hit_rate: f64,
}

#[derive(Debug, Clone)]
pub struct BatchTranslator {
    parser: POParser,
    translator: AITranslator,
    translation_memory: TranslationMemory,
    reports: Vec<TranslationReport>,
}

impl BatchTranslator {
    pub fn new(api_key: String, base_url: Option<String>) -> Result<Self> {
        let parser = POParser::new()?;
        let translator = AITranslator::new(api_key, base_url, true)?;
        let translation_memory = TranslationMemory::new();

        Ok(Self {
            parser,
            translator,
            translation_memory,
            reports: Vec::new(),
        })
    }

    pub async fn translate_directory<P: AsRef<Path>>(
        &mut self,
        directory: P,
        progress_callback: Option<Box<dyn Fn(String, usize, usize) + Send + Sync>>,
    ) -> Result<Vec<TranslationReport>> {
        let directory = directory.as_ref();
        let mut reports = Vec::new();

        // 扫描目录中的所有PO文件
        let po_files = self.scan_po_files(directory)?;
        let total_files = po_files.len();

        for (index, file_path) in po_files.iter().enumerate() {
            if let Some(ref callback) = progress_callback {
                callback(format!("正在处理: {}", file_path.display()), index + 1, total_files);
            }

            match self.translate_po_file(file_path).await {
                Ok(report) => {
                    reports.push(report);
                    if let Some(ref callback) = progress_callback {
                        callback(format!("完成: {}", file_path.display()), index + 1, total_files);
                    }
                }
                Err(e) => {
                    eprintln!("翻译文件失败 {}: {}", file_path.display(), e);
                    // 创建失败报告
                    let failed_report = TranslationReport {
                        file: file_path.to_string_lossy().to_string(),
                        total_entries: 0,
                        need_translation: 0,
                        translated: 0,
                        failed: 1,
                        translations: Vec::new(),
                        token_stats: TokenStats {
                            input_tokens: 0,
                            output_tokens: 0,
                            total_tokens: 0,
                            cost: 0.0,
                        },
                        deduplication: None,
                        tm_stats: None,
                    };
                    reports.push(failed_report);
                }
            }
        }

        self.reports = reports.clone();
        self.generate_summary_report(&reports)?;

        Ok(reports)
    }

    async fn translate_po_file<P: AsRef<Path>>(&mut self, file_path: P) -> Result<TranslationReport> {
        let file_path = file_path.as_ref();
        
        // 解析PO文件
        let entries = self.parser.parse_file(file_path.to_string_lossy().to_string())?;
        
        // 统计信息
        let total_entries = entries.len();
        let need_translation: Vec<_> = entries
            .iter()
            .filter(|entry| !entry.msgid.is_empty() && entry.msgstr.is_empty())
            .collect();
        let need_translation_count = need_translation.len();

        if need_translation_count == 0 {
            return Ok(TranslationReport {
                file: file_path.to_string_lossy().to_string(),
                total_entries,
                need_translation: 0,
                translated: 0,
                failed: 0,
                translations: Vec::new(),
                token_stats: TokenStats {
                    input_tokens: 0,
                    output_tokens: 0,
                    total_tokens: 0,
                    cost: 0.0,
                },
                deduplication: None,
                tm_stats: None,
            });
        }

        // 去重处理
        let deduplication_stats = self.deduplicate_entries(&need_translation);
        let unique_texts = &deduplication_stats.unique_texts;

        // 翻译记忆库统计
        let mut tm_hits = 0;
        let mut tm_queries = 0;
        let mut translations_map = HashMap::new();

        // 使用翻译记忆库预翻译
        for text in unique_texts {
            tm_queries += 1;
            if let Some(translation) = self.translation_memory.get_translation(text) {
                translations_map.insert(text.clone(), translation);
                tm_hits += 1;
            }
        }

        // 翻译未命中记忆库的文本
        let untranslated_texts: Vec<String> = unique_texts
            .iter()
            .filter(|text| !translations_map.contains_key(*text))
            .cloned()
            .collect();

        let mut ai_translations = Vec::new();
        if !untranslated_texts.is_empty() {
            ai_translations = self.translator.translate_batch(untranslated_texts, None).await?;
        }

        // 合并翻译结果
        let mut ai_index = 0;
        for text in unique_texts {
            if !translations_map.contains_key(text) {
                if ai_index < ai_translations.len() {
                    translations_map.insert(text.clone(), ai_translations[ai_index].clone());
                    ai_index += 1;
                }
            }
        }

        // 更新翻译记忆库
        for (original, translation) in &translations_map {
            if self.is_simple_phrase(original) && translation.len() <= 50 {
                self.translation_memory.add_translation(original.clone(), translation.clone());
            }
        }

        // 应用翻译结果到条目
        let mut translated_count = 0;
        let mut failed_count = 0;
        let mut translation_pairs = Vec::new();
        let mut updated_entries = entries;

        for entry in &mut updated_entries {
            if !entry.msgid.is_empty() && entry.msgstr.is_empty() {
                if let Some(translation) = translations_map.get(&entry.msgid) {
                    entry.msgstr = translation.clone();
                    translation_pairs.push(TranslationPair {
                        original: entry.msgid.clone(),
                        translation: translation.clone(),
                    });
                    translated_count += 1;
                } else {
                    failed_count += 1;
                }
            }
        }

        // 保存翻译后的文件
        self.parser.write_file(
            file_path.to_string_lossy().to_string(),
            &updated_entries,
        )?;

        // 保存翻译记忆库到文件
        let memory_path = "../data/translation_memory.json";
        if let Some(parent) = std::path::Path::new(memory_path).parent() {
            std::fs::create_dir_all(parent)?;
        }
        self.translation_memory.save_to_file(memory_path)?;

        // 获取token统计
        let token_stats = self.translator.get_token_stats().clone();

        // 计算翻译记忆库命中率
        let tm_hit_rate = if tm_queries > 0 {
            tm_hits as f64 / tm_queries as f64 * 100.0
        } else {
            0.0
        };

        Ok(TranslationReport {
            file: file_path.to_string_lossy().to_string(),
            total_entries,
            need_translation: need_translation_count,
            translated: translated_count,
            failed: failed_count,
            translations: translation_pairs,
            token_stats,
            deduplication: Some(deduplication_stats),
            tm_stats: Some(TranslationMemoryStats {
                cache_hits: tm_hits,
                total_queries: tm_queries,
                hit_rate: tm_hit_rate,
            }),
        })
    }

    fn scan_po_files<P: AsRef<Path>>(&self, directory: P) -> Result<Vec<PathBuf>> {
        let directory = directory.as_ref();
        let mut po_files = Vec::new();

        if directory.is_file() {
            if directory.extension().and_then(|s| s.to_str()) == Some("po") {
                po_files.push(directory.to_path_buf());
            }
            return Ok(po_files);
        }

        let entries = fs::read_dir(directory)
            .map_err(|e| anyhow!("无法读取目录 {}: {}", directory.display(), e))?;

        for entry in entries {
            let entry = entry.map_err(|e| anyhow!("读取目录条目失败: {}", e))?;
            let path = entry.path();

            if path.is_file() {
                if let Some(extension) = path.extension() {
                    if extension == "po" {
                        po_files.push(path);
                    }
                }
            } else if path.is_dir() {
                // 递归扫描子目录
                let sub_files = self.scan_po_files(&path)?;
                po_files.extend(sub_files);
            }
        }

        po_files.sort();
        Ok(po_files)
    }

    fn deduplicate_entries(&self, entries: &[&POEntry]) -> DeduplicationStats {
        let mut unique_texts = Vec::new();
        let mut seen = std::collections::HashSet::new();
        let mut duplicate_count = 0;

        for entry in entries {
            if !seen.contains(&entry.msgid) {
                seen.insert(&entry.msgid);
                unique_texts.push(entry.msgid.clone());
            } else {
                duplicate_count += 1;
            }
        }

        DeduplicationStats {
            unique_entries: unique_texts.len(),
            duplicate_entries: duplicate_count,
            unique_texts,
        }
    }

    fn generate_summary_report(&self, reports: &[TranslationReport]) -> Result<()> {
        let log_dir = Path::new("log");
        if !log_dir.exists() {
            fs::create_dir_all(log_dir)?;
        }

        let timestamp = Utc::now().format("%Y%m%d_%H%M%S");
        let report_file = log_dir.join(format!("translation_report_{}.txt", timestamp));

        let mut content = String::new();
        
        // 写入报告头部
        content.push_str(&format!("{}\n", "=".repeat(80)));
        content.push_str("PO文件翻译报告\n");
        content.push_str(&format!("{}\n", "=".repeat(80)));
        content.push_str(&format!("生成时间: {}\n", Utc::now().format("%Y-%m-%d %H:%M:%S")));
        content.push_str(&format!("翻译文件数: {}\n", reports.len()));

        // 统计总数
        let total_entries: usize = reports.iter().map(|r| r.total_entries).sum();
        let total_need_translation: usize = reports.iter().map(|r| r.need_translation).sum();
        let total_translated: usize = reports.iter().map(|r| r.translated).sum();
        let total_failed: usize = reports.iter().map(|r| r.failed).sum();

        content.push_str(&format!("总条目数: {}\n", total_entries));
        content.push_str(&format!("需要翻译: {}\n", total_need_translation));
        content.push_str(&format!("翻译成功: {}/{}\n", total_translated, total_need_translation));
        
        if total_failed > 0 {
            content.push_str(&format!("翻译失败: {}\n", total_failed));
        }

        // Token统计
        let total_input_tokens: u32 = reports.iter().map(|r| r.token_stats.input_tokens).sum();
        let total_output_tokens: u32 = reports.iter().map(|r| r.token_stats.output_tokens).sum();
        let total_tokens: u32 = reports.iter().map(|r| r.token_stats.total_tokens).sum();
        let total_cost: f64 = reports.iter().map(|r| r.token_stats.cost).sum();

        content.push_str(&format!("\n{}\n", "-".repeat(80)));
        content.push_str("Token使用统计:\n");
        content.push_str(&format!("  输入tokens: {}\n", total_input_tokens));
        content.push_str(&format!("  输出tokens: {}\n", total_output_tokens));
        content.push_str(&format!("  总计tokens: {}\n", total_tokens));
        content.push_str(&format!("  实际费用: ¥{:.4}\n", total_cost));
        content.push_str(&format!("{}\n\n", "=".repeat(80)));

        // 每个文件的详细报告
        for (i, report) in reports.iter().enumerate() {
            content.push_str(&format!("\n{}\n", "=".repeat(80)));
            content.push_str(&format!("文件 [{}/{}]: {}\n", 
                i + 1, 
                reports.len(), 
                Path::new(&report.file).file_name().unwrap_or_default().to_string_lossy()
            ));
            content.push_str(&format!("{}\n", "=".repeat(80)));
            content.push_str(&format!("文件路径: {}\n", report.file));
            content.push_str(&format!("总条目数: {}\n", report.total_entries));
            content.push_str(&format!("需要翻译: {}\n", report.need_translation));
            content.push_str(&format!("翻译成功: {}\n", report.translated));
            
            if report.failed > 0 {
                content.push_str(&format!("翻译失败: {}\n", report.failed));
            }

            if let Some(ref dedup) = report.deduplication {
                content.push_str(&format!("唯一条目: {}\n", dedup.unique_entries));
                if dedup.duplicate_entries > 0 {
                    content.push_str(&format!("重复条目: {}\n", dedup.duplicate_entries));
                }
            }

            if let Some(ref tm) = report.tm_stats {
                content.push_str(&format!("记忆库命中: {}/{} ({:.1}%)\n", 
                    tm.cache_hits, tm.total_queries, tm.hit_rate));
            }

            content.push_str(&format!("Token使用: {} (¥{:.4})\n", 
                report.token_stats.total_tokens, report.token_stats.cost));
        }

        fs::write(&report_file, content)?;
        println!("翻译报告已保存到: {}", report_file.display());

        Ok(())
    }

    /// 判断是否是简单短语（基于 Python 版本的严格规则）
    fn is_simple_phrase(&self, text: &str) -> bool {
        // 1. 长度检查（≤30字符，更严格）
        if text.len() > 30 {
            return false;
        }
        
        // 2. 句子标点检查（包含句尾标点）
        let sentence_endings = [". ", "! ", "? ", "。", "！", "？", ".", "!", "?"];
        if sentence_endings.iter().any(|&e| text.ends_with(e)) {
            return false;
        }
        
        // 3. 单词数量检查（≤3个单词，避免采集完整句子）
        if text.split_whitespace().count() > 3 {
            return false;
        }
        
        // 4. 占位符检查
        if text.contains("{0}") || text.contains("{1}") || text.contains("{2}") {
            return false;
        }
        
        // 5. 转义字符检查
        if text.contains("\\n") || text.contains("\\t") || text.contains("\\r") {
            return false;
        }
        
        // 6. 特殊符号检查
        let special_symbols = ['(', ')', '[', ']', '→', '•', '|'];
        if special_symbols.iter().any(|&c| text.contains(c)) {
            return false;
        }
        
        // 7. 疑问句开头检查
        let question_starters = ["Whether", "How", "What", "When", "Where", "Why", "Which", "Who"];
        let first_word = text.split_whitespace().next().unwrap_or("");
        if question_starters.iter().any(|&q| first_word == q) {
            return false;
        }
        
        // 8. 介词短语检查
        let text_lower = text.to_lowercase();
        let preposition_phrases = ["for ", "of ", "in the ", "on the ", "at the ", "by the ", "with the "];
        if preposition_phrases.iter().any(|&p| text_lower.contains(p)) {
            return false;
        }
        
        // 9. 描述性词汇检查
        let descriptive_words = ["duration", "spacing", "radius", "distance", "example", "tips", "mappings", "examples"];
        if descriptive_words.iter().any(|&w| text_lower.contains(w)) {
            return false;
        }
        
        true
    }

    pub fn get_reports(&self) -> &[TranslationReport] {
        &self.reports
    }

    pub fn get_translation_memory(&self) -> &TranslationMemory {
        &self.translation_memory
    }
}
