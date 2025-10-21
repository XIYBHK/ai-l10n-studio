## 数据契约（简版）

### 类型安全的前后端契约

#### 自动生成的 TypeScript 类型 (`src/types/generated/`)

**Rust → TypeScript** 单向生成（使用 `ts-rs` 可选支持）：

**配置类型**:

- `AIConfig` - **[已统一]** AI 提供商配置（前后端类型完全一致）
- `AppConfig` - 应用全局配置（代理、日志、性能）
  - **🆕 日志配置**（2025-10）：
    - `log_level?: string` - 日志级别（error/warn/info/debug/trace）
    - `log_retention_days?: number` - 日志保留天数（0 = 永久）
    - `log_max_size?: number` - 单个文件最大大小（KB，默认 128KB）
    - `log_max_count?: number` - 保留文件数量（默认 8 个）
- `ProxyConfig` - **[ts-rs 生成]** 代理设置（HTTP/SOCKS5）
- ~~`ProviderType`~~ - **[已废弃]** 使用 `providerId: string` 替代
- `ProviderInfo` - **[ts-rs 生成]** 供应商信息（id, display_name, default_url, default_model）

**🆕 多AI供应商类型**:

- `ModelInfo` - 模型信息（上下文窗口、定价、能力、缓存支持）
- `CostBreakdown` - 成本分解（输入/输出/缓存 token、费用、节省率）

**翻译数据**:

- `POEntry` - PO 文件条目（msgid/msgstr/注释/位置）
- `TranslationPair` - 翻译对（源文本 → 目标文本 + 元数据）
- `TermEntry` - 术语库条目（术语 + 翻译 + 标签 + 风格）
- `TranslationMemory` - 翻译记忆库（memory + stats + last_updated）

**翻译记忆库** (2025-10-21 优化):

```typescript
interface TranslationMemory {
  memory: Record<string, string>; // 源文本 → 目标翻译
  stats: MemoryStats; // 记忆库统计
  last_updated: string; // 最后更新时间
}

interface MemoryStats {
  total_entries: number; // 总词条数
  hits: number; // 命中次数
  misses: number; // 未命中次数
}
```

**核心逻辑**:

- **首次使用**: 自动从 `get_builtin_memory()` 加载83+条内置短语
- **后续使用**: 只查询 `memory` 字段，不再自动回退到内置短语
- **查询行为**: `get_translation()` 仅查询 `self.memory`，保持用户完全控制
- **保存格式**: JSON文件只保存 `learned` 部分（用户添加的词条），不包含内置短语
- **合并逻辑**: `merge_builtin_phrases()` 合并时不覆盖已有词条

**统计与报告**:

- `TranslationStats` - 翻译统计（Token/耗时/成功率）
- `TokenStats` - Token 使用详情（输入/输出/成本）
- `DeduplicationStats` - 去重统计（原始/去重后/节省比例）
- `TranslationReport` - 完整翻译报告（聚合所有指标）

### 统计事件契约 V2（Event Sourcing）

#### **核心数据结构**

```typescript
// 统计事件（StatsEvent）
interface StatsEvent {
  meta: StatsEventMeta; // 事件元数据
  data: TranslationStats; // 标准统计数据
}

// 事件元数据
interface StatsEventMeta {
  eventId: string; // 幂等性标识（去重用）
  type: StatsEventType; // 'batch_progress' | 'task_complete'
  translationMode: string; // 'channel' | 'single' | 'refine'
  timestamp: number; // 事件时间戳
  taskId?: string; // 任务ID（同任务共享）
}

// 标准统计数据（TranslationStats）
interface TranslationStats {
  total: number; // 总条目数
  tm_hits: number; // 记忆库命中数
  deduplicated: number; // 去重数
  ai_translated: number; // AI翻译数
  tm_learned: number; // 新学习短语数
  token_stats: TokenStats; // Token统计
}

// Token 统计
interface TokenStats {
  input_tokens: number; // 输入 Token
  output_tokens: number; // 输出 Token
  total_tokens: number; // 总 Token
  cost: number; // 精确成本（USD）
}
```

#### **事件流（单一路径）**

