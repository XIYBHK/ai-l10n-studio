# 🔧 Rust 重构改进清单

## 🔴 高优先级（影响功能质量）

### 1. 补充翻译记忆库内置短语
**文件**: `src-tauri/src/services/translation_memory.rs`

**当前问题**: 仅有 20 个内置短语，Python 版本有 83+

**需要添加** (从 Python 迁移):
```rust
// XTools 命名空间
"XTools|Random" => "XTools|随机",
"XTools|Sort" => "XTools|排序",
"XTools|Array" => "XTools|数组",
"XTools|Collision" => "XTools|碰撞",
"XTools|Math" => "XTools|数学",
"XTools|String" => "XTools|字符串",
"XTools|Transform" => "XTools|Transform",
"XTools|Utilities" => "XTools|工具",
"XTools|Debug" => "XTools|调试",

// Asset Naming 相关
"Asset Naming" => "资产命名",
"Asset Naming|Validation" => "资产命名|验证",
"Asset Naming|Exclusion Rules" => "资产命名|排除规则",
"Asset Naming|Prefix" => "资产命名|前缀",
"Asset Naming|Suffix" => "资产命名|后缀",

// 常见术语
"Connection" => "连接",
"Connection Mode" => "连接模式",
"Ascending" => "升序",
"Descending" => "降序",
"Input Array" => "输入数组",
"Output Array" => "输出数组",
"Return Value" => "返回值",
// ... 更多 60+ 短语
```

**修改位置**: `get_builtin_memory()` 函数

---

### 2. 完善 `is_simple_phrase` 逻辑
**文件**: 
- `src-tauri/src/services/ai_translator.rs` (line 332-334)
- `src-tauri/src/services/batch_translator.rs` (line 399-401)

**当前实现** (3 条件):
```rust
fn is_simple_phrase(text: &str) -> bool {
    text.len() <= 30 && !text.contains('\n') && !text.contains('|')
}
```

**需要改为** (9 条件):
```rust
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
    let descriptive_words = ["duration", "spacing", "radius", "distance", "example", "tips", "mappings"];
    if descriptive_words.iter().any(|&w| text_lower.contains(w)) {
        return false;
    }
    
    true
}
```

**影响**: 避免缓存不应缓存的复杂句子，提高翻译质量

---

### 3. 实现翻译记忆库持久化
**文件**: `src-tauri/src/commands/translator.rs`

**当前实现** (line 62-66):
```rust
#[tauri::command]
pub async fn save_translation_memory(
    _memory: TranslationMemory,
) -> Result<(), String> {
    // TODO: 实现翻译记忆库保存
    Ok(())
}
```

**需要改为**:
```rust
#[tauri::command]
pub async fn save_translation_memory(
    memory: TranslationMemory,
) -> Result<(), String> {
    let memory_path = "data/translation_memory.json";
    
    // 确保 data 目录存在
    if let Some(parent) = std::path::Path::new(memory_path).parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    
    memory.save_to_file(memory_path).map_err(|e| e.to_string())?;
    Ok(())
}

// 同时修改 get_translation_memory 从文件加载
#[tauri::command]
pub async fn get_translation_memory() -> Result<TranslationMemory, String> {
    let memory_path = "data/translation_memory.json";
    
    if std::path::Path::new(memory_path).exists() {
        TranslationMemory::load_from_file(memory_path).map_err(|e| e.to_string())
    } else {
        Ok(TranslationMemory::new())
    }
}
```

---

## 🟡 中优先级（代码清理）

### 4. 删除未使用的 Python Bridge
**文件**: `src-tauri/src/services/python_bridge.rs`

**操作**:
```bash
rm src-tauri/src/services/python_bridge.rs
```

**原因**: 已不再使用，完全由 Rust 实现

---

### 5. 归档或删除 Python 后端
**目录**: `python-backend/`

**选项 1 - 归档** (推荐):
```bash
mv python-backend python-backend.archive
```

**选项 2 - 完全删除**:
```bash
rm -rf python-backend
```

**原因**: 前端已不再调用 Python

---

### 6. 添加翻译记忆库自动保存
**文件**: `src-tauri/src/services/batch_translator.rs`

**在 `translate_po_file` 函数末尾添加**:
```rust
// 保存翻译记忆库 (line 254 附近)
self.translation_memory
    .save_to_file("data/translation_memory.json")
    .map_err(|e| anyhow!("保存翻译记忆库失败: {}", e))?;
```

---

## 🟢 低优先级（可选优化）

### 7. 添加单元测试
**创建文件**: `src-tauri/src/services/translation_memory_test.rs`

```rust
#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_is_simple_phrase() {
        // 应该接受的短语
        assert!(is_simple_phrase("Connection"));
        assert!(is_simple_phrase("Ascending"));
        assert!(is_simple_phrase("XTools Sort"));
        
        // 应该拒绝的短语
        assert!(!is_simple_phrase("Whether to sort ascending or descending"));
        assert!(!is_simple_phrase("This is a sentence with placeholder {0}"));
        assert!(!is_simple_phrase("Text with\\nline break"));
    }
    
    #[test]
    fn test_builtin_phrases() {
        let memory = get_builtin_memory();
        assert!(memory.contains_key("XTools|Random"));
        assert_eq!(memory.get("Ascending"), Some(&"升序".to_string()));
    }
}
```

---

### 8. 改进错误提示
**文件**: `src-tauri/src/services/ai_translator.rs`

**在翻译失败时提供更详细的错误信息**:
```rust
.map_err(|e| anyhow!("翻译请求失败: {}. 请检查API密钥和网络连接", e))?
```

---

### 9. 添加日志功能
**添加依赖** (Cargo.toml):
```toml
log = "0.4"
env_logger = "0.11"
```

**在关键位置添加日志**:
```rust
log::info!("开始翻译 {} 个条目", texts.len());
log::debug!("翻译记忆库命中率: {:.1}%", hit_rate);
log::warn!("占位符数量不匹配: {} -> {}", original, translation);
```

---

## 📋 实施顺序建议

1. ✅ **先做**: 高优先级 1-3（功能完整性）
2. 🧹 **再做**: 中优先级 4-6（代码清理）
3. 🎨 **最后**: 低优先级 7-9（锦上添花）

---

## 🎯 完成后的效果

- ✅ 翻译效率提升（更多内置短语）
- ✅ 翻译质量提升（更严格的短语识别）
- ✅ 翻译记忆持久化（不丢失学习内容）
- ✅ 更清晰的代码结构（删除冗余文件）
- ✅ 更好的用户体验（更详细的错误提示）

---

**预计完成时间**: 
- 高优先级: 2-3 小时
- 中优先级: 30 分钟
- 低优先级: 1-2 小时

**总计**: 约 4-6 小时可完成全部改进

