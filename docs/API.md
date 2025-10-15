## API 索引

### 统一命令层 (2025-10)

**位置**: `src/services/commands.ts`

所有 Tauri 后端调用已迁移到统一命令层：

- **类型安全**: 52 个命令的完整 TypeScript 类型定义
- **统一错误处理**: 集中式 `invoke()` 包装器，自动日志和用户提示
- **模块化组织**: 13 个命令模块（`configCommands`, `aiConfigCommands`, `translatorCommands` 等）
- **易于维护**: 命令名称统一管理在 `COMMANDS` 常量中

**推荐用法**：

```typescript
import { configCommands, aiConfigCommands, translatorCommands } from '@/services/commands';

// ✅ 使用命令层（推荐）
const config = await configCommands.get();
await aiConfigCommands.add(newConfig);
const result = await translatorCommands.translateBatch(entries, targetLang);
```

**命令模块索引**：

- `configCommands` - 应用配置管理
- `aiConfigCommands` - AI 配置 CRUD + 连接测试
- `aiModelCommands` - 模型信息查询 + 成本计算
- `systemPromptCommands` - 系统提示词管理
- `termLibraryCommands` - 术语库操作
- `translationMemoryCommands` - 翻译记忆库
- `translatorCommands` - 翻译执行（单条/批量/精翻）
- `poFileCommands` - PO 文件解析和保存
- `fileFormatCommands` - 文件格式检测
- `dialogCommands` - 系统对话框
- `i18nCommands` - 国际化（语言检测/系统语言）
- `logCommands` - 日志管理
- `systemCommands` - 系统信息 + 原生主题检测

---

### 已废弃：旧 API 层

**位置**: `src/services/api.ts`

**迁移状态** (2025-10-13完成):

已删除模块:

- `termLibraryApi`, `translationMemoryApi`, `logApi`, `promptLogApi`
- `aiConfigApi`, `systemPromptApi`, `aiModelApi`
- `poFileApi`, `dialogApi`, `translatorApi`, `languageApi`

保留模块（尚未迁移）:

- `configApi`, `fileFormatApi`, `systemApi`

所有前端组件已迁移到命令层，旧 API 实现已完全移除。

---

### Tauri Commands (52 个)

13 个功能模块，自动处理错误、日志和用户反馈：

**命令模块**:

- `poFileCommands` - 文件解析/保存（PO/JSON/XLIFF/YAML）
- `translatorCommands` - AI 翻译（8 厂商，单条/批量/通道模式）
- `aiModelCommands` - 多AI供应商（模型查询、精确成本计算、USD定价）
- `translationMemoryCommands` - 翻译记忆库（83+ 内置短语，模式匹配）
- `termLibraryCommands` - 术语库管理（风格分析、批量导入）
- `configCommands` - 配置管理（AI/代理/系统设置，实时校验）
- `statsCommands` - 统计聚合（Token/去重/性能指标）
- `i18nCommands` - 语言检测（10 语言，自动识别）
- `logCommands` - 结构化日志（开发/生产模式）
- `systemCommands` - 系统信息 + **原生主题检测**（解决Tauri webview限制）

### 统一数据提供者 (2025-10)

**位置**: `src/providers/AppDataProvider.tsx`

使用 React Context 集中管理全局数据，配合 SWR 实现自动缓存和重验证：

```typescript
// main.tsx - 全局包裹
<AppDataProvider>
  <App />
</AppDataProvider>

// 组件中使用
const { config, aiConfigs, termLibrary, refreshAll } = useAppData();
```

**核心特性**:

- 统一刷新接口: `refreshAll()` 一键刷新所有数据
- SWR 集成: 自动缓存、后台重验证、错误重试
- 增强事件桥接: 集成 `useDefaultTauriEventBridge()`，自动同步后端事件
- 类型安全: 完整 TypeScript 类型推断

**提供的数据**:

- `config` - 应用配置
- `aiConfigs` - AI 配置列表
- `activeAiConfig` - 当前启用的 AI 配置
- `termLibrary` - 术语库
- `translationMemory` - 翻译记忆库
- `systemPrompt` - 系统提示词
- `supportedLanguages` - 支持的语言列表

---

### 增强事件桥接 (2025-10)

**位置**: `src/hooks/useTauriEventBridge.enhanced.ts`

**改进点**:

1. **防抖和节流**: 避免高频事件导致的性能问题

   ```typescript
   CommonEventConfigs.configUpdated(500); // 配置更新，节流 500ms
   CommonEventConfigs.translationStatsUpdate(500); // 统计更新，节流 500ms
   ```

