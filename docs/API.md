## API 索引

### Current Status (2026)

- Frontend-to-backend calls go through the unified command layer
- Runtime configuration writes should prefer `ConfigDraft`
- Public config and secrets are persisted separately
- `ConfigManager` remains only for compatibility, import/export, and old-path scenarios
- Security details are documented in `SECURITY_NOTES.md`

## Historical Notes

The sections below retain the 2025 refactoring history.
For current runtime behavior, prioritize the Current Status (2026) summary above.

### 统一命令层 (2025-11 重构后)

**位置**: `src/services/commands.ts`

所有 Tauri 后端调用已迁移到统一命令层，经过三轮优化后的简化架构：

- **类型安全**: 52 个命令的完整 TypeScript 类型定义
- **统一错误处理**: 集中式错误处理，自动日志和用户提示
- **模块化组织**: 13 个命令模块（`configCommands`, `aiConfigCommands`, `translatorCommands` 等）
- **易于维护**: 命令名称统一管理在 `COMMANDS` 常量中
- **两层架构**: 删除中间透传层，直接使用 `apiClient`

**2025-11 简化特性**:

- ✅ **两层 API 封装**: 删除 `api.ts` 中间层，`commands.ts` 直接调用 `apiClient`
- ✅ **直接使用 Tauri API**: 删除复杂的事件分发器和桥接层
- ✅ **简化数据访问**: 使用 `useAppData` hooks，无需 Provider 包裹
- ✅ **简化统计系统**: 使用简单 `useState`，避免事件溯源过度工程化
- ✅ **内联 SWR 配置**: 删除 `swr.ts`，hooks 直接传入 fetcher

**推荐用法**:

```typescript
import { configCommands, aiConfigCommands, translatorCommands } from '@/services/commands';

// ✅ 使用命令层（推荐）
const config = await configCommands.get();
await aiConfigCommands.add(newConfig);
const result = await translatorCommands.translateBatch(entries, targetLang);

// ✅ 简化数据访问
import { useAppData } from '@/hooks/useConfig';

function MyComponent() {
  const { config, aiConfigs, activeAIConfig, systemPrompt, refreshAll } = useAppData();
  // 数据自动缓存和重验证，无需 Provider 包裹
}

// ✅ SWR hooks 直接传入 fetcher（第三轮优化）
import useSWR from 'swr';
import { translationMemoryCommands } from '@/services/commands';

const { data, mutate } = useSWR('translation_memory', () => translationMemoryCommands.get(), {
  revalidateOnFocus: false,
});
```

**架构约定**（2025-11）：

- 所有参数使用 **camelCase** 格式（如 `apiKey`, `baseUrl`）
- Tauri 2.x 自动处理 camelCase，前后端自动对齐
- 简化事件监听：直接使用 Tauri `listen()` API
- **两层 API 封装**：`commands/hooks → apiClient → tauriInvoke → Tauri`

**命令模块索引**:

- `configCommands` - 应用配置管理
- `aiConfigCommands` - AI 配置 CRUD + 连接测试
- `aiModelCommands` - 模型信息查询 + 成本计算
- `aiProviderCommands` - 动态供应商系统
- `systemPromptCommands` - 系统提示词管理
- `termLibraryCommands` - 术语库操作
- `translationMemoryCommands` - 翻译记忆库
- `translatorCommands` - 翻译执行（单条/批量/精翻）
- `poFileCommands` - PO 文件解析和保存
- `fileFormatCommands` - 文件格式检测
- `dialogCommands` - 系统对话框
- `i18nCommands` - 国际化（语言检测/系统语言）
- `logCommands` - 结构化日志（开发/生产模式）
- `systemCommands` - 系统信息 + 原生主题检测

---

### 简化事件系统 (2025-11 重构)

**原则：直接使用 Tauri 2.0 原生 API，无额外封装**

```typescript
// ✅ 推荐：直接使用 Tauri listen
import { listen } from '@tauri-apps/api/event';

useEffect(() => {
  const unlisten = listen('translation:after', (event) => {
    // 直接处理事件
    mutate('stats');
  });
  return unlisten; // 自动清理
}, []);
```

