## API 索引（简版）

### 统一 API 层 (`src/services/api.ts`)

封装 **52 个 Tauri Commands**，13 个功能模块，自动处理错误、日志和用户反馈：

**核心 API 模块**：

- 📄 `poFileApi.*` - 文件解析/保存（PO/JSON/XLIFF/YAML）
- 🤖 `translatorApi.*` - AI 翻译（8 厂商，单条/批量/通道模式）
- 🎯 `aiModelApi.*` - **多AI供应商**（模型查询、精确成本计算、USD定价）
- 💾 `translationMemoryApi.*` - 翻译记忆库（83+ 内置短语，模式匹配）
- 📚 `termLibraryApi.*` - 术语库管理（风格分析、批量导入）
- ⚙️ `configApi.*` - 配置管理（AI/代理/系统设置，实时校验）
- 📊 `statsApi.*` - 统计聚合（Token/去重/性能指标）
- 🌐 `languageApi.*` - 语言检测（10 语言，自动识别）
- 📝 `logApi.*` - 结构化日志（开发/生产模式）

### 现代化 React Hooks

- `useAsync` - 统一异步操作（替代旧的 useTranslator）
- `useConfig` - SWR 驱动的配置管理（自动缓存、重验证）
- `useLanguage` - 语言状态与检测
- `useTermLibrary` / `useTranslationMemory` - 专用数据管理
- `useChannelTranslation` - Channel API 批量翻译（实时进度，高性能）

### 类型安全事件系统 (`eventDispatcher`)

受 Unreal Engine 启发，全类型推断：

```typescript
// 订阅事件（自动推断 payload 类型）
eventDispatcher.on('translation:progress', (data) => {
  console.log(`进度: ${data.current}/${data.total}`);
});

// 一次性订阅
eventDispatcher.once('translation:complete', handleComplete);

// 历史记录（调试神器）
eventDispatcher.getEventHistory();
```

### SWR 数据缓存

自动缓存、后台重验证、乐观更新：

```typescript
const { data, error, isLoading } = useSWR('config', configApi.loadConfig);
```

### 🆕 多AI供应商架构 (`aiModelApi`)

**核心能力**：

- ✅ **精确成本计算** - 基于 ModelInfo，支持缓存定价（节省高达90%）
- ✅ **统一定价** - USD per 1M tokens，强制 ModelInfo 存在
- ✅ **10个预定义模型** - OpenAI (4), Moonshot (4), DeepSeek (2)
- ✅ **设置页预设模型** - 下拉选择器显示所有可用模型及定价
- ✅ **统计面板集成** - 实时显示精确成本（USD）

**API 方法**：

```typescript
// 获取供应商模型列表
aiModelApi.getProviderModels(provider: string): Promise<ModelInfo[]>

// 获取模型详情（上下文、定价、能力）
aiModelApi.getModelInfo(provider: string, modelId: string): Promise<ModelInfo | null>

// 精确成本计算（基于 token）
aiModelApi.calculatePreciseCost(
  provider: string, modelId: string,
  inputTokens: number, outputTokens: number,
  cacheWriteTokens?: number, cacheReadTokens?: number
): Promise<CostBreakdown>

// 批量成本估算（基于字符数）
aiModelApi.estimateTranslationCost(
  provider: string, modelId: string,
  totalChars: number, cacheHitRate?: number
): Promise<number>
```

**数据类型** (自动生成)：

- `ModelInfo` - 模型参数、定价、能力
- `CostBreakdown` - 精确成本分解（含缓存节省）

**成本计算流程**（已完全集成）：

```
翻译请求 → AITranslator
  ├─ OpenAI API 返回 usage: { prompt_tokens, completion_tokens }
  ├─ ProviderType.get_model_info(model_id) → ModelInfo (包含定价)
  ├─ CostCalculator.calculate_openai(ModelInfo, tokens) → CostBreakdown
  └─ token_stats.cost = breakdown.total_cost (USD)
       ↓
BatchStatsEvent { token_stats: { cost } } → Channel 发送
       ↓
前端 EventDispatcher → StatsEngine → useSessionStore/useStatsStore
       ↓
AIWorkspace 统计面板 → 显示 `$0.0023`（小额4位）或 `$12.35`（大额2位）
```

**供应商配置整合**（`src/types/aiProvider.ts`）：

- ✅ **统一配置源** - `PROVIDER_INFO_MAP` 包含所有8个供应商的默认配置
- ✅ **自动生成** - SettingsModal 从 `PROVIDER_INFO_MAP` 动态生成供应商列表
- ✅ **类型安全** - `ProviderType` 枚举确保类型一致性
- ✅ **模型预设** - 每个供应商都有 `defaultModel`，可被预设模型列表覆盖

