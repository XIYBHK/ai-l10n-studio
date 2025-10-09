## 数据契约（简版）

### 类型安全的前后端契约

#### 自动生成的 TypeScript 类型 (`src/types/generated/`)
**Rust → TypeScript** 单向生成（使用 `ts-rs` 可选支持）：

**配置类型**:
- `AIConfig` - AI 提供商配置（API Key、模型、参数）
- `AppConfig` - 应用全局配置（代理、日志、性能）
- `ProxyConfig` - 代理设置（HTTP/SOCKS5）
- `ProviderType` - AI 提供商枚举（8 种）

**翻译数据**:
- `POEntry` - PO 文件条目（msgid/msgstr/注释/位置）
- `TranslationPair` - 翻译对（源文本 → 目标文本 + 元数据）
- `TermEntry` - 术语库条目（术语 + 翻译 + 标签 + 风格）

**统计与报告**:
- `TranslationStats` - 翻译统计（Token/耗时/成功率）
- `TokenStats` - Token 使用详情（输入/输出/成本）
- `DeduplicationStats` - 去重统计（原始/去重后/节省比例）
- `TranslationReport` - 完整翻译报告（聚合所有指标）

### 统计事件契约（前后端）

Channel/Event 端字段存在差异：
- Channel: `prompt_tokens` / `completion_tokens`
- Event  : `input_tokens` / `output_tokens`

归一化映射（由 `normalizeStats` 实现）：
```
input_tokens  = prompt_tokens    | input_tokens  | 0
output_tokens = completion_tokens| output_tokens | 0
total_tokens  = total_tokens     | input+output  | 0
cost          = cost             | 0
total         = total            | fallbackTotal | 0
```

事件流：
- `translation:stats`（批次）→ 会话累计
- `translation:after`（完成）→ 累计（持久化）

**语言与元数据**:
- `Language` - 语言枚举（10 种支持语言）
- `LanguageInfo` - 语言信息（名称/代码/方向/脚本）
- `StyleSummary` - 术语风格分析（正式度/长度/类别）

### 类型驱动开发优势

#### 1️⃣ **编译时检查**
```typescript
// ✅ 编译通过：类型匹配
const stats: TranslationStats = await translatorApi.translateBatch(...);

// ❌ 编译错误：类型不匹配
const wrongType: number = await translatorApi.translateBatch(...);
```

#### 2️⃣ **IDE 智能提示**
- 自动补全所有字段
- 实时参数校验
- 重构时自动同步

#### 3️⃣ **运行时校验**
```rust
// Rust 端序列化验证
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct AIConfig {
    #[serde(rename = "providerType")]
    pub provider_type: ProviderType,
    #[serde(rename = "apiKey")]
    pub api_key: String,
    // ... 字段缺失或类型错误会在序列化时报错
}
```

#### 4️⃣ **版本兼容性**
- `ConfigVersionInfo` - 配置版本迁移
- 向后兼容旧配置（自动升级）
- 防止数据损坏

### 数据流示例
```
用户操作 (UI Component)
   ↓ 触发 API 调用
API 层 (api.ts)
   ↓ 类型检查的 invoke 调用
Tauri IPC (Serde 序列化)
   ↓ JSON 传输
Rust Commands
   ↓ 反序列化为 Rust Struct
Rust Services (业务逻辑)
   ↓ 返回 Rust Struct
Serde 序列化 → JSON
   ↓ IPC 传输
API 层自动反序列化
   ↓ 类型安全的 TypeScript 对象
组件使用 (全类型推断)
```

### 更新流程
1. 修改 Rust struct (`src-tauri/src/services/*.rs`)
2. 可选：`ts-rs` 自动生成 TS 类型
3. 手动同步或使用生成的类型
4. 编译时发现不兼容 → 强制修复

**原则**: Rust 类型是唯一事实源，TypeScript 类型跟随


