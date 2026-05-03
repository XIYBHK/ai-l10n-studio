# 数据契约

**Last Updated**: 2026-05-04
**Principle**: Rust 类型是单一事实源（SSOT），TypeScript 类型通过 `ts-rs` 自动生成或手动对齐。

## 核心约束

1. **单一真相源**：Rust struct 定义优先，TypeScript 类型同步
2. **camelCase 传输**：`serde(rename_all = "camelCase")` 自动转换 `snake_case ↔ camelCase`
3. **零转换成本**：前后端类型字段 1:1 对应，IPC 层不手工映射
4. **强制验证**：serde 反序列化失败即命令失败；TypeScript 编译期检查

---

## 类型生成机制

### 自动生成（推荐）

Rust struct 标注 `ts-rs` 特性：

```rust
#[cfg_attr(feature = "ts-rs", derive(TS))]
#[cfg_attr(feature = "ts-rs", ts(export, export_to = "../src/types/generated/"))]
pub struct ProviderInfo {
    pub id: String,
    pub display_name: String,
    pub default_url: String,
    pub default_model: String,
}
```

输出到 `src/types/generated/ProviderInfo.ts`（禁止手动编辑）。

### 手动同步

部分类型（如 `AIConfig`）在 `src/types/aiProvider.ts` 手动定义，但字段与 Rust 端必须严格一致。

```rust
#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AIConfig {
    pub provider_id: String,       // → providerId
    pub api_key: String,           // → apiKey
    pub base_url: Option<String>,  // → baseUrl
    pub model: Option<String>,
    pub proxy: Option<ProxyConfig>,
}
```

```typescript
export interface AIConfig {
  providerId: string;
  apiKey: string;
  baseUrl?: string;
  model?: string;
  proxy?: ProxyConfig;
}
```

---

## 核心类型

### 配置类型

| 类型 | 生成方式 | 说明 |
|---|---|---|
| `AIConfig` | 手动同步 | AI 提供商配置（provider/key/url/model/proxy） |
| `AppConfig` | 手动同步 | 应用全局配置（代理、日志、翻译并发） |
| `ProxyConfig` | ts-rs 生成 | 代理设置（HTTP/SOCKS5） |
| `ProviderInfo` | ts-rs 生成 | 供应商信息（id、display_name、default_url、default_model） |

#### `AppConfig.logXxx` 字段

| 字段 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `logLevel` | `string` | `'info'` | error / warn / info / debug / trace |
| `logRetentionDays` | `number` | `7` | 保留天数（0 = 永久） |
| `logMaxSize` | `number` | `128` | 单文件最大 KB |
| `logMaxCount` | `number` | `8` | 保留文件数 |

---

### AI 供应商类型

```typescript
interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  context_window: number;
  max_output_tokens: number;
  input_price: number;           // USD per 1M tokens
  output_price: number;
  cache_reads_price?: number;
  cache_writes_price?: number;
  supports_cache: boolean;
  supports_images: boolean;
  description?: string;
  recommended: boolean;
}

interface CostBreakdown {
  input_tokens: number;
  output_tokens: number;
  cache_write_tokens: number;
  cache_read_tokens: number;
  input_cost: number;            // USD
  output_cost: number;
  cache_write_cost: number;
  cache_read_cost: number;
  total_cost: number;
  cache_savings: number;
  cache_hit_rate: number;        // 百分比
}
```

**价格单位硬约束**：

- 价格 = USD per 1M tokens
- 成本 = USD（不使用 CNY/¥）
- UI 显示：`$X.XXXX`

**成本计算路径**：`ModelInfo → CostCalculator → CostBreakdown → TranslationStats.token_stats.cost`。

---

### 翻译数据

```typescript
interface POEntry {
  msgid: string;
  msgstr: string;
  msgctxt?: string | null;
  comments: string[];
  line_start: number;
  line_end: number;
  needsReview: boolean;          // AI 翻译后需人工确认
  justUpdated?: boolean;         // 渐进式上屏动画触发
  translationSource?: 'tm' | 'dedup' | 'ai';
}

interface TranslationQueueItem {
  index: number;
  translation: string;
  source: 'tm' | 'dedup' | 'ai';
  incrementalStats?: {
    tmHits?: number;
    deduplicated?: number;
    aiTranslated?: number;
    tmLearned?: number;
    tokenStats?: {
      inputTokens: number;
      outputTokens: number;
      totalTokens: number;
      cost: number;
    };
  };
}

interface TranslationStats {
  total: number;
  tm_hits: number;
  deduplicated: number;
  ai_translated: number;
  tm_learned: number;
  token_stats: TokenStats;
}

interface TokenStats {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  cost: number;                  // USD
}
```