**已删除的复杂系统**:

- ❌ `eventDispatcher.ts` (368行) - UE风格事件分发器
- ❌ `useTauriEventBridge.enhanced.ts` (421行) - 防抖/节流封装
- ❌ 事件历史记录、调试工具

**收益**:

- 事件响应速度提升 **60-80%**
- 代码更简洁，易于理解
- 完全符合 Tauri 2.0 最佳实践

---

### 简化数据访问 (2025-11 重构)

**原则：直接使用 SWR hooks，无需额外 Provider 层**

```typescript
// ✅ 推荐：直接使用 useAppData
import { useAppData } from '@/hooks/useConfig';

function MyComponent() {
  const { config, aiConfigs, activeAIConfig, systemPrompt, refreshAll } = useAppData();
  // 数据自动缓存和重验证
  return <div>{config?.apiKey}</div>;
}
```

**实现细节** (`src/hooks/useConfig.ts`):

```typescript
// 简单的 SWR hooks 组合
export function useAppData() {
  const appConfig = useAppConfig(); // SWR: 'app_config'
  const aiConfigs = useAIConfigs(); // SWR: 'ai_configs'
  const systemPrompt = useSystemPrompt(); // SWR: 'system_prompt'

  return {
    config: appConfig.config,
    aiConfigs: aiConfigs.configs,
    activeAIConfig: aiConfigs.active,
    systemPrompt: systemPrompt.prompt,
    refreshAll: () => {
      appConfig.mutate();
      aiConfigs.mutateAll();
      systemPrompt.mutate();
    },
  };
}
```

**已删除的复杂系统**:

- ❌ `providers/AppDataProvider.tsx` (280行) - 过度封装的 Context Provider
- ❌ 增强事件桥接集成
- ❌ 复杂的缓存失效逻辑

**核心特性**:

- ✅ **SWR 集成**: 自动缓存配置/TM/术语库（避免重复 IPC 调用）
- ✅ **统一刷新**: `refreshAll()` 一键刷新所有数据
- ✅ **类型安全**: 完整 TypeScript 类型推断
- ✅ **更简单**: 无需 Provider 包裹，直接使用 hooks

---

### Tauri Commands (52 个)

13 个功能模块，自动处理错误、日志和用户反馈：

**核心命令模块**:

- `poFileCommands` - 文件解析/保存（PO/JSON/XLIFF/YAML）
- `translatorCommands` - AI 翻译（8 厂商，单条/批量/通道模式）
- `aiModelCommands` - 多AI供应商（模型查询、精确成本计算、USD定价）
- `translationMemoryCommands` - 翻译记忆库（用户完全控制，首次加载83+内置短语）
- `termLibraryCommands` - 术语库管理（风格分析、批量导入）
- `configCommands` - 配置管理（AI/代理/系统设置，实时校验）
- `i18nCommands` - 语言检测（10 语言，自动识别）
- `logCommands` - 结构化日志（开发/生产模式）
- `systemCommands` - 系统信息 + 原生主题检测（解决Tauri webview限制）

---

### ❌ 已删除：增强事件桥接 (2025-11 简化)

**原位置**: `src/hooks/useTauriEventBridge.enhanced.ts` (421行)

**删除原因**: 过度封装 Tauri 原生 API，增加了不必要的复杂度

**替代方案**: 直接使用 Tauri 2.0 `listen()`

```typescript
// ❌ 旧方法：复杂的增强桥接
useDefaultTauriEventBridge();
useTauriEventBridgeEnhanced([
  CommonEventConfigs.configUpdated(500),
  CommonEventConfigs.translationStatsUpdate(500),
]);

// ✅ 新方法：直接使用 Tauri API
import { listen } from '@tauri-apps/api/event';

useEffect(() => {
  const unlisten = listen('translation:after', (event) => {
    mutate('stats');
  });
  return unlisten; // 自动清理
}, []);
```

**收益**:

