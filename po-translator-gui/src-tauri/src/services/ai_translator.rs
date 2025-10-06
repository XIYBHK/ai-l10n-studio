use anyhow::{anyhow, Result};
use reqwest::Client as HttpClient;
use serde::{Deserialize, Serialize};
// use std::collections::HashMap;

use crate::services::translation_memory::TranslationMemory;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenStats {
    pub input_tokens: u32,
    pub output_tokens: u32,
    pub total_tokens: u32,
    pub cost: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ChatMessage {
    role: String,
    content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ChatRequest {
    model: String,
    messages: Vec<ChatMessage>,
    temperature: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ChatResponse {
    choices: Vec<Choice>,
    usage: Option<Usage>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct Choice {
    message: ChatMessage,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct Usage {
    prompt_tokens: u32,
    completion_tokens: u32,
    total_tokens: u32,
}

#[derive(Debug, Clone)]
pub struct AITranslator {
    client: HttpClient,
    api_key: String,
    base_url: String,
    model: String,
    system_prompt: String,
    conversation_history: Vec<ChatMessage>,
    max_history_tokens: usize,
    token_stats: TokenStats,
    use_tm: bool,
    tm: Option<TranslationMemory>,
}

impl AITranslator {
    pub fn new(api_key: String, base_url: Option<String>, use_tm: bool) -> Result<Self> {
        let client = HttpClient::new();
        let base_url = base_url.unwrap_or_else(|| "https://api.moonshot.cn/v1".to_string());
        let system_prompt = Self::get_system_prompt();
        
        Ok(Self {
            client,
            api_key,
            base_url,
            model: "moonshot-v1-auto".to_string(),
            system_prompt,
            conversation_history: Vec::new(),
            max_history_tokens: 2000,
            token_stats: TokenStats {
                input_tokens: 0,
                output_tokens: 0,
                total_tokens: 0,
                cost: 0.0,
            },
            use_tm,
            tm: if use_tm { Some(TranslationMemory::new()) } else { None },
        })
    }

    fn get_system_prompt() -> String {
        r#"你是一位专业的游戏开发和Unreal Engine本地化专家，精通中英文翻译。

【翻译规则】
1. 术语保留英文: Actor/Blueprint/Component/Transform/Mesh/Material/Widget/Collision/Array/Float/Integer
2. 固定翻译: Asset→资产, Unique→去重, Slice→截取, Primitives→基础类型, Constant Speed→匀速, Stream→流送, Ascending→升序, Descending→降序
3. Category翻译: 保持XTools等命名空间和|符号, 如 XTools|Sort|Actor → XTools|排序|Actor
4. 格式保留: 必须保持|、{}、%%、[]、()、\n、\t、{0}、{1}等所有特殊符号和占位符
5. 翻译风格: 准确(信)、流畅(达)、专业(雅), 无多余空格
6. 特殊表达: in-place→原地, by value→按值, True→为True, False→为False

请保持翻译风格一致，参考之前的翻译术语。"#.to_string()
    }

    pub async fn translate_batch(
        &mut self,
        texts: Vec<String>,
        progress_callback: Option<Box<dyn Fn(usize, String) + Send + Sync>>,
    ) -> Result<Vec<String>> {
        if texts.is_empty() {
            return Ok(Vec::new());
        }

        // 使用翻译记忆库进行预翻译
        let mut result = vec![String::new(); texts.len()];
        let mut untranslated_indices = Vec::new();

        if let Some(ref mut tm) = self.tm {
            for (i, text) in texts.iter().enumerate() {
                if let Some(translation) = tm.get_translation(text) {
                    result[i] = translation;
                } else {
                    untranslated_indices.push(i);
                }
            }
        } else {
            untranslated_indices = (0..texts.len()).collect();
        }

        // 翻译未命中记忆库的文本
        if !untranslated_indices.is_empty() {
            let untranslated_texts: Vec<String> = untranslated_indices
                .iter()
                .map(|&i| texts[i].clone())
                .collect();

            let ai_translations = self.translate_with_ai(untranslated_texts).await?;

            // 将AI翻译结果填入结果数组
            for (j, translation) in ai_translations.iter().enumerate() {
                let original_index = untranslated_indices[j];
                result[original_index] = translation.clone();

                // 调用进度回调
                if let Some(ref callback) = progress_callback {
                    callback(original_index, translation.clone());
                }
            }

            // 更新翻译记忆库（在循环外进行）
            if let Some(ref mut tm) = self.tm {
                for (j, translation) in ai_translations.iter().enumerate() {
                    let original_index = untranslated_indices[j];
                    let original_text = &texts[original_index];
                    if is_simple_phrase(original_text) && translation.len() <= 50 {
                        tm.add_translation(original_text.clone(), translation.clone());
                    }
                }
            }
        }

        Ok(result)
    }

    async fn translate_with_ai(&mut self, texts: Vec<String>) -> Result<Vec<String>> {
        let user_prompt = self.build_user_prompt(&texts);
        
        // 构建消息数组
        let messages = if self.conversation_history.is_empty() {
            vec![
                ChatMessage {
                    role: "system".to_string(),
                    content: self.system_prompt.clone(),
                },
                ChatMessage {
                    role: "user".to_string(),
                    content: user_prompt.clone(),
                },
            ]
        } else {
            let mut msgs = self.conversation_history.clone();
            msgs.push(ChatMessage {
                role: "user".to_string(),
                content: user_prompt.clone(),
            });
            msgs
        };

        // 发送请求
        let request = ChatRequest {
            model: self.model.clone(),
            messages,
            temperature: 0.3,
        };

        let response = self.client
            .post(&format!("{}/chat/completions", self.base_url))
            .header("Authorization", format!("Bearer {}", self.api_key))
            .header("Content-Type", "application/json")
            .json(&request)
            .send()
            .await?;

        let chat_response: ChatResponse = response.json().await?;

        // 更新token统计
        if let Some(usage) = chat_response.usage {
            self.token_stats.input_tokens += usage.prompt_tokens;
            self.token_stats.output_tokens += usage.completion_tokens;
            self.token_stats.total_tokens += usage.total_tokens;
            // Moonshot定价：¥0.012/1K tokens
            let batch_cost = usage.total_tokens as f64 / 1000.0 * 0.012;
            self.token_stats.cost += batch_cost;
        }

        let assistant_response = chat_response
            .choices
            .first()
            .map(|choice| &choice.message.content)
            .ok_or_else(|| anyhow!("No response content"))?;

        // 更新对话历史
        self.update_conversation_history(&user_prompt, assistant_response);

        // 解析翻译结果
        let translations = self.parse_translations(assistant_response, &texts)?;

        Ok(translations)
    }

    fn build_user_prompt(&self, texts: &[String]) -> String {
        let mut prompt = "请翻译:\n".to_string();
        for (i, text) in texts.iter().enumerate() {
            prompt.push_str(&format!("{}. {}\n", i + 1, text));
        }
        prompt
    }

    fn update_conversation_history(&mut self, user_prompt: &str, assistant_response: &str) {
        if self.conversation_history.is_empty() {
            self.conversation_history.push(ChatMessage {
                role: "system".to_string(),
                content: self.system_prompt.clone(),
            });
        }

        self.conversation_history.push(ChatMessage {
            role: "user".to_string(),
            content: user_prompt.to_string(),
        });

        self.conversation_history.push(ChatMessage {
            role: "assistant".to_string(),
            content: assistant_response.to_string(),
        });

        // 防止历史过长：保留最近10轮对话
        if self.conversation_history.len() > 21 {
            let system_msg = self.conversation_history[0].clone();
            let recent_msgs: Vec<_> = self.conversation_history.iter().rev().take(20).cloned().collect();
            self.conversation_history = vec![system_msg];
            self.conversation_history.extend(recent_msgs.into_iter().rev());
        }
    }

    fn parse_translations(&self, response: &str, original_texts: &[String]) -> Result<Vec<String>> {
        let lines: Vec<&str> = response
            .lines()
            .map(|line| line.trim())
            .filter(|line| !line.is_empty())
            .collect();

        let mut translations = Vec::new();
        for line in lines {
            // 移除可能的序号前缀
            let cleaned = regex::Regex::new(r"^\d+[\.\)、]\s*")
                .unwrap()
                .replace(line, "")
                .to_string();

            translations.push(cleaned);
        }

        // 验证特殊字符保留
        for (i, translation) in translations.iter_mut().enumerate() {
            if i < original_texts.len() {
                let original = &original_texts[i];
                
                // 检查换行符
                if original.contains("\\n") && !translation.contains("\\n") {
                    if original.ends_with("\\n") && !translation.ends_with("\\n") {
                        translation.push_str("\\n");
                    }
                }

                // 检查占位符数量
                let original_placeholders = self.count_placeholders(original);
                let translation_placeholders = self.count_placeholders(translation);
                if original_placeholders != translation_placeholders {
                    println!("Warning: Placeholder count mismatch for '{}'", original);
                }
            }
        }

        Ok(translations)
    }

    fn count_placeholders(&self, text: &str) -> usize {
        let mut count = 0;
        let mut chars = text.chars().peekable();
        
        while let Some(ch) = chars.next() {
            if ch == '{' {
                if let Some(&next) = chars.peek() {
                    if next.is_ascii_digit() {
                        count += 1;
                    }
                }
            } else if ch == '%' {
                if let Some(&next) = chars.peek() {
                    if next == '%' {
                        count += 1;
                        chars.next(); // 跳过第二个%
                    }
                }
            }
        }
        
        count
    }

    fn is_simple_phrase(&self, text: &str) -> bool {
        is_simple_phrase(text)
    }
}

/// 判断是否是简单短语（基于 Python 版本的严格规则）
fn is_simple_phrase(text: &str) -> bool {
    // 1. 长度检查（≤35字符）
    if text.len() > 35 {
        return false;
    }
    
    // 2. 句子标点检查
    let sentence_endings = [". ", "! ", "? ", "。", "！", "？"];
    if sentence_endings.iter().any(|&e| text.contains(e)) {
        return false;
    }
    
    // 3. 单词数量检查（≤5个单词）
    if text.split_whitespace().count() > 5 {
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

impl AITranslator {
    pub fn get_token_stats(&self) -> &TokenStats {
        &self.token_stats
    }

    pub fn reset_stats(&mut self) {
        self.token_stats = TokenStats {
            input_tokens: 0,
            output_tokens: 0,
            total_tokens: 0,
            cost: 0.0,
        };
    }

    pub fn clear_conversation_history(&mut self) {
        self.conversation_history.clear();
    }

    pub fn get_translation_memory(&self) -> Option<&TranslationMemory> {
        self.tm.as_ref()
    }

    pub fn get_translation_memory_mut(&mut self) -> Option<&mut TranslationMemory> {
        self.tm.as_mut()
    }
}
