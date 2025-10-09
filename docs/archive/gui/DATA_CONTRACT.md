# 数据契约文档

> 简版摘要：
> - 作用：约束前后端数据结构，驱动翻译流程与统计。
> - 核心：`POEntry`、`TranslationMemory`、`TranslationStats`、`TokenStats`、`AppConfig`。
> - 规则：TM 只保存 learned 部分；Rust Option ↔ TS 可选字段；IndexMap 保序。
> - 接口：以 Tauri Commands 为边界，入参/出参遵循本页类型。

> 前后端数据格式规范，确保类型安全和一致性

---

## 📋 核心数据结构

### 1. POEntry (PO条目)

**Rust 定义** (`services/po_parser.rs`):
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct POEntry {
    pub comments: Vec<String>,
    pub msgctxt: String,
    pub msgid: String,
    pub msgstr: String,
    pub line_start: usize,
}
```

**TypeScript 定义** (`types/tauri.ts`):
```typescript
export interface POEntry {
  comments: string[];
  msgctxt: string;
  msgid: string;
  msgstr: string;
  line_start: number;
  needsReview?: boolean; // 前端扩展字段
}
```

**注意事项**:
- `needsReview` 仅在前端使用，不传递到后端
- Rust的 `usize` 对应 TypeScript的 `number`

---

### 2. TranslationMemory (翻译记忆库)

**Rust 定义** (`services/translation_memory.rs`):
```rust
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TranslationMemory {
    pub memory: IndexMap<String, String>,
    pub stats: MemoryStats,
    pub last_updated: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MemoryStats {
    pub total_entries: usize,
    pub hits: usize,
    pub misses: usize,
}
```

**TypeScript 定义**:
```typescript
export interface TranslationMemory {
  memory: Record<string, string>;
  stats: MemoryStats;
  // last_updated 在前端不使用
}

export interface MemoryStats {
  total_entries: number;
  hits: number;
  misses: number;
}
```

**保存格式** (JSON):
```json
{
  "learned": {
    "source_text": "translation",
    ...
  },
  "last_updated": "2025-01-06T10:00:00Z",
  "stats": {
    "total_entries": 95,
    "learned_entries": 12,
    "builtin_entries": 83,
    "hits": 0,
    "misses": 0
  }
}
```

**关键规则**:
1. **加载**: 合并内置 + 学习部分
2. **保存**: 只保存 `learned` 字段
3. **内置短语**: 不会被保存到文件

---

### 3. TranslationStats (翻译统计)

**Rust 定义** (`services/ai_translator.rs`):
```rust
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TranslationStats {
    pub total: usize,
    pub tm_hits: usize,
    pub deduplicated: usize,
    pub ai_translated: usize,
    pub token_stats: TokenStats,
    pub tm_learned: usize,
}
```

**TypeScript 定义**:
```typescript
export interface TranslationStats {
  total: number;
  tm_hits: number;
  deduplicated: number;
  ai_translated: number;
  token_stats: TokenStats;
  tm_learned: number;
}
```

**计算逻辑**:
```
total = 总条目数
tm_hits = 翻译记忆库命中数
deduplicated = 去重后的唯一文本数
ai_translated = 实际调用AI的次数 (= deduplicated - tm_hits)
tm_learned = 新学习的短语数 (满足is_simple_phrase条件)

节省的API调用 = tm_hits + (total - deduplicated)
```

---

### 4. TokenStats (Token统计)

**Rust 定义**:
```rust
#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct TokenStats {
    pub input_tokens: usize,
    pub output_tokens: usize,
    pub total_tokens: usize,
    pub cost: f64,
}
```

**TypeScript 定义**:
```typescript
export interface TokenStats {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  cost: number; // 预估费用（人民币）
}
```

**费用计算** (Moonshot v1):
```rust
const INPUT_PRICE: f64 = 12.0 / 1_000_000.0;   // ¥12/百万tokens
const OUTPUT_PRICE: f64 = 12.0 / 1_000_000.0;  // ¥12/百万tokens

cost = (input_tokens as f64 * INPUT_PRICE) 
     + (output_tokens as f64 * OUTPUT_PRICE)