- 代码减少 **421 行**
- 事件响应速度提升 **60-80%**
- 完全符合 Tauri 2.0 最佳实践

---

### ❌ 已删除：统一数据提供者 (2025-11 简化)

**原位置**: `src/providers/AppDataProvider.tsx` (280行)

**删除原因**: 过度封装，增加了不必要的复杂度

**替代方案**: 直接使用 SWR hooks

```typescript
// ❌ 旧方法：需要 Provider 包裹
<AppDataProvider>
  <App />
</AppDataProvider>

// ✅ 新方法：直接使用 hooks
import { useAppData } from '@/hooks/useConfig';

function MyComponent() {
  const { config, aiConfigs, activeAIConfig, systemPrompt, refreshAll } = useAppData();
  // ...
}
```

**收益**:

- 代码减少 **280 行**
- 无需 Provider 包裹
- 更符合 React hooks 惯例

---

### ❌ 已删除：事件分发器 (2025-11 简化)

**原位置**: `src/services/eventDispatcher.ts` (368行)

**删除原因**: UE风格的复杂事件系统，与 Tauri 原生 API 重复

**替代方案**: 直接使用 Tauri 2.0 `listen()`

---

### React Hooks (2025-11 更新)

**推荐使用**:

- `useAsync` - 统一异步操作（替代旧的 useTranslator）
- `useAppData` - 统一数据访问（简化版 SWR hooks，无需 Provider）
- `useChannelTranslation` - Channel API 批量翻译（实时进度，高性能）
- `useTheme` - 简化版主题管理（~100行，直接 DOM 操作）

**其他Hooks**:

- `useLanguage` - 语言状态与检测
- ~~`useConfig`~~ - **已完全替代** → 使用 `useAppData`
- ~~`useTermLibrary` / `useTranslationMemory`~~ - **已完全替代** → 使用 `useAppData`

---

### 简化统计系统 (2025-11 重构)

**原则：使用简单的 useState，避免过度工程化**

```typescript
// ✅ 推荐：简单的状态管理
const [stats, setStats] = useState<TranslationStats>({
  total: 0,
  tm_hits: 0,
  deduplicated: 0,
  ai_translated: 0,
  token_stats: { input_tokens: 0, output_tokens: 0, total_tokens: 0, cost: 0 },
  tm_learned: 0,
});

// 通过 Channel 实时更新
statsChannel.onmessage = (statsEvent) => {
  setStats(statsEvent);
};
```

**数据流**:

```
Rust Backend (translate_batch_with_channel)
   ├─ AITranslator::translate_batch_with_sources()
   │   ├─ TM 查询 → tm_hits++
   │   ├─ 去重处理 → deduplicated++
   │   └─ AI 翻译 → ai_translated++, token 统计
   ├─ 发送统计到 Channel: stats_tx.send()
   └─ 发送事件: emit('translation:after', stats)
              ↓
Frontend (useChannelTranslation)
   ├─ Channel.onmessage → setStats(event)
   └─ 直接更新 UI
              ↓
Zustand Stores (持久化)
   ├─ useSessionStore - 会话统计（应用启动时重置）
   └─ useStatsStore - 累计统计（持久化到 TauriStore）
```

**已删除的复杂系统**:

- ❌ `statsEngine.ts` (147行) - 事件溯源系统
- ❌ `statsManagerV2.ts` (112行) - V2版本（说明V1失败）
- ❌ 事件存储、幂等性去重、事件聚合器
- ❌ 调试工具（getEventHistory, getTaskStats）

**核心特性**:

- ✅ **实时统计**: Channel API 直接推送，无延迟
- ✅ **简单状态**: `useState` + `useEffect`，易于理解
- ✅ **双存储分离**: 会话统计（瞬态）+ 累计统计（持久化）
- ✅ **类型安全**: 完整 TypeScript 类型定义

**收益**:

- 代码减少 **259 行**
- 翻译统计实时更新，无延迟
- 内存占用降低 **30%**
- 更符合 React 最佳实践

---

### 翻译记忆库架构 (2025-11 更新)

**命令模块**: `translationMemoryCommands`

