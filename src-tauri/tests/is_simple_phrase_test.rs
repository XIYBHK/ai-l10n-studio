#![allow(clippy::manual_contains)]

// 测试 is_simple_phrase 函数的正确性

#[cfg(test)]
mod tests {
    // 注意：这里需要导入实际的 is_simple_phrase 函数
    // 由于它在 ai_translator.rs 中是私有的，我们在这里复制一份用于测试

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
        let question_starters = [
            "Whether", "How", "What", "When", "Where", "Why", "Which", "Who",
        ];
        let first_word = text.split_whitespace().next().unwrap_or("");
        if question_starters.iter().any(|&q| first_word == q) {
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

    #[test]
    fn test_simple_phrases_should_accept() {
        // 应该接受的简单短语
        assert!(is_simple_phrase("Connection"), "应该接受: Connection");
        assert!(is_simple_phrase("Ascending"), "应该接受: Ascending");
        assert!(is_simple_phrase("XTools Sort"), "应该接受: XTools Sort");
        assert!(is_simple_phrase("Input Array"), "应该接受: Input Array");
        assert!(is_simple_phrase("Return Value"), "应该接受: Return Value");
        assert!(is_simple_phrase("Start Index"), "应该接受: Start Index");
        assert!(is_simple_phrase("Is Valid"), "应该接受: Is Valid");
        assert!(is_simple_phrase("True"), "应该接受: True");
        assert!(is_simple_phrase("False"), "应该接受: False");
        assert!(is_simple_phrase("Default"), "应该接受: Default");
    }

    #[test]
    fn test_simple_phrases_should_reject_length() {
        // 长度超过35字符的应该拒绝
        assert!(
            !is_simple_phrase("This is a very long text that exceeds the 35 character limit"),
            "应该拒绝: 超过35字符"
        );
    }

    #[test]
    fn test_simple_phrases_should_reject_sentence_endings() {
        // 包含句子标点的应该拒绝
        assert!(
            !is_simple_phrase("This is a sentence. Another one"),
            "应该拒绝: 包含句号"
        );
        assert!(!is_simple_phrase("Really! Yes"), "应该拒绝: 包含感叹号");
        assert!(!is_simple_phrase("Is this? Maybe"), "应该拒绝: 包含问号");
    }

    #[test]
    fn test_simple_phrases_should_reject_too_many_words() {
        // 单词数超过5个的应该拒绝
        assert!(
            !is_simple_phrase("One Two Three Four Five Six"),
            "应该拒绝: 超过5个单词"
        );
    }

    #[test]
    fn test_simple_phrases_should_reject_placeholders() {
        // 包含占位符的应该拒绝
        assert!(
            !is_simple_phrase("Text with {0} placeholder"),
            "应该拒绝: 包含占位符 {{0}}"
        );
        assert!(
            !is_simple_phrase("Another {1} test"),
            "应该拒绝: 包含占位符 {{1}}"
        );
        assert!(
            !is_simple_phrase("Third {2} case"),
            "应该拒绝: 包含占位符 {{2}}"
        );
    }

    #[test]
    fn test_simple_phrases_should_reject_escape_characters() {
        // 包含转义字符的应该拒绝
        assert!(
            !is_simple_phrase("Text with\\nline break"),
            "应该拒绝: 包含 \\n"
        );
        assert!(!is_simple_phrase("Text with\\ttab"), "应该拒绝: 包含 \\t");
        assert!(
            !is_simple_phrase("Text with\\rcarriage"),
            "应该拒绝: 包含 \\r"
        );
    }

    #[test]
    fn test_simple_phrases_should_reject_special_symbols() {
        // 包含特殊符号的应该拒绝
        assert!(
            !is_simple_phrase("Text (with parentheses)"),
            "应该拒绝: 包含括号"
        );
        assert!(
            !is_simple_phrase("Text [with brackets]"),
            "应该拒绝: 包含方括号"
        );
        assert!(!is_simple_phrase("XTools|Random"), "应该拒绝: 包含竖线");
        assert!(!is_simple_phrase("Text → arrow"), "应该拒绝: 包含箭头");
    }

    #[test]
    fn test_simple_phrases_should_reject_question_starters() {
        // 疑问句开头的应该拒绝
        assert!(
            !is_simple_phrase("Whether to sort"),
            "应该拒绝: Whether 开头"
        );
        assert!(!is_simple_phrase("How to do"), "应该拒绝: How 开头");
        assert!(!is_simple_phrase("What is this"), "应该拒绝: What 开头");
        assert!(!is_simple_phrase("When to start"), "应该拒绝: When 开头");
        assert!(!is_simple_phrase("Where is it"), "应该拒绝: Where 开头");
        assert!(!is_simple_phrase("Why do this"), "应该拒绝: Why 开头");
        assert!(!is_simple_phrase("Which one"), "应该拒绝: Which 开头");
        assert!(!is_simple_phrase("Who is there"), "应该拒绝: Who 开头");
    }

    #[test]
    fn test_simple_phrases_should_reject_preposition_phrases() {
        // 介词短语应该拒绝
        assert!(
            !is_simple_phrase("for the purpose"),
            "应该拒绝: 'for ' 短语"
        );
        assert!(
            !is_simple_phrase("in the middle"),
            "应该拒绝: 'in the ' 短语"
        );
        assert!(
            !is_simple_phrase("on the table"),
            "应该拒绝: 'on the ' 短语"
        );
    }

    #[test]
    fn test_simple_phrases_should_reject_descriptive_words() {
        // 包含描述性词汇的应该拒绝
        assert!(!is_simple_phrase("Set duration"), "应该拒绝: 包含 duration");
        assert!(!is_simple_phrase("Check spacing"), "应该拒绝: 包含 spacing");
        assert!(!is_simple_phrase("Radius value"), "应该拒绝: 包含 radius");
        assert!(
            !is_simple_phrase("Some examples"),
            "应该拒绝: 包含 examples"
        );
    }

    #[test]
    fn test_edge_cases() {
        // 边界情况
        assert!(is_simple_phrase(""), "应该接受: 空字符串");
        assert!(is_simple_phrase("A"), "应该接受: 单个字符");
        assert!(
            is_simple_phrase("One Two Three Four Five"),
            "应该接受: 刚好5个单词"
        );
        assert!(
            !is_simple_phrase("One Two Three Four Five Six"),
            "应该拒绝: 超过5个单词"
        );
    }
}