```
Rust Backend (translate_batch_with_channel)
  ├─ Channel 发送批量进度
  │   └─ stats_tx.send(BatchStatsEvent)
  │       → 前端 useChannelTranslation 接收
  │       → eventDispatcher.emit('translation-stats-update')
  │
  └─ Tauri Event 发送任务完成
      └─ emit('translation:after', final_stats)
          → useTauriEventBridge 桥接
          → eventDispatcher.emit('translation:after')

StatsManagerV2 (事件编排)
  ├─ translation:before
  │   └─ 生成 taskId
  │
  ├─ translation-stats-update (批量进度)
  │   ├─ 创建 StatsEvent { meta: { eventId, taskId, ... }, data }
  │   ├─ statsEngine.processEvent(event, 'session')
  │   └─ useSessionStore.setSessionStats(聚合结果)
  │
  └─ translation:after (任务完成)
      ├─ statsEngine.processEvent(event, 'session')
      └─ useStatsStore.updateCumulativeStats(data)  // 持久化

StatsEngine (事件溯源核心)
  ├─ EventStore.add(event)
  │   └─ 幂等性检查（eventId 去重）
  │
  └─ 聚合器计算当前统计
      └─ 累加所有事件的 data 字段
```

#### **数据一致性保证**

1. **单一数据源**: 所有统计来自 Rust 后端，前端不计算
2. **幂等性**: 同 `eventId` 的事件只处理一次
3. **可追溯**: 所有事件存储在 `EventStore`，可查询历史
4. **双存储分离**:
   - **会话统计**: `useSessionStore` (应用启动时重置)
   - **累计统计**: `useStatsStore` (持久化到 TauriStore)

#### **统一 API（仅 Channel API）**

- ✅ **批量翻译**: `translate_batch_with_channel` (唯一路径)
- ✅ **单条翻译**: `translate_entry` → 发送 `translation:after`
- ✅ **精翻**: `contextual_refine` → 发送 `translation:after`
- ❌ **已移除**: `translate_batch` (Event API)

#### **翻译来源标识（Translation Source）**

从 Phase 7+ 开始，每个翻译条目都标记其来源：

```typescript
// POEntry 扩展字段
interface POEntry {
  // ... 其他字段
  translationSource?: 'tm' | 'dedup' | 'ai'; // 翻译来源
  needsReview?: boolean; // 是否需要审核
}
```

**来源类型**:

- `tm`: 翻译记忆库命中（83+ 内置短语）
- `dedup`: 去重处理（引用同批次已翻译内容）
- `ai`: AI 翻译（调用 AI API）

**UI 展示**:

- 💾 TM - 绿色标签（记忆库命中）
- 🔗 去重 - 蓝色标签（去重节省）
- 🤖 AI - 紫色标签（AI翻译）

**数据流**:

```
Rust Backend
  └─ AITranslator::translate_batch_with_sources()
      ├─ 返回 (translations: Vec<String>, sources: Vec<String>)
      └─ BatchResult { translations, translation_sources }

Frontend
  └─ App.tsx: executeTranslation()
      ├─ 接收 result.translation_sources
      └─ updateEntry(index, { translationSource: sources[i] })

UI Component
  └─ EntryList.tsx: 待确认列
      └─ 显示来源标签
```

**语言与元数据**:

- `Language` - 语言枚举（10 种支持语言）
- `LanguageInfo` - 语言信息（名称/代码/方向/脚本）
- `StyleSummary` - 术语风格分析（正式度/长度/类别）

### 🆕 多AI供应商数据契约

#### **ModelInfo（模型信息）**

```typescript
interface ModelInfo {
  id: string; // 模型ID（如 "gpt-4o-mini"）
  name: string; // 显示名称
  provider: string; // 供应商（"OpenAI", "Moonshot"）

  // 技术参数
  context_window: number; // 上下文窗口（tokens）
  max_output_tokens: number; // 最大输出长度

  // 💰 定价（USD per 1M tokens）
  input_price: number; // 输入价格
  output_price: number; // 输出价格
  cache_reads_price?: number; // 缓存读取价格（省90%）
  cache_writes_price?: number; // 缓存写入价格

  // 能力标识
  supports_cache: boolean; // 是否支持缓存
  supports_images: boolean; // 是否支持图像

  // UI 展示
  description?: string; // 模型描述
  recommended: boolean; // 是否推荐
}
```

#### **CostBreakdown（成本分解）**

```typescript
interface CostBreakdown {
  // Token 数量
  input_tokens: number; // 普通输入
  output_tokens: number; // 输出
  cache_write_tokens: number; // 缓存写入
  cache_read_tokens: number; // 缓存读取

  // 成本（USD）
  input_cost: number; // 输入成本
  output_cost: number; // 输出成本
  cache_write_cost: number; // 缓存写入成本
  cache_read_cost: number; // 缓存读取成本
  total_cost: number; // 总成本

  // 缓存优化
  cache_savings: number; // 节省金额
  cache_hit_rate: number; // 命中率（%）
}
```