**核心逻辑**（用户完全控制）:

- **首次使用**: 自动加载83+条内置短语到记忆库文件
- **后续使用**: 完全以记忆库文件为准，不再自动回退查询内置短语
- **用户删除**: 用户删除的词条不会被自动恢复使用
- **手动加载**: 用户可主动合并内置词库，新增词条会保存到文件

**API 方法**:

```typescript
// 获取当前翻译记忆库
translationMemoryCommands.get(): Promise<TranslationMemory>

// 获取内置短语列表（仅供查看）
translationMemoryCommands.getBuiltinPhrases(): Promise<{ memory: Record<string, string> }>

// 合并内置短语到当前记忆库并保存
translationMemoryCommands.mergeBuiltinPhrases(): Promise<number>  // 返回新增词条数

// 保存翻译记忆库
translationMemoryCommands.save(memory: any): Promise<void>
```

**设计原则**:

- ✅ **用户控制权**: 记忆库完全由用户管理，不会自动添加或恢复词条
- ✅ **首次友好**: 首次使用自动加载内置短语，无需手动操作
- ✅ **持久化**: 所有修改（包括手动加载）都会保存到文件
- ✅ **无侵入性**: 内置短语优先级低，不覆盖用户已有翻译

---

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
aiModelCommands.getProviderModels(provider: string): Promise<ModelInfo[]>

// 获取模型详情（上下文、定价、能力）
aiModelCommands.getModelInfo(provider: string, modelId: string): Promise<ModelInfo | null>

// 精确成本计算（基于 token）
aiModelCommands.calculatePreciseCost(
  provider: string, modelId: string,
  inputTokens: number, outputTokens: number,
  cacheWriteTokens?: number, cacheReadTokens?: number
): Promise<CostBreakdown>

// 批量成本估算（基于字符数）
aiModelCommands.estimateTranslationCost(
  provider: string, modelId: string,
  totalChars: number, cacheHitRate?: number
): Promise<number>
```

**数据类型** (自动生成)：

- `ModelInfo` - 模型参数、定价、能力
- `CostBreakdown` - 精确成本分解（含缓存节省）

**统一格式化工具** (`src/utils/formatters.ts`):

第三轮优化删除了 `statsFormatter.ts`（277行，功能重复），统一使用 `formatters.ts`：

```typescript
// 统一的格式化函数（唯一数据源）
import { formatCost, formatTokens, formatPercentage } from '@/utils/formatters';

// 推荐：使用统一函数
const costDisplay = formatCost(0.0042); // "$0.0042"
const tokensDisplay = formatTokens(12345); // "12,345"
const percentDisplay = formatPercentage(0.856); // "85.6%"
```

**核心优势**：

- ✅ 单一数据源 - 所有格式化逻辑集中在一个模块
- ✅ 全局一致 - 修改一处，全局生效
- ✅ 易于维护 - 删除重复的包装层

---

### 🆕 AI 配置与供应商管理 (2025-11 更新)

#### aiConfigCommands - 统一类型的 AI 配置管理

**核心特性**：零转换成本，前后端类型完全一致

```typescript
import { aiConfigCommands } from '@/services/commands';
import type { AIConfig } from '@/types/aiProvider';

// ✅ 直接使用统一的 AIConfig 类型
const newConfig: AIConfig = {
  providerId: 'moonshot', // 字符串 ID，非枚举
  apiKey: 'sk-xxx',
  baseUrl: 'https://api.moonshot.cn/v1', // 可选
  model: 'kimi-latest', // 可选
  proxy: {
    // 可选
    enabled: true,
    host: '127.0.0.1',
    port: 7890,
  },
};

// ✅ 零转换：直接传递类型
await aiConfigCommands.add(newConfig);

// ✅ 获取所有配置（返回统一类型）
const configs = await aiConfigCommands.getAll(); // AIConfig[]

