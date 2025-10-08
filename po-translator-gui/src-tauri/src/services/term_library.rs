use anyhow::{anyhow, Result};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

#[cfg(feature = "ts-rs")]
use ts_rs::TS;

/// 术语库 - 存储用户翻译偏好
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TermLibrary {
    /// 术语条目
    pub terms: Vec<TermEntry>,
    
    /// 风格总结（由AI生成）
    pub style_summary: Option<StyleSummary>,
    
    /// 元数据
    pub metadata: TermLibraryMetadata,
}

/// 术语条目
#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "ts-rs", derive(TS))]
#[cfg_attr(feature = "ts-rs", ts(export, export_to = "../src/types/generated/"))]
pub struct TermEntry {
    /// 原文术语
    pub source: String,
    
    /// 用户译法
    pub user_translation: String,
    
    /// AI原译法
    pub ai_translation: String,
    
    /// 上下文（可选）
    pub context: Option<String>,
    
    /// 使用频次
    pub frequency: u32,
    
    /// 创建时间
    #[cfg_attr(feature = "ts-rs", ts(type = "string"))]
    pub created_at: DateTime<Utc>,
}

/// 风格总结
#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "ts-rs", derive(TS))]
#[cfg_attr(feature = "ts-rs", ts(export, export_to = "../src/types/generated/"))]
pub struct StyleSummary {
    /// 风格提示词文本
    pub prompt: String,
    
    /// 基于的术语数量
    pub based_on_terms: usize,
    
    /// 生成时间
    #[cfg_attr(feature = "ts-rs", ts(type = "string"))]
    pub generated_at: DateTime<Utc>,
    
    /// 版本号（每次重新生成递增）
    pub version: u32,
}

/// 术语库元数据
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TermLibraryMetadata {
    /// 总术语数
    pub total_terms: usize,
    
    /// 最后添加术语时间
    pub last_term_added: Option<DateTime<Utc>>,
    
    /// 最后更新总结时间
    pub last_summary_update: Option<DateTime<Utc>>,
    
    /// 上次生成总结时的术语数量
    pub terms_at_last_summary: usize,
}

impl TermLibrary {
    /// 创建新的空术语库
    pub fn new() -> Self {
        Self {
            terms: Vec::new(),
            style_summary: None,
            metadata: TermLibraryMetadata {
                total_terms: 0,
                last_term_added: None,
                last_summary_update: None,
                terms_at_last_summary: 0,
            },
        }
    }

    /// 从文件加载术语库
    pub fn load_from_file<P: AsRef<Path>>(path: P) -> Result<Self> {
        let path = path.as_ref();
        
        if !path.exists() {
            crate::app_log!("[术语库] 文件不存在，创建新术语库");
            return Ok(Self::new());
        }

        let content = fs::read_to_string(path)?;
        let library: Self = serde_json::from_str(&content)?;
        
        // 只在调试时输出，减少日志噪音
        // crate::app_log!("[术语库] 加载成功：{} 条术语", library.terms.len());
        
        Ok(library)
    }