#### **架构约束**

1. **强制 ModelInfo 存在**

   ```rust
   // ✅ 正确
   let model_info = provider.get_model_info(model_id)
       .expect("模型必须存在");

   // ❌ 禁止降级逻辑
   if let Some(model_info) = ... { } else { /* 硬编码 */ }
   ```

2. **统一货币单位**
   - 所有价格: **USD per 1M tokens**
   - 所有成本: **USD**（非 CNY/¥）
   - UI 显示: `$X.XXXX` 或 `$X.XX‰`

3. **成本计算路径**
   ```
   ModelInfo → CostCalculator → CostBreakdown → TokenStats.cost
   ```

### 🆕 前后端类型统一契约 (2025-10-21)

#### **核心原则**：参考 clash-verge-rev 最佳实践

**单一事实来源**：Rust 类型定义是唯一事实来源，TypeScript 通过以下方式同步：

1. **自动生成**（推荐）：使用 `ts-rs` 自动生成（如 `ProxyConfig`, `ProviderInfo`）
2. **手动同步**：前端手动定义，但字段必须与 Rust 完全一致（如 `AIConfig`）
3. **自动转换**：通过 serde `rename_all = "camelCase"` 自动转换命名

#### **AIConfig 类型统一**

**Rust 定义** (`src-tauri/src/services/ai_translator.rs`):

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]  // 自动转换命名
pub struct AIConfig {
    pub provider_id: String,         // → providerId
    pub api_key: String,             // → apiKey
    pub base_url: Option<String>,    // → baseUrl
    pub model: Option<String>,       // → model
    pub proxy: Option<ProxyConfig>,  // → proxy
}
```

**TypeScript 定义** (`src/types/aiProvider.ts`):

```typescript
export interface AIConfig {
  providerId: string; // 🔧 与 Rust provider_id 对应
  apiKey: string; // 🔧 与 Rust api_key 对应
  baseUrl?: string; // 🔧 与 Rust base_url 对应
  model?: string;
  proxy?: ProxyConfig; // 🔧 ts-rs 自动生成的类型
}
```

**JSON 传输** (Tauri IPC):

```json
{
  "providerId": "moonshot",
  "apiKey": "sk-xxx",
  "baseUrl": "https://api.moonshot.cn/v1",
  "model": "kimi-latest",
  "proxy": {
    "enabled": true,
    "host": "127.0.0.1",
    "port": 7890
  }
}
```

#### **零转换数据流**

```
React Component
  ↓ 创建 AIConfig 对象
const config: AIConfig = { providerId: 'moonshot', ... }
  ↓ 直接传递给命令层
await aiConfigCommands.add(config);
  ↓ Tauri IPC（JSON 序列化）
{ "providerId": "moonshot", "apiKey": "sk-xxx", ... }
  ↓ Rust 反序列化（serde camelCase → snake_case）
AIConfig { provider_id: "moonshot", api_key: "sk-xxx", ... }
  ↓ 业务逻辑处理
AITranslator::new_with_config(config, ...)
  ↓ 返回结果（Rust → JSON）
  ↓ 前端接收（JSON → TypeScript）
TypeScript 对象（完全类型推断）
```

#### **ProviderInfo 类型（ts-rs 自动生成）**

**Rust 定义** (`src-tauri/src/services/ai/provider.rs`):

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "ts-rs", derive(TS))]
#[cfg_attr(feature = "ts-rs", ts(export, export_to = "../src/types/generated/"))]
pub struct ProviderInfo {
    pub id: String,
    pub display_name: String,
    pub default_url: String,
    pub default_model: String,
}
```

**TypeScript 生成** (`src/types/generated/ProviderInfo.ts`):

```typescript
// This file was generated by ts-rs. Do not edit this file manually.
export interface ProviderInfo {
  id: string;
  display_name: string;
  default_url: string;
  default_model: string;
}
```

#### **类型一致性保证**

**编译时检查**：

```typescript
// ✅ 类型匹配，编译通过
const config: AIConfig = {
  providerId: 'moonshot',
  apiKey: 'sk-xxx',
};

// ❌ 类型错误，编译失败
const config: AIConfig = {
  provider: 'moonshot', // 错误：应为 providerId
  apiKey: 'sk-xxx',
};
```