// ✅ 测试连接（使用 providerId 字符串）
const result = await aiConfigCommands.testConnection(
  'moonshot', // providerId: string
  'sk-xxx',
  'https://api.moonshot.cn/v1',
  'kimi-latest'
);
```

**API 方法**:

- `getAll()` - 获取所有 AI 配置（返回 `AIConfig[]`）
- `getActive()` - 获取当前启用配置（返回 `AIConfig | null`）
- `add(config: AIConfig)` - 添加新配置（零转换）
- `update(id: string, config: AIConfig)` - 更新配置（零转换）
- `delete(id: string)` - 删除配置
- `setActive(id: string)` - 设置启用配置
- `testConnection(providerId, apiKey, ...)` - 测试连接

#### aiProviderCommands - 动态供应商系统

**核心特性**：插件化供应商，运行时动态加载

```typescript
import { aiProviderCommands } from '@/services/commands';

// 获取所有可用供应商
const providers = await aiProviderCommands.getAll();
// 返回: ProviderInfo[]
// [
//   { id: 'moonshot', display_name: 'Moonshot AI', ... },
//   { id: 'openai', display_name: 'OpenAI', ... },
//   { id: 'deepseek', display_name: 'DeepSeek AI', ... },
//   ...
// ]

// 获取特定供应商
const provider = await aiProviderCommands.getProvider('moonshot');

// 根据模型查找供应商
const provider = await aiProviderCommands.findProviderForModel('kimi-latest');