    /// 保存术语库到文件
    pub fn save_to_file<P: AsRef<Path>>(&self, path: P) -> Result<()> {
        let path = path.as_ref();
        
        // 确保目录存在
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)?;
        }

        let content = serde_json::to_string_pretty(self)?;
        fs::write(path, content)?;
        
        crate::app_log!(
            "[术语库] 保存成功：{} 条术语",
            self.terms.len()
        );
        
        Ok(())
    }

    /// 添加术语
    pub fn add_term(
        &mut self,
        source: String,
        user_translation: String,
        ai_translation: String,
        context: Option<String>,
    ) -> Result<()> {
        // 检查是否已存在
        if let Some(existing) = self.terms.iter_mut().find(|t| t.source == source) {
            // 已存在，更新频次和译文
            existing.frequency += 1;
            existing.user_translation = user_translation;
            crate::app_log!("[术语库] 更新术语: {} -> {}", source, existing.user_translation);
        } else {
            // 新增术语
            let entry = TermEntry {
                source: source.clone(),
                user_translation: user_translation.clone(),
                ai_translation,
                context,
                frequency: 1,
                created_at: Utc::now(),
            };
            
            self.terms.push(entry);
            crate::app_log!("[术语库] 新增术语: {} -> {}", source, user_translation);
        }

        // 更新元数据
        self.metadata.total_terms = self.terms.len();
        self.metadata.last_term_added = Some(Utc::now());
        
        Ok(())
    }

    /// 删除术语
    pub fn remove_term(&mut self, source: &str) -> Result<()> {
        let initial_len = self.terms.len();
        self.terms.retain(|t| t.source != source);
        
        if self.terms.len() < initial_len {
            self.metadata.total_terms = self.terms.len();
            crate::app_log!("[术语库] 删除术语: {}", source);
            
            // 如果术语库被清空，清除风格总结
            if self.terms.is_empty() {
                self.style_summary = None;
                self.metadata.terms_at_last_summary = 0;
                crate::app_log!("[术语库] 术语库已清空，风格总结已清除");
            }
            
            Ok(())
        } else {
            Err(anyhow!("术语不存在: {}", source))
        }
    }

    /// 查找术语
    pub fn get_term(&self, source: &str) -> Option<&TermEntry> {
        self.terms.iter().find(|t| t.source == source)
    }

    /// 检查是否需要更新风格总结
    pub fn should_update_style_summary(&self) -> bool {
        // 1. 术语库为空，不需要总结
        if self.terms.is_empty() {
            return false;
        }
        
        // 2. 从未生成过总结
        if self.style_summary.is_none() {
            return true;
        }
        
        // 3. 新增术语超过阈值（5条）
        let new_terms = self.metadata.total_terms 
            - self.metadata.terms_at_last_summary;
        
        new_terms >= 5
    }

    /// 构建用于AI分析的提示词
    pub fn build_analysis_prompt(&self) -> String {
        let mut prompt = String::from(
            "分析用户的翻译风格偏好，生成风格指导（不超过150字）。\n\n"
        );
        
        // 按频率排序，只取前30个高频术语
        let mut sorted_terms = self.terms.clone();
        sorted_terms.sort_by(|a, b| b.frequency.cmp(&a.frequency));
        
        prompt.push_str("【术语对照】\n");
        for (idx, term) in sorted_terms.iter().take(30).enumerate() {
            let label = if sorted_terms.len() > 1 {
                format!("{}. ", idx + 1)
            } else {
                String::new()
            };
            
            prompt.push_str(&format!(
                "{}原文: {}\n   AI译: {}\n   用户译: {}\n\n",
                label,
                term.source,
                term.ai_translation,
                term.user_translation
            ));
        }
        
        prompt.push_str("【分析任务】\n");
        prompt.push_str("对比上述每组「AI译」和「用户译」，找出所有差异。\n\n");
        prompt.push_str("【检查清单】（逐一检查）\n");
        prompt.push_str("1. 词汇替换：是否有词被替换？（如：接近→邻近）\n");
        prompt.push_str("2. 下划线：用户译中是否添加了下划线_？\n");
        prompt.push_str("3. 空格：空格使用是否有变化？\n");
        prompt.push_str("4. 其他符号：是否有其他标点或符号变化？\n\n");
        prompt.push_str("【输出格式】（单行，只写发现的差异）\n");
        prompt.push_str("准确的技术翻译；词汇：[词汇偏好，无则不写]；符号：[符号偏好，无则不写]\n\n");
        prompt.push_str("【示例1 - 只有词汇差异】\n");
        prompt.push_str("准确的技术翻译；词汇偏好\"邻近\"（如：接近→邻近）\n\n");
        prompt.push_str("【示例2 - 有下划线变化】\n");
        prompt.push_str("准确的技术翻译；符号：空格改为下划线（如：资产编辑器→资产_编辑器）\n\n");
        prompt.push_str("【示例3 - 词汇和符号都有】\n");
        prompt.push_str("准确的技术翻译；词汇偏好\"移除\"（如：删除→移除）；符号：使用下划线连接");
        
        prompt
    }

    /// 更新风格总结
    pub fn update_style_summary(&mut self, summary_text: String) {
        let version = self.style_summary
            .as_ref()
            .map(|s| s.version + 1)
            .unwrap_or(1);
        
        self.style_summary = Some(StyleSummary {
            prompt: summary_text,
            based_on_terms: self.terms.len(),
            generated_at: Utc::now(),
            version,
        });
        
        // 更新元数据
        self.metadata.terms_at_last_summary = self.metadata.total_terms;
        self.metadata.last_summary_update = Some(Utc::now());
        
        crate::app_log!(
            "[术语库] 风格总结已更新 (v{}, 基于{}条术语)",
            version,
            self.terms.len()
        );
    }

    /// 获取风格提示词（用于注入翻译提示词）
    pub fn get_style_prompt(&self) -> Option<String> {
        self.style_summary.as_ref().map(|s| s.prompt.clone())
    }
}

impl Default for TermLibrary {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_create_term_library() {
        let library = TermLibrary::new();
        assert_eq!(library.terms.len(), 0);
        assert!(library.style_summary.is_none());
    }

    #[test]
    fn test_add_term() {
        let mut library = TermLibrary::new();
        
        library.add_term(
            "remove".to_string(),
            "删除".to_string(),
            "移除".to_string(),
            None,
        ).unwrap();
        
        assert_eq!(library.terms.len(), 1);
        assert_eq!(library.metadata.total_terms, 1);
    }

    #[test]
    fn test_duplicate_term_increases_frequency() {
        let mut library = TermLibrary::new();
        
        library.add_term(
            "remove".to_string(),
            "删除".to_string(),
            "移除".to_string(),
            None,
        ).unwrap();
        
        library.add_term(
            "remove".to_string(),
            "删除".to_string(),
            "移除".to_string(),
            None,
        ).unwrap();
        
        assert_eq!(library.terms.len(), 1);
        assert_eq!(library.terms[0].frequency, 2);
    }
}