**运行时验证**：

```rust
// Rust 端 serde 自动验证
// 缺少必填字段或类型错误会在反序列化时报错
#[tauri::command]
pub async fn add_ai_config(config: AIConfig) -> Result<(), String> {
    // config 已经过 serde 验证，保证字段完整且类型正确
}
```

#### **迁移前后对比**

**之前（需要手动转换）**：

```typescript
// ❌ 前端类型
interface FrontendAIConfig {
  provider: ProviderType; // 枚举
  apiKey: string;
}

// ❌ 后端类型
interface BackendAIConfig {
  provider_id: string; // 字符串
  api_key: string;
}

// ❌ 需要手动转换
function convertToBackendConfig(frontend: FrontendAIConfig): BackendAIConfig {
  return {
    provider_id: providerTypeToId(frontend.provider),
    api_key: frontend.apiKey,
  };
}
```

**现在（零转换）**：

```typescript
// ✅ 统一类型
interface AIConfig {
  providerId: string; // 前后端一致
  apiKey: string; // 前后端一致
}

// ✅ 直接使用，无需转换
await aiConfigCommands.add(config);
```

#### **架构优势**

1. **零转换成本**: 前后端类型完全一致，删除约 200 行转换代码
2. **类型安全**: TypeScript 编译时检查 + Rust 运行时验证
3. **自动同步**: ts-rs 自动生成类型，减少手动同步成本
4. **可维护性**: 单一事实来源（Rust 类型定义），修改一处即可
5. **扩展性**: 新增字段无需修改转换函数，自动适配

---

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
   ↓ 触发命令调用
统一命令层 (commands.ts)
   ↓ 类型安全的 invoke 调用
Tauri IPC (Serde 序列化)
   ↓ JSON 传输
Rust Commands
   ↓ 反序列化为 Rust Struct
Rust Services (业务逻辑)
   ↓ 返回 Rust Struct
Serde 序列化 → JSON
   ↓ IPC 传输
命令层自动反序列化
   ↓ 类型安全的 TypeScript 对象
