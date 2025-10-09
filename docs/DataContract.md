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

### 统计事件契约 V2（Event Sourcing）

#### **核心数据结构**

```typescript
// 统计事件（StatsEvent）
interface StatsEvent {
  meta: StatsEventMeta;      // 事件元数据
  data: TranslationStats;    // 标准统计数据
}

// 事件元数据
interface StatsEventMeta {
  eventId: string;           // 幂等性标识（去重用）
  type: StatsEventType;      // 'batch_progress' | 'task_complete'
  translationMode: string;   // 'channel' | 'single' | 'refine'
  timestamp: number;         // 事件时间戳
  taskId?: string;           // 任务ID（同任务共享）
}

// 标准统计数据（TranslationStats）
interface TranslationStats {
  total: number;             // 总条目数
  tm_hits: number;           // 记忆库命中数
  deduplicated: number;      // 去重数
  ai_translated: number;     // AI翻译数
  tm_learned: number;        // 新学习短语数
  token_stats: TokenStats;   // Token统计
}

// Token 统计
interface TokenStats {
  input_tokens: number;      // 输入 Token
  output_tokens: number;     // 输出 Token
  total_tokens: number;      // 总 Token
  cost: number;              // 预估成本（¥）
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
  translationSource?: 'tm' | 'dedup' | 'ai';  // 翻译来源
  needsReview?: boolean;                       // 是否需要审核
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