**统一格式化工具**（`src/utils/formatters.ts`）：

- ✅ **单一数据源** - 所有格式化逻辑集中在一个模块
- ✅ **全局一致** - `formatCost()` 确保所有地方显示成本的格式完全相同
- ✅ **易于维护** - 修改一处，全局生效（如 `0.42¢` vs `$0.0042`）
- ✅ **可复用** - `formatTokens()`, `formatPercentage()`, `formatDuration()` 等

```typescript
// 统一的格式化函数
import { formatCost, formatTokens, formatPercentage } from '@/utils/formatters';

// ✅ 正确：使用统一函数
const costDisplay = formatCost(0.0042); // "0.42¢"

// ❌ 错误：手动格式化（分散逻辑）
const costDisplay = cost < 0.01 ? `${(cost * 100).toFixed(2)}¢` : `$${cost.toFixed(4)}`;
```

**代码质量改进**: 详见 `docs/CODE_QUALITY_IMPROVEMENTS.md`  
**完整参考**: `CLAUDE.md` §Architecture Overview

---

## 统计系统 V2（Event Sourcing）

### 架构概览

```
StatsEngine (事件溯源核心)
  ├─ EventStore      - 存储所有统计事件（幂等性、可追溯）
  ├─ 事件聚合器       - 实时计算会话统计
  └─ 调试工具         - 事件历史、时间旅行

StatsManagerV2 (事件桥接层)
  ├─ 监听后端事件     - translation:before / translation-stats-update / translation:after
  ├─ 转换为 StatsEvent - 附加元数据（eventId/taskId/timestamp）
  └─ 更新 Zustand Store - useSessionStore / useStatsStore
```

### 核心特性

#### 1️⃣ **事件溯源（Event Sourcing）**

- 所有统计变更以**事件流**形式存储
- 可追溯：查看完整历史，时间旅行调试
- 可审计：每个统计数据都有来源事件

#### 2️⃣ **幂等性保证**

```typescript
// 同一事件多次处理，结果一致
statsEngine.processEvent(event, 'session'); // 首次
statsEngine.processEvent(event, 'session'); // 重复 → 自动去重
```

#### 3️⃣ **双存储分离**

- **会话统计**（`useSessionStore`）：应用启动时重置，聚合当前会话所有事件
- **累计统计**（`useStatsStore`）：持久化到 TauriStore，跨会话累加

#### 4️⃣ **统一翻译 API**

- ✅ **仅 Channel API**：所有批量翻译使用 `translate_batch_with_channel`
- ❌ 已移除 Event API (`translate_batch`)

### 事件流

```typescript
// 1. 后端发送事件
translation:before          // 任务开始 → 生成 taskId
  ↓
translation-stats-update    // 批量进度（Channel API）→ 增量统计
  ↓  (可能多次)
translation:after           // 任务完成 → 最终统计

// 2. StatsManagerV2 处理
eventDispatcher.on('translation-stats-update', (data) => {
  const event = createStatsEvent(data, taskId); // 附加元数据
  statsEngine.processEvent(event, 'session');   // 更新会话统计
  useSessionStore.setState({ sessionStats });
});

eventDispatcher.on('translation:after', (data) => {
  statsEngine.processEvent(event, 'session');          // 会话
  useStatsStore.getState().updateCumulativeStats(data); // 累计（持久化）
});
```

### 使用示例

```typescript
// main.tsx 启动时初始化
import { initializeStatsManagerV2 } from '@/services/statsManagerV2';

initializeStatsManagerV2(); // 一次性启动

// 组件中读取统计
const { sessionStats } = useSessionStore();
const { cumulativeStats } = useStatsStore();

// 调试：查看事件历史
import { statsEngine } from '@/services/statsEngine';
statsEngine.getEventHistory(); // 返回所有统计事件
```

### 数据契约

```typescript
interface StatsEvent {
  meta: {
    eventId: string; // 幂等性标识
    type: 'batch_progress' | 'task_complete';
    translationMode: 'channel' | 'single' | 'refine';
    timestamp: number;
    taskId?: string; // 同任务共享ID
  };
  data: TranslationStats; // 标准统计数据
}
```

### 优势

- ✅ **无重复计数**：幂等性保证
- ✅ **可调试**：完整事件历史
- ✅ **类型安全**：编译时检查
- ✅ **可扩展**：新增统计维度无需改动核心逻辑