组件使用 (全类型推断)
```

### 更新流程

1. 修改 Rust struct (`src-tauri/src/services/*.rs`)
2. 可选：`ts-rs` 自动生成 TS 类型
3. 手动同步或使用生成的类型
4. 编译时发现不兼容 → 强制修复

**原则**: Rust 类型是唯一事实源，TypeScript 类型跟随

---

## 🆕 后端配置管理契约（Draft 模式） - 2025-10

### ConfigDraft 数据流

```
┌─────────────────────────────────────────────────────────┐
│ 前端（React Component）                                  │
├─────────────────────────────────────────────────────────┤
│ const config = await configCommands.get();              │
│ config.log_max_size = 256;                              │
│ await configCommands.update(config);                    │
└─────────────────────────────────────────────────────────┘
                        ↓ IPC
┌─────────────────────────────────────────────────────────┐
│ Tauri Command (update_app_config)                       │
├─────────────────────────────────────────────────────────┤
│ let draft = ConfigDraft::global().await;                │
│ {                                                       │
│   let mut config = draft.draft();                       │
│   *config = new_config; // 替换整个配置                  │
│ }                                                       │
│ draft.apply()?; // 原子提交                              │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ ConfigDraft (src-tauri/src/services/config_draft.rs)    │
├─────────────────────────────────────────────────────────┤
│ 1. 保存到磁盘（app_config.json）                         │
│ 2. 发送事件：emit('config:updated', config)             │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ 前端事件桥接（useTauriEventBridgeEnhanced）              │
├─────────────────────────────────────────────────────────┤
│ 监听 'config:updated' → 节流 500ms                      │
│ → eventDispatcher.emit('config:updated')                │
│ → AppDataProvider 刷新 SWR 缓存                          │
└─────────────────────────────────────────────────────────┘
```

### 并发安全保证

```rust
// ✅ 正确：作用域限制 guard 生命周期
let draft = ConfigDraft::global().await;
{
    let config = draft.data(); // MappedRwLockReadGuard
    println!("API Key: {}", config.api_key);
} // guard 在此释放
do_async_work().await; // 安全

// ❌ 错误：guard 跨 await 点
let draft = ConfigDraft::global().await;
let config = draft.data(); // 持有读锁
do_async_work().await; // 编译错误：Send bound not satisfied
```

### Draft 模式特性

1. **原子性**：
   - `draft()` 获取草稿配置（可写）
   - `apply()` 提交所有修改或全部失败
   - 失败时配置保持不变

2. **并发安全**：
   - `parking_lot::RwLock` 保证读写互斥
   - 多个读者可同时访问
   - 写入时阻塞所有读者

3. **自动持久化**：
   - `apply()` 自动保存到磁盘
   - 自动发送 `config:updated` 事件
   - 前端 SWR 缓存自动失效

4. **全局单例**：
   - `ConfigDraft::global()` 全局唯一实例
   - 首次调用时从磁盘加载
   - 后续调用返回缓存实例

---

## 🆕 系统主题检测契约 (2025-10-15)

### 原生主题检测API

**命令**: `get_native_system_theme`

```rust
// Rust 后端
#[tauri::command]
pub fn get_native_system_theme() -> Result<String, String>
```

```typescript
// TypeScript 前端
systemCommands.getNativeSystemTheme(): Promise<string>
```

**返回值**：

- `"dark"` - 系统使用深色主题
- `"light"` - 系统使用浅色主题
- 错误时抛出异常

### 跨平台实现契约

**Windows 实现**：

```rust
// 查询注册表
reg query "HKCU\Software\Microsoft\Windows\CurrentVersion\Themes\Personalize" /v "AppsUseLightTheme"
// 返回值：0 = 深色，1 = 浅色
```

**macOS 实现**：

```rust
// 查询系统默认设置
defaults read -g AppleInterfaceStyle
// 返回值：存在且包含"Dark" = 深色，否则 = 浅色
```

**Linux 实现**：

```rust
// 查询 GNOME 主题设置
gsettings get org.gnome.desktop.interface gtk-theme
// 返回值：包含"dark" = 深色，否则 = 浅色
```

### 混合检测策略数据流

```typescript
interface ThemeDetectionResult {
  // 检测方法
  detectionMethod: 'native-api' | 'fallback-media-query' | 'media-query-only';

  // 检测结果
  nativeApiResult?: string; // 原生API结果
  nativeApiAvailable: boolean; // 原生API是否可用
  mediaQueryResult: 'dark' | 'light'; // 媒体查询结果

  // 最终决定
  newSystemTheme: 'dark' | 'light';

  // 调试信息
  mediaQueryMatches: boolean; // matchMedia 原始结果
  directCheck: boolean; // 直接检查结果
  lightCheck: boolean; // 浅色主题检查
  computedColorScheme?: string; // CSS computedStyle

  // 元数据
  timestamp: string;
  source: string;
  forceUpdate: boolean;
}
```

### 数据一致性保证

**检测优先级**：

1. 原生API结果（最高优先级）
2. 媒体查询备用（当原生API失败时）
3. 默认值 `light`（所有方法都失败时）

**不一致处理**：

```typescript
// 当两种方法结果不同时的处理
if (nativeResult && mediaQueryResult && nativeResult !== mediaQueryResult) {
  log.warn('⚠️ 系统主题检测结果不一致！', {
    nativeApi: nativeResult,
    mediaQuery: mediaQueryResult,
    using: newSystemTheme, // 使用原生API结果
    userNote: '这解释了为什么webview检测不准确',
  });
}
```

### 全局状态管理契约

**单一数据源**：

```typescript
// useAppStore.ts
interface AppState {
  systemTheme: 'light' | 'dark'; // 🏗️ 系统主题状态（运行时检测，不持久化）
  setSystemTheme: (systemTheme: 'light' | 'dark') => void;
}
```

**状态更新流程**：

```
原生API检测 → SystemThemeManager → useAppStore.setSystemTheme → 全局状态更新 → useTheme消费
```

**防重复更新**：

```typescript
setSystemTheme: (systemTheme) => {
  const currentSystemTheme = get().systemTheme;
  if (currentSystemTheme === systemTheme) {
    // 跳过相同值的更新
    return;
  }
  set({ systemTheme });
},
```

### 技术约束

1. **不持久化**：`systemTheme` 是运行时状态，每次启动都重新检测
2. **全局单例**：`SystemThemeManager` 确保整个应用只有一个监听器
3. **原生优先**：始终优先使用原生API结果，媒体查询仅作备用
4. **错误容忍**：任何检测方法失败都不应导致应用崩溃
5. **调试友好**：提供详细的检测过程日志，便于问题诊断