2. **鲁棒清理**: 组件卸载时自动清理所有监听器
3. **事件转发**: 自动转发到 `eventDispatcher` 保持兼容性
4. **预设配置**: `useDefaultTauriEventBridge()` 一键启用所有常用事件

**推荐用法**:

```typescript
// 使用默认配置（已集成到 AppDataProvider）
useDefaultTauriEventBridge();

// 或自定义配置
useTauriEventBridgeEnhanced([
  CommonEventConfigs.configUpdated(1000),
  CommonEventConfigs.translationAfter(500),
]);
```

---

### 已废弃：旧事件桥接

**位置**: `src/hooks/useTauriEventBridge.ts`

**迁移状态** (2025-10-13完成):

- 已删除: 旧的 `useTauriEventBridge.ts` 文件
- 已迁移: 所有事件监听器已迁移到增强版本
- 兼容性: 增强版本自动转发事件到 `eventDispatcher`

---

### React Hooks

**推荐使用**:

- `useAsync` - 统一异步操作（替代旧的 useTranslator）
- `useAppData` - 统一数据访问（从 AppDataProvider）
- `useChannelTranslation` - Channel API 批量翻译（实时进度，高性能）
- `useDefaultTauriEventBridge` - 增强事件监听（集成在 AppDataProvider）

**特殊场景**:

- `useConfig` - 已被 `useAppData` 部分替代，仍可用于特殊场景
- `useLanguage` - 语言状态与检测
- `useTermLibrary` / `useTranslationMemory` - 已被 `useAppData` 替代

### 类型安全事件系统

**位置**: `src/services/eventDispatcher.ts`

受 Unreal Engine 启发，全类型推断，配合增强事件桥接使用：

```typescript
// 订阅事件（自动推断 payload 类型）
eventDispatcher.on('translation:progress', (data) => {
  console.log(`进度: ${data.current}/${data.total}`);
});

// 一次性订阅
eventDispatcher.once('translation:complete', handleComplete);

// 历史记录
eventDispatcher.getEventHistory();
```

**与增强事件桥接集成**:

- `useTauriEventBridgeEnhanced` 自动将 Tauri 事件转发到 `eventDispatcher`
- 支持防抖和节流，避免高频事件导致的性能问题
- 组件卸载时自动清理，防止内存泄漏

### SWR 数据缓存

自动缓存、后台重验证、乐观更新，现已通过 `AppDataProvider` 统一管理：

```typescript
// 推荐：使用 AppDataProvider
const { config, refreshAll } = useAppData();

// 旧方式（仍可用于特殊场景）
const { data, error, isLoading } = useSWR('config', configCommands.get);
```

**AppDataProvider 优势**:

- 统一的数据访问接口
- 自动集成事件监听和缓存失效
- 一键刷新所有数据（`refreshAll()`）

### 多AI供应商架构

**命令模块**: `aiModelCommands`

**核心能力**:

- 精确成本计算 - 基于 ModelInfo，支持缓存定价（节省高达90%）
- 统一定价 - USD per 1M tokens，强制 ModelInfo 存在
- 10个预定义模型 - OpenAI (4), Moonshot (4), DeepSeek (2)
- 设置页预设模型 - 下拉选择器显示所有可用模型及定价
- 统计面板集成 - 实时显示精确成本（USD）

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

**供应商配置整合** (`src/types/aiProvider.ts`):

- 统一配置源 - `PROVIDER_INFO_MAP` 包含所有8个供应商的默认配置
- 自动生成 - SettingsModal 从 `PROVIDER_INFO_MAP` 动态生成供应商列表
- 类型安全 - `ProviderType` 枚举确保类型一致性
- 模型预设 - 每个供应商都有 `defaultModel`，可被预设模型列表覆盖

**统一格式化工具** (`src/utils/formatters.ts`):

- 单一数据源 - 所有格式化逻辑集中在一个模块
- 全局一致 - `formatCost()` 确保所有地方显示成本的格式完全相同
- 易于维护 - 修改一处，全局生效
- 可复用 - `formatTokens()`, `formatPercentage()`, `formatDuration()` 等

```typescript
// 统一的格式化函数
import { formatCost, formatTokens, formatPercentage } from '@/utils/formatters';

// 推荐：使用统一函数
const costDisplay = formatCost(0.0042); // "0.42¢"

// 避免：手动格式化（分散逻辑）
const costDisplay = cost < 0.01 ? `${(cost * 100).toFixed(2)}¢` : `$${cost.toFixed(4)}`;
```

**参考文档**:

- 代码质量改进: `docs/CHANGELOG.md` (2025-10-13 质量提升)
- 完整参考: `CLAUDE.md` §Architecture Overview

---

