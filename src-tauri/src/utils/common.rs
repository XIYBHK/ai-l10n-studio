/// 判断是否是简单短语（统一版本）
///
/// 此函数用于确定一个文本是否适合加入翻译记忆库。
///
/// 规则：
/// 1. 长度≤20字符
/// 2. 不含句子标点
/// 3. 单词数≤3个
/// 4. 不含占位符
/// 5. 不含转义字符
/// 6. 不含特殊符号
/// 7. 不是疑问句开头
/// 8. 不是介词短语
/// 9. 不含描述性词汇
pub fn is_simple_phrase(text: &str) -> bool {
    // 1. 长度检查（≤20字符，防止学习长句）
    if text.len() > 20 {
        return false;
    }

    // 2. 句子标点检查（包含句子内部的标点）
    let sentence_endings = [". ", "! ", "? ", "。", "！", "？"];
    if sentence_endings.iter().any(|&e| text.contains(e)) {
        return false;
    }

    // 3. 单词数量检查（≤3个单词，防止学习长句）
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
    let question_starters = [
        "Whether", "How", "What", "When", "Where", "Why", "Which", "Who",
    ];
    let first_word = text.split_whitespace().next().unwrap_or("");
    if question_starters.contains(&first_word) {
        return false;
    }

    // 8. 介词短语检查
    let text_lower = text.to_lowercase();
    let preposition_phrases = [
        "for ",
        "of ",
        "in the ",
        "on the ",
        "at the ",
        "by the ",
        "with the ",
    ];
    if preposition_phrases.iter().any(|&p| text_lower.contains(p)) {
        return false;
    }

    // 9. 描述性词汇检查
    let descriptive_words = [
        "duration", "spacing", "radius", "distance", "example", "tips", "mappings", "examples",
    ];
    if descriptive_words.iter().any(|&w| text_lower.contains(w)) {
        return false;
    }

    true
}

#[cfg(test)]
#[allow(clippy::unwrap_used)]
mod tests {
    use super::*;

    #[test]
    fn test_simple_phrases() {
        // 应该通过的简单短语
        assert!(is_simple_phrase("Connection"));
        assert!(is_simple_phrase("Start Index"));
        assert!(is_simple_phrase("Random Stream"));
        assert!(is_simple_phrase("Max Value")); // 替换为不含描述性词汇的例子

        // 不应该通过的复杂短语
        assert!(!is_simple_phrase(
            "This is a long sentence that should not be learned."
        ));
        assert!(!is_simple_phrase("Value with {0} placeholder"));
        assert!(!is_simple_phrase("Text with\\nnewline"));
        assert!(!is_simple_phrase("Question: What is this?"));
        assert!(!is_simple_phrase("Description of the distance"));
        assert!(!is_simple_phrase("Max Distance")); // distance 是描述性词汇
    }
}