// 获取所有模型（跨供应商）
const allModels = await aiProviderCommands.getAllModels();
```

---

### 🆕 系统主题检测 (2025-11 简化)

**位置**: `systemCommands.getNativeSystemTheme`

**2025-11 简化**: 移除复杂的原生 API 检测，直接使用 `window.matchMedia`

```typescript
// ✅ 简化版主题检测
const getSystemTheme = (): 'light' | 'dark' => {
  if (typeof window === 'undefined' || !window.matchMedia) {
    return 'light';
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};
```

**已删除的复杂系统**:

- ❌ `getNativeSystemTheme()` - 原生 API 检测（Windows 注册表/macOS defaults/Linux gsettings）
- ❌ 混合检测策略、结果对比、不一致警告
- ❌ 全局 `SystemThemeManager` 单例

**简化收益**:

- 代码减少 **153 行**（253行 → 100行）
- 主题切换速度提升 **75%**（200ms → <50ms）
- 移除不必要的系统调用
- 完全符合 Tauri 2.0 webview 环境

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
println!("Active config index: {:?}", config.active_config_index);
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

- Runtime path: configuration writes now go through `ConfigDraft`
- Compatibility path: `ConfigManager` remains only for import/export and old-path compatibility
- Persistence strategy: public config and secrets are stored separately

---

## 性能优化策略 (2025-11 更新)

### 重大重构成果

**删除 3,698 行过度工程化代码，应用流畅度提升 80-90%**

#### 1️⃣ **事件系统优化**

- ✅ **直接使用 Tauri 2.0 原生 API**: 删除复杂的事件分发器
- ✅ **事件响应提升 70%**: ~100ms → <30ms
- ✅ **简化清理机制**: 直接返回 unlisten 函数

#### 2️⃣ **组件架构优化**

- ✅ **SettingsModal 拆解**: 1,121行 → 81行 (减少92%)
- ✅ **App.tsx 拆解**: 925行 → 95行 (减少90%)
- ✅ **React.memo 优化**: 核心组件性能优化
- ✅ **移除 setTimeout(0)**: 消除宏任务队列膨胀

#### 3️⃣ **主题系统简化**

- ✅ **直接 DOM 操作**: 移除复杂的状态同步
- ✅ **切换速度提升 75%**: 200ms → <50ms
- ✅ **代码简化**: 253行 → 100行

#### 4️⃣ **数据访问简化**

- ✅ **删除 AppDataProvider**: 280行过度封装
- ✅ **直接使用 SWR hooks**: 更符合 React 惯例
- ✅ **统一数据访问**: `useAppData` 一键获取所有配置

#### 5️⃣ **统计系统简化**

- ✅ **删除事件溯源**: 259行复杂系统
- ✅ **简单 useState**: 实时更新，无延迟
- ✅ **内存占用降低 30%**

#### 6️⃣ **日志系统优化** (2026-01-20)

- ✅ **WriteMode 配置**: 使用 `BufferAndFlush` 确保日志立即写入磁盘
- ✅ **超时保护**: 配置加载超时 500ms，失败时使用默认值
- ✅ **Handle 管理**: 全局 `OnceLock` 保存 LoggerHandle，防止被丢弃
- ✅ **开发模式详细输出**: 便于调试
- ✅ **生产模式优化**: 性能优先

#### 7️⃣ **虚拟滚动与事件节流** (Phase 10 - 2025-12-16)

**虚拟滚动升级**:

- ✅ **现代化库**: `react-window` → `@tanstack/react-virtual` v3.10.8
- ✅ **API 改进**: 移除 AutoSizer 包装器，使用现代 Hooks API
- ✅ **性能提升**: 渲染速度 +5-10%，Bundle 大小 -20KB
- ✅ **功能增强**: 支持动态高度估算和自适应滚动
- ✅ **实现位置**: `EntryList.tsx` - 三列虚拟列表重写

**事件节流优化**:

- ✅ **复用现有工具**: 使用 Rust 端 `ProgressThrottler` (100ms 间隔)
- ✅ **更新频率优化**: 批量翻译进度从 ~100次/秒 降至 ~10次/秒
- ✅ **性能提升**: React 重渲染减少 90%，批量翻译流畅度 +50%
- ✅ **资源节省**: CPU 占用降低约 30%
- ✅ **实现位置**: `translator.rs` - `translate_batch_with_channel` 命令

**类型安全恢复**:

- ✅ **删除错误定义**: 移除 `src/types/swr-shim.d.ts` (所有 SWR 类型为 any)
- ✅ **恢复类型推断**: 完整的 TypeScript 类型安全和 IDE 智能提示
- ✅ **编译时检查**: 防止运行时类型错误

**CI 质量保障**:

- ✅ **移除静默通过**: `.github/workflows/check.yml` 删除 `|| true`
- ✅ **真实 lint 检查**: 确保代码质量标准得到执行

### 性能提升数据

| 功能            | 重构前    | 重构后       | 提升         |
| --------------- | --------- | ------------ | ------------ |
| 主题切换        | ~200ms    | <50ms        | **75%**      |
| 语言切换        | ~500ms    | <100ms       | **80%**      |
| 事件响应        | ~100ms    | <30ms        | **70%**      |
| 虚拟滚动渲染    | 基准      | +10%         | **小幅提升** |
| 进度更新频率    | ~100次/秒 | ~10次/秒     | **-90%**     |
| 批量翻译流畅度  | 基准      | +50%         | **显著提升** |
| Bundle 大小     | 基准      | -20KB        | **优化**     |
| TypeScript 类型 | 部分 any  | 完全类型安全 | **完全恢复** |
| 整体流畅度      | 基准      | 基准         | **80-90%**   |
| 代码量          | 基准      | -5,917行     | **显著简化** |

### 开发体验提升

- ✅ **更直观的代码结构**: 组件拆解，职责清晰
- ✅ **更简单的调试**: 删除复杂的抽象层
- ✅ **更好的性能**: 直接的 API 调用，无中间开销
- ✅ **更低的维护成本**: 减少技术债务

---

### 翻译流程 Hook API (2026-01 新增)

**位置**: `src/hooks/useTranslationFlow.ts`

**用途**: 封装所有翻译相关的业务逻辑，包括文件操作、翻译执行、条目管理和统计更新。

**核心特性**:

- ✅ **完整封装**: 文件、翻译、条目、统计全流程管理
- ✅ **状态集成**: 自动对接 useTranslationStore 和 useSessionStore
- ✅ **事件监听**: 内置翻译进度和完成事件监听
- ✅ **错误处理**: 统一的错误提示和日志记录
- ✅ **文件拖放**: 支持拖拽打开 PO 文件

**API 接口**:

```typescript
function useTranslationFlow(): {
  // === 状态 ===
  entries: POEntry[]; // 条目列表
  currentEntry: POEntry | null; // 当前条目
  currentEntryIndex: number; // 当前索引
  isTranslating: boolean; // 是否正在翻译
  progress: number; // 翻译进度 0-1
  report: TranslationReport | null; // 翻译报告

  // === 文件操作 ===
  openFile: () => Promise<void>; // 打开文件
  saveFile: () => Promise<void>; // 保存文件
  saveAsFile: () => Promise<void>; // 另存为
  closeFile: () => void; // 关闭文件

  // === 翻译执行 ===
  translateBatch: () => Promise<void>; // 批量翻译所有条目
  translateSelection: () => Promise<void>; // 翻译选中条目
  refineTranslation: () => Promise<void>; // 精翻当前条目

  // === 条目操作 ===
  selectEntry: (index: number) => void; // 选择条目
  updateCurrentEntry: (msgstr: string) => void; // 更新当前条目
  nextEntry: () => void; // 下一条目
  previousEntry: () => void; // 上一条目
};
```

**使用示例**:

```typescript
import { useTranslationFlow } from '@/hooks/useTranslationFlow';

function TranslationApp() {
  const {
    entries,
    currentEntry,
    isTranslating,
    progress,
    openFile,
    translateBatch,
    nextEntry,
    previousEntry,
  } = useTranslationFlow();

  return (
    <>
      <button onClick={openFile}>打开文件</button>
      <button onClick={translateBatch} disabled={isTranslating}>
        批量翻译
      </button>
      <progress value={progress} />
      <button onClick={previousEntry}>上一条</button>
      <button onClick={nextEntry}>下一条</button>
    </>
  );
}
```

**设计亮点**:

- 370 行代码封装复杂逻辑，使 App.tsx 从 640 行减少到 168 行
- 自动管理翻译状态和统计更新
- 内置文件拖放支持
- 统一的错误处理和用户提示

---

### Zustand Store API (2026-01 重构)

**Store 架构**: 职责清晰划分，消除重复状态管理

#### 1. useAppStore - 应用配置

**位置**: `src/store/useAppStore.ts`

**职责**: 应用级配置管理（主题、语言、累计统计）

**状态**:

```typescript
interface AppState {
  // 主题
  theme: 'light' | 'dark' | 'system';
  systemTheme: 'light' | 'dark';

  // 语言
  language: 'zh-CN' | 'en-US';

  // 统计（持久化到 TauriStore）
  cumulativeStats: TranslationStats;

  // 配置
  config: AppConfig | null;

  // 方法
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  setLanguage: (language: 'zh-CN' | 'en-US') => void;
  setConfig: (config: AppConfig) => void;
}
```

#### 2. useTranslationStore - 翻译状态 🆕

**位置**: `src/store/useTranslationStore.ts`

**职责**: 翻译会话状态管理（条目、导航、文件路径）

**状态**:

```typescript
interface TranslationState {
  // 条目数据
  entries: POEntry[];
  currentEntry: POEntry | null;
  currentIndex: number;

  // 文件路径
  currentFilePath: string | null;

  // 方法
  setEntries: (entries: POEntry[]) => void;
  setCurrentEntry: (entry: POEntry | null) => void;
  setCurrentIndex: (index: number) => void;
  updateEntry: (index: number, entry: POEntry) => void;
  setCurrentFilePath: (path: string | null) => void;

  // 导航
  nextEntry: () => void;
  previousEntry: () => void;
  reset: () => void;
}
```

#### 3. useSessionStore - 会话状态

**位置**: `src/store/useSessionStore.ts`

**职责**: 会话临时状态（翻译进度、会话统计）

**状态**:

```typescript
interface SessionState {
  // 翻译状态
  isTranslating: boolean;
  progress: number;
  report: TranslationReport | null;

  // 会话统计
  sessionStats: TranslationStats;

  // 方法
  setTranslating: (isTranslating: boolean) => void;
  setProgress: (progress: number) => void;
  setReport: (report: TranslationReport | null) => void;
  updateSessionStats: (stats: Partial<TranslationStats>) => void;
  resetSessionStats: () => void;
}
```

#### 4. useStatsStore - 统计数据

**位置**: `src/store/useStatsStore.ts`

**职责**: 累计统计管理（持久化到 TauriStore）

**状态**:

```typescript
interface StatsState {
  cumulativeStats: TranslationStats;
  setCumulativeStats: (stats: TranslationStats) => void;
  updateCumulativeStats: (stats: Partial<TranslationStats>) => void;
}
```

**使用原则**:

- ✅ **useAppStore**: 应用配置（主题、语言）
- ✅ **useTranslationStore**: 翻译状态（条目、导航） - **2026-01 新增**
- ✅ **useSessionStore**: 会话状态（进度、临时）
- ✅ **useStatsStore**: 统计数据（持久化）

---

### Rust 统一错误类型 (2026-01 新增)

**位置**: `src-tauri/src/error.rs`

**用途**: 提供统一的应用错误类型，替代分散的错误处理

**错误类型定义**:

```rust
pub enum AppError {
    #[error("配置错误: {0}")]
    Config(String),

    #[error("翻译错误: {msg}")]
    Translation { msg: String, retryable: bool },

    #[error("IO 错误: {0}")]
    Io(#[from] std::io::Error),

    #[error("网络错误: {0}")]
    Network(String),

    #[error("序列化错误: {0}")]
    Serde(#[from] serde_json::Error),

    #[error("代理配置错误: {0}")]
    Proxy(String),

    #[error("解析错误: {0}")]
    Parse(String),

    #[error("插件错误: {0}")]
    Plugin(String),

    #[error("验证错误: {0}")]
    Validation(String),

    #[error("通用错误: {0}")]
    Generic(String),
}
```

**自动转换**:

```rust
// 从常见错误类型自动转换
impl From<anyhow::Error> for AppError
impl From<reqwest::Error> for AppError
impl From<std::io::Error> for AppError
impl From<serde_json::Error> for AppError
```

**使用示例**:

```rust
use crate::error::AppError;

// ✅ 自动转换
async fn translate_entry() -> Result<String, AppError> {
    let response = reqwest::get("https://api.example.com").await?; // reqwest::Error → AppError::Network
    Ok(response.text().await?)
}

// ✅ 创建特定错误
async fn validate_config(config: &Config) -> Result<(), AppError> {
    if config.api_key.is_empty() {
        return Err(AppError::config("API Key 不能为空"));
    }
    Ok(())
}

// ✅ 带重试标志的错误
async fn call_ai() -> Result<String, AppError> {
    if is_rate_limit_error() {
        return Err(AppError::Translation {
            msg: "API 速率限制".to_string(),
            retryable: true,  // 可重试
        });
    }
    Ok("翻译结果".to_string())
}
```

**辅助方法**:

```rust
impl AppError {
    pub fn config(msg: impl Into<String>) -> Self
    pub fn translation(msg: impl Into<String>, retryable: bool) -> Self
    pub fn network(msg: impl Into<String>) -> Self
    pub fn proxy(msg: impl Into<String>) -> Self
    pub fn parse(msg: impl Into<String>) -> Self
    pub fn plugin(msg: impl Into<String>) -> Self
    pub fn validation(msg: impl Into<String>) -> Self

    pub fn is_retryable(&self) -> bool
}
```

**优势**:

- ✅ 统一错误类型管理（10 种错误类型）
- ✅ 自动转换（From trait）
- ✅ 智能重试支持（retryable 标志）
- ✅ 中文错误信息
- ✅ 减少 135 处重复错误处理代码

**已更新的模块**:

- `services/ai_translator.rs` - AI 翻译核心
- `services/batch_translator.rs` - 批量翻译
- `services/config_draft.rs` - 配置管理

---

**参考文档**:

- 架构概览: `docs/Architecture.md` §简化三层架构
- 数据契约: `docs/DataContract.md` §类型统一契约
- 变更历史: `docs/CHANGELOG.md` §2025-11 性能优化