### 🆕 系统主题检测 (2025-10-15)

**位置**: `systemCommands.getNativeSystemTheme`

**技术突破**：解决Tauri webview环境中 `window.matchMedia` 无法准确检测系统主题的问题

#### 混合检测策略

```typescript
// 前端使用示例
import { systemCommands } from '@/services/commands';

// 检测系统主题
const systemTheme = await systemCommands.getNativeSystemTheme();
console.log('系统主题:', systemTheme); // 'dark' | 'light'
```

**后端实现**：

- **Windows**: 直接查询注册表 `HKCU\Software\Microsoft\Windows\CurrentVersion\Themes\Personalize\AppsUseLightTheme`
- **macOS**: 使用 `defaults read -g AppleInterfaceStyle`
- **Linux**: 查询 GNOME `gsettings org.gnome.desktop.interface gtk-theme`

**优势对比**：

| 检测方式 | 准确性 | 性能 | 跨平台 | 依赖 |
|---------|-------|------|-------|------|
| `window.matchMedia` | ❌ 不准确（webview限制） | ✅ 快 | ✅ 是 | 无 |
| 原生API查询 | ✅ 100%准确 | ✅ 快 | ✅ 是 | OS命令 |

#### 集成到主题系统

```typescript
// useTheme.ts 中的混合检测
const handleSystemThemeChange = async () => {
  let newSystemTheme: AppliedTheme = 'light';
  let detectionMethod = 'unknown';
  
  // 🔧 方法1：尝试使用原生API（优先级最高）
  try {
    const nativeTheme = await systemCommands.getNativeSystemTheme();
    if (nativeTheme === 'dark' || nativeTheme === 'light') {
      newSystemTheme = nativeTheme as AppliedTheme;
      detectionMethod = 'native-api';
    }
  } catch (error) {
    // 原生API失败，继续使用媒体查询
    detectionMethod = 'fallback-media-query';
  }
  
  // 🔧 方法2：备用媒体查询检测
  if (detectionMethod === 'fallback-media-query') {
    const mediaQueryMatches = mediaQuery.matches;
    newSystemTheme = mediaQueryMatches ? 'dark' : 'light';
  }
  
  // 🚨 检测不一致警告
  if (nativeResult && mediaQueryResult && nativeResult !== mediaQueryResult) {
    log.warn('⚠️  系统主题检测结果不一致！', {
      nativeApi: nativeResult,
      mediaQuery: mediaQueryResult,
      using: newSystemTheme,
    });
  }
};
```

**技术价值**：

- ✅ **解决webview限制**：直接从OS获取真实主题设置
- ✅ **提供备用方案**：原生API失败时gracefully降级到媒体查询
- ✅ **调试友好**：详细日志对比不同检测方法的结果
- ✅ **为社区贡献**：为其他Tauri项目提供参考实现

---

## 后端配置管理（Draft 模式）

### ConfigDraft - 原子配置更新

**位置**: `src-tauri/src/services/config_draft.rs`

参考 `clash-verge-rev`，使用 `parking_lot::RwLock` + Draft 模式实现配置的原子更新。

**核心特性**:

- 并发安全: 使用 `parking_lot::RwLock` 保证线程安全
- 原子更新: 配置修改要么全部成功，要么全部失败
- 自动持久化: `apply()` 方法自动保存到磁盘并发送更新事件
- 全局单例: `ConfigDraft::global()` 提供全局访问

**使用示例**:

```rust
// 读取配置（只读访问）
let draft = ConfigDraft::global().await;
let config = draft.data(); // MappedRwLockReadGuard
println!("API Key: {}", config.ai_configs[0].api_key);
// config 在作用域结束时自动释放读锁

// 修改配置（原子更新）
let draft = ConfigDraft::global().await;
{
    let mut config = draft.draft(); // MappedRwLockWriteGuard
    config.ai_configs.push(new_config);
}
draft.apply()?; // 保存到磁盘 + 发送事件

// 错误示例：guard 跨 await 点
let config = draft.data();
some_async_fn().await; // 编译错误：Send bound not satisfied
```

**API 方法**:

- `ConfigDraft::global()` - 获取全局配置实例（async，首次调用时初始化）
- `data()` - 获取当前提交的配置（只读）
- `draft()` - 获取草稿配置（可写，修改后需调用 `apply()`）
- `apply()` - 提交草稿，保存到磁盘并发送更新事件

**迁移状态**:

- 已迁移: 所有 `ConfigManager` 调用已迁移到 `ConfigDraft`
- 已废弃: 旧的 `ConfigManager::new()` + `save_config()` 模式
- 清理完成: 所有命令文件已完成迁移

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