---

### 翻译记忆库

```typescript
interface TranslationMemory {
  memory: Record<string, string>;  // 源文本 → 目标译文
  stats: MemoryStats;
  last_updated: string;             // ISO 时间戳
}

interface MemoryStats {
  total_entries: number;
  hits: number;
  misses: number;
}
```

**核心行为**：

- 首次运行：自动加载 83+ 条内置短语到 `memory`
- 后续运行：只查询 `memory`，不再回退到内置短语
- 用户删除：不会自动恢复
- `merge_builtin_phrases()`：手动合并，不覆盖已有词条

---

### 术语库

```typescript
interface TermEntry {
  source: string;
  userTranslation: string;
  aiTranslation: string;
  context: string | null;
  tags: string[];
  created_at: string;
}

interface TermLibrary {
  terms: TermEntry[];
  styleSummary: string | null;
  metadata: {
    total_terms: number;
    last_updated: string;
  };
}
```

`styleSummary` 在累计添加 N 条后自动重生成（通过 AI 调用，异步）。

---

## IPC 数据流

### 请求路径

```
React component / hook
   ↓ 调用命令对象
aiConfigCommands.add(config)
   ↓ apiClient.invoke('add_ai_config', { config })
tauriInvoke middleware（日志 + PII 脱敏）
   ↓
@tauri-apps/api.invoke('add_ai_config', args)
   ↓ IPC + serde JSON
Rust #[tauri::command] fn add_ai_config(config: AIConfig) -> Result<(), AppError>
   ↓ serde 反序列化 camelCase → snake_case
业务逻辑
   ↓ Result::Ok / Err
serde 序列化
   ↓ IPC 返回
apiClient 抛出或返回 T
```

### 事件路径

后端通过 `tauri::Window::emit` 推送：

| 事件 | Payload | 触发时机 |
|---|---|---|
| `config:updated` | `AppConfig` | `ConfigDraft::apply()` 后 |
| `translation:after` | `{ stats: TranslationStats }` | 批量翻译完成 |
| `tauri://file-drop` | `string[]` (file paths) | 用户拖拽文件 |

前端通过 `listen()` 订阅，必须使用 `isActive` 标志防竞态（详见 `API.md` 异步监听器模式）。

### 流式进度（Channel API）

批量翻译用 `Channel<T>` 推送，不走事件系统：

```typescript
const progressChannel = new Channel<BatchProgressEvent>();
const statsChannel = new Channel<BatchStatsEvent>();

progressChannel.onmessage = (event) => setProgress(event.percentage);
statsChannel.onmessage = (event) => setStats(event);

await invoke('translate_batch_with_channel', {
  texts, targetLanguage, progressChannel, statsChannel,
});
```

---

## Zustand Store 持久化

| Store | 持久化 | 存储位置 | 用途 |
|---|---|---|---|
| `useAppStore` | 是 | `tauriStore` | 主题 / 语言 / app 配置摘要 |
| `useTranslationStore` | 否 | 内存 | 条目 / 当前选中 / source+target language |
| `useSessionStore` | 否 | 内存 | 进度 / 会话统计 |
| `useStatsStore` | 是 | `tauriStore` | 累计统计（跨会话） |

`tauriStore` 使用 `@tauri-apps/plugin-store`，数据写在 OS 应用数据目录。

---

## 配置 Draft 模式

详见 `docs/API.md §ConfigDraft`。核心约束：

- 公开配置（`app_config.json`）与 secrets（`secrets.json`）分离持久化
- 运行时读写优先 `ConfigDraft::global()`
- `ConfigManager` 仅保留给导入/导出工具和老路径兼容
- 前端读取 `AppConfig` 时，API Key 只返回掩码摘要；完整 Key 必须通过专用命令（带用户确认）

---

## 版本兼容

- 新增字段必须为 `Option<T>`（Rust）/ `?`（TS），旧数据反序列化时默认 `None`/`undefined`
- 删除字段前先 deprecate 至少一个版本，清理 migration 后再删
- `ConfigVersionInfo` 记录当前 schema 版本；不兼容变更需 migration 函数

---

## 参考

- API 参考：`docs/API.md`
- 架构总览：`docs/Architecture.md`
- 类型定义实际位置：`src/types/`（手动）、`src/types/generated/`（ts-rs 生成，不手编）
- 前端知识库：`src/AGENTS.md`