```

---

### 5. AppConfig (应用配置)

**Rust 定义** (`services/config_manager.rs`):
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub api_key: String,
    pub provider: String,
    pub model: String,
    pub base_url: Option<String>,
    pub use_translation_memory: bool,
    pub translation_memory_path: Option<String>,
    pub log_level: String,
    pub auto_save: bool,
    pub batch_size: usize,
    pub max_concurrent: usize,
    pub timeout_seconds: u64,
}
```

**TypeScript 定义**:
```typescript
export interface AppConfig {
  api_key: string;
  provider: string;
  model: string;
  base_url?: string;
  use_translation_memory: boolean;
  translation_memory_path?: string;
  log_level: string;
  auto_save: boolean;
  batch_size: number;
  max_concurrent: number;
  timeout_seconds: number;
}
```

**默认值**:
```rust
AppConfig {
    api_key: String::new(),
    provider: "moonshot".to_string(),
    model: "moonshot-v1-auto".to_string(),
    base_url: Some("https://api.moonshot.cn/v1".to_string()),
    use_translation_memory: true,
    translation_memory_path: Some("../data/translation_memory.json".to_string()),
    log_level: "info".to_string(),
    auto_save: true,
    batch_size: 10,
    max_concurrent: 3,
    timeout_seconds: 30,
}
```

---

## 🔄 Tauri Commands 接口

### 1. parse_po_file

**输入**:
```typescript
{ filePath: string }
```

**输出**:
```typescript
POEntry[]
```

**错误**:
```typescript
string // 错误消息
```

---

### 2. translate_batch_with_stats

**输入**:
```typescript
{
  texts: string[],
  apiKey: string
}
```

**输出**:
```typescript
{
  translations: string[],
  stats: TranslationStats
}
```

**关键逻辑**:
1. TM预查找
2. 文本去重
3. AI批量翻译
4. 学习新短语（满足条件）
5. 返回统计信息

---

### 3. save_translation_memory

**输入**:
```typescript
{
  memory: {
    memory: Record<string, string>,
    stats: MemoryStats,
    last_updated: string
  }
}
```

**输出**:
```typescript
void
```

**保存逻辑**:
```rust
// 1. 分离内置和学习的部分
let builtin = get_builtin_memory();
let learned = memory.iter()
    .filter(|(k, _)| !builtin.contains_key(k))
    .collect();

// 2. 只保存learned部分
save_to_file({
    "learned": learned,
    "last_updated": Utc::now(),
    "stats": {...}
})
```

---

### 4. get_translation_memory

**输入**: 无

**输出**:
```typescript
TranslationMemory
```

**加载逻辑**:
```rust
// 1. 加载内置短语
let mut memory = get_builtin_memory();

// 2. 如果文件存在，加载learned部分
if file_exists {
    let data = read_json();
    if let Some(learned) = data.get("learned") {
        memory.extend(learned);
    }
}

// 3. 返回完整记忆库
TranslationMemory {
    memory,
    stats: {...},
    last_updated: Utc::now()
}
```

---

## 🎯 关键约定

### 1. 翻译记忆库数据流

```
┌─────────────────────────────────────────────┐
│          文件格式 (JSON)                     │
│  {                                          │
│    "learned": {                             │
│      "Custom": "自定义",  ← 只保存学习的     │
│      ...                                    │
│    }                                        │
│  }                                          │
└─────────────────┬───────────────────────────┘
                  │
                  │ 加载时合并
                  ▼
┌─────────────────────────────────────────────┐
│     内存中的完整记忆库 (IndexMap)             │
│  {                                          │
│    "XTools|Random": "XTools|随机", ← 内置   │
│    "Connection": "连接",          ← 内置    │
│    "Custom": "自定义",            ← 学习    │
│    ...                                      │
│  }                                          │
└─────────────────┬───────────────────────────┘
                  │
                  │ 保存时过滤
                  ▼
┌─────────────────────────────────────────────┐
│      只保存学习的部分                        │
│  {                                          │
│    "learned": {                             │
│      "Custom": "自定义"  ← 只保存非内置      │
│    }                                        │
│  }                                          │
└─────────────────────────────────────────────┘
```

### 2. is_simple_phrase 判断规则

**必须同时满足所有条件**:

```rust
fn is_simple_phrase(text: &str) -> bool {
    // 1. 长度检查
    if text.len() > 35 { return false; }
    
    // 2. 句子标点检查
    let endings = [". ", "! ", "? ", "。", "！", "？"];
    if endings.iter().any(|e| text.contains(e)) { return false; }
    
    // 3. 单词数检查
    if text.split_whitespace().count() > 5 { return false; }
    
    // 4. 占位符检查
    if text.contains("{0}") || text.contains("{1}") { return false; }
    
    // 5. 转义字符检查
    if text.contains("\\n") || text.contains("\\t") { return false; }
    
    // 6. 特殊符号检查
    if text.contains('(') || text.contains('[') { return false; }
    
    // 7. 疑问词开头检查
    let first = text.split_whitespace().next().unwrap_or("");
    let questions = ["Whether", "How", "What", "When", "Where", "Why"];
    if questions.contains(&first) { return false; }
    
    true
}
```

### 3. 前端保存记忆库的正确方式

**❌ 错误**:
```typescript
// 直接传递 memory 对象
await invoke('save_translation_memory', {
  memory: memoryMap  // 错误：少了一层包装
});
```

**✅ 正确**:
```typescript
// 传递完整的 TranslationMemory 结构
await invoke('save_translation_memory', {
  memory: {
    memory: memoryMap,  // 正确：符合Rust结构
    stats: { ... },
    last_updated: new Date().toISOString()
  }
});
```

### 4. 清空记忆库的正确方式

```typescript
await invoke('save_translation_memory', {
  memory: {
    memory: {},  // 空对象，不是null或undefined
    stats: {
      total_entries: 0,
      hits: 0,
      misses: 0
    },
    last_updated: new Date().toISOString()
  }
});
```

---

## ⚠️ 常见陷阱

### 1. IndexMap vs HashMap

**问题**: HashMap无序，每次加载顺序不同

**解决**: 使用IndexMap保持插入顺序

```rust
// ❌ 错误
pub memory: HashMap<String, String>

// ✅ 正确
pub memory: IndexMap<String, String>
```

### 2. 前端扩展字段

**问题**: `needsReview` 字段传到后端会导致反序列化失败

**解决**: 
- 前端： POEntry 接口包含 `needsReview?`
- 后端： POEntry 结构体不包含此字段
- 传递时不要序列化整个对象

### 3. 文件路径

**问题**: `src-tauri/data/` 会触发热重载

**解决**: 使用 `../data/` (项目根目录)

```rust
// ❌ 错误
let path = "data/translation_memory.json";

// ✅ 正确
let path = "../data/translation_memory.json";
```

### 4. 空值处理

**问题**: Rust的 `Option<T>` 和 TypeScript的 `T | undefined` 不匹配

**解决**: 
- Rust: 使用 `#[serde(skip_serializing_if = "Option::is_none")]`
- TypeScript: 使用可选属性 `field?:`

---

## 📊 类型映射表

| Rust 类型 | TypeScript 类型 | 说明 |
|-----------|----------------|------|
| `String` | `string` | 字符串 |
| `usize` | `number` | 无符号整数 |
| `f64` | `number` | 浮点数 |
| `bool` | `boolean` | 布尔值 |
| `Vec<T>` | `T[]` | 数组 |
| `HashMap<K,V>` | `Record<K,V>` | 对象/映射 |
| `IndexMap<K,V>` | `Record<K,V>` | 有序映射 |
| `Option<T>` | `T \| undefined` 或 `T?` | 可选值 |
| `DateTime<Utc>` | `string` | ISO时间字符串 |

---

## 🔍 调试技巧

### 1. 查看序列化结果

**Rust**:
```rust
let json = serde_json::to_string_pretty(&data)?;
println!("Serialized: {}", json);
```

**TypeScript**:
```typescript
console.log('Sending:', JSON.stringify(data, null, 2));
```

### 2. 验证数据格式

**前端**:
```typescript
const result = await invoke('command', params);
console.log('Received:', result);
// 检查是否符合接口定义
```

**后端**:
```rust
println!("[DEBUG] Received: {:?}", params);
```

---

**维护规则**:
1. 修改Rust结构体时，同步更新TypeScript接口
2. 添加新命令时，更新此文档
3. 发现数据不一致时，优先检查此文档

**最后更新**: 2025-01-06

