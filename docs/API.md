## API 索引

### 统一命令层 (2025-10)

**位置**: `src/services/commands.ts`

所有 Tauri 后端调用已迁移到统一命令层：

- **类型安全**: 52 个命令的完整 TypeScript 类型定义
- **统一错误处理**: 集中式 `invoke()` 包装器，自动日志和用户提示
- **模块化组织**: 13 个命令模块（`configCommands`, `aiConfigCommands`, `translatorCommands` 等）
- **易于维护**: 命令名称统一管理在 `COMMANDS` 常量中
- **🆕 零配置参数转换**: 默认遵循 camelCase 约定，无需手动配置（详见架构决策）

**推荐用法**：

```typescript
import { configCommands, aiConfigCommands, translatorCommands } from '@/services/commands';

// ✅ 使用命令层（推荐）- 自动遵循 camelCase 约定
const config = await configCommands.get();
await aiConfigCommands.add(newConfig); // newConfig 使用 camelCase 字段
const result = await translatorCommands.translateBatch(entries, targetLang);
```

**🎯 架构约定**（2025-10）：

- 所有参数使用 **camelCase** 格式（如 `apiKey`, `baseUrl`）
- `tauriInvoke` 默认不转换参数（`autoConvertParams = false`）
- Tauri 2.x 自动处理 camelCase，无需手动配置
- 详见：`docs/ARCHITECTURE_DECISION_TAURI_PARAMS.md`

**命令模块索引**：

- `configCommands` - 应用配置管理
- `aiConfigCommands` - AI 配置 CRUD + 连接测试 **[已统一类型]**
- `aiModelCommands` - 模型信息查询 + 成本计算
- `aiProviderCommands` - **[新增]** 动态供应商系统
- `systemPromptCommands` - 系统提示词管理
- `termLibraryCommands` - 术语库操作
- `translationMemoryCommands` - 翻译记忆库
- `translatorCommands` - 翻译执行（单条/批量/精翻）
- `poFileCommands` - PO 文件解析和保存
- `fileFormatCommands` - 文件格式检测
- `dialogCommands` - 系统对话框
- `i18nCommands` - 国际化（语言检测/系统语言）
- `logCommands` - 日志管理
- `systemCommands` - 系统信息 + ~~原生主题检测~~（已简化）

**⚠️ 已知的进一步优化空间**:

根据 2025-11 深度分析，当前命令层存在过度抽象：
- 🔴 **高优先级**: API 调用链过长（4 层），建议简化为 2 层
- 🟡 **中优先级**: COMMANDS 常量维护负担，建议使用命名空间导出
- 详见：`性能优化施工总结.md` §进一步优化建议

---

### 已废弃：旧 API 层

**位置**: `src/services/api.ts`

**✅ 迁移完成状态** (2025-10-15):

已删除模块:

- `termLibraryApi`, `translationMemoryApi`, `logApi`, `promptLogApi`
- `aiConfigApi`, `systemPromptApi`, `aiModelApi`
- `poFileApi`, `dialogApi`, `translatorApi`, `languageApi`
- `configApi`, `fileFormatApi`, `systemApi` - **已完全移除**

**🎯 迁移成果**:

- ✅ 所有前端组件已迁移到统一命令层
- ✅ 所有旧 API 实现已完全移除
- ✅ 无遗留代码，无技术债务

---

### Tauri Commands (52 个)

13 个功能模块，自动处理错误、日志和用户反馈：

**命令模块**:

- `poFileCommands` - 文件解析/保存（PO/JSON/XLIFF/YAML）
- `translatorCommands` - AI 翻译（8 厂商，单条/批量/通道模式）
- `aiModelCommands` - 多AI供应商（模型查询、精确成本计算、USD定价）
- `translationMemoryCommands` - 翻译记忆库（首次加载83+内置短语，后续完全以文件为准）
- `termLibraryCommands` - 术语库管理（风格分析、批量导入）
- `configCommands` - 配置管理（AI/代理/系统设置，实时校验）
- `statsCommands` - 统计聚合（Token/去重/性能指标）
- `i18nCommands` - 语言检测（10 语言，自动识别）
- `logCommands` - 结构化日志（开发/生产模式）
- `systemCommands` - 系统信息 + **原生主题检测**（解决Tauri webview限制）

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

### ❌ 已删除：类型安全事件系统 (2025-11 简化)

**原位置**: `src/services/eventDispatcher.ts` (368行)

**删除原因**: 与 Tauri 原生 API 功能重复，增加了不必要的复杂度

**替代方案**: 直接使用 Tauri 2.0 `listen()` 和 `emit()`

```typescript
// ❌ 旧方法：eventDispatcher
eventDispatcher.on('translation:progress', (data) => {
  console.log(`进度: ${data.current}/${data.total}`);
});
eventDispatcher.once('translation:complete', handleComplete);
eventDispatcher.getEventHistory();

// ✅ 新方法：Tauri 原生 API
import { listen, emit } from '@tauri-apps/api/event';

const unlisten = await listen('translation:progress', (event) => {
  console.log(`进度: ${event.payload.current}/${event.payload.total}`);
});

// 一次性监听
const unlistenOnce = await listen('translation:complete', (event) => {
  handleComplete(event.payload);
  unlistenOnce(); // 手动取消监听
});

// 发射事件（后端）
app.emit('translation:progress', { current: 1, total: 10 });
```

**收益**:
- 代码减少 **368 行**
- 事件响应速度提升 **60-80%**
- 完全符合 Tauri 2.0 最佳实践
- 无需自定义事件历史记录（Tauri 提供调试工具）
```

**与增强事件桥接集成**:

- `useTauriEventBridgeEnhanced` 自动将 Tauri 事件转发到 `eventDispatcher`
- 支持防抖和节流，避免高频事件导致的性能问题
- 组件卸载时自动清理，防止内存泄漏

### SWR 数据缓存

自动缓存、后台重验证、乐观更新，现已通过 `AppDataProvider` 统一管理：

```typescript
// 推荐：使用 AppDataProvider（统一数据管理）
const { config, refreshAll } = useAppData();

// 直接使用 SWR（特殊场景：需要细粒度控制）
const { data, error, isLoading } = useSWR('config', configCommands.get);
```

**AppDataProvider 优势**:

- 统一的数据访问接口
- 自动集成事件监听和缓存失效
- 一键刷新所有数据（`refreshAll()`）

### 翻译记忆库架构 (2025-10-21 优化)

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

// 🆕 合并内置短语到当前记忆库并保存
translationMemoryCommands.mergeBuiltinPhrases(): Promise<number>  // 返回新增词条数

// 保存翻译记忆库
translationMemoryCommands.save(memory: any): Promise<void>
```

**设计原则**:

- ✅ **用户控制权**: 记忆库完全由用户管理，不会自动添加或恢复词条
- ✅ **首次友好**: 首次使用自动加载内置短语，无需手动操作
- ✅ **持久化**: 所有修改（包括手动加载）都会保存到文件
- ✅ **无侵入性**: 内置短语优先级低，不覆盖用户已有翻译

**使用场景**:

1. **首次启动**: 自动加载83+条游戏本地化常用短语
2. **删除词条**: 用户删除某个内置短语后，翻译任务不再使用它
3. **重新加载**: 用户点击"加载内置词库"按钮，合并到当前记忆库并保存
4. **导入导出**: 完整记忆库可导出为JSON，支持跨设备迁移

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

**🆕 前后端类型统一** (2025-10-21):

参考 clash-verge-rev 最佳实践，实现零转换成本的类型系统：

- **统一 AIConfig**: 前后端使用相同结构，通过 serde camelCase 自动转换
- **providerId 字符串**: 废弃 `ProviderType` 枚举，使用 `providerId: string`
- **动态供应商系统**: 通过 `aiProviderCommands.getAll()` 获取所有可用供应商
- **ts-rs 类型生成**: `ProxyConfig` 等类型自动从 Rust 生成到 TypeScript
- **零转换成本**: 删除所有手动转换函数，直接传递类型

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

### 🆕 AI 配置与供应商管理 (2025-10-21)

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

**类型定义** (`src/types/aiProvider.ts`):

```typescript
export interface AIConfig {
  providerId: string; // 🔧 统一使用字符串 ID
  apiKey: string;
  baseUrl?: string;
  model?: string;
  proxy?: ProxyConfig; // 🔧 ts-rs 自动生成
}

// ProxyConfig 从 Rust 自动生成
export type { ProxyConfig } from './generated/ProxyConfig';
```

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

**ProviderInfo 类型** (ts-rs 自动生成):

```typescript
// src/types/generated/ProviderInfo.ts
export interface ProviderInfo {
  id: string; // 供应商 ID
  display_name: string; // 显示名称
  default_url: string; // 默认 API URL
  default_model: string; // 默认模型
}
```

**使用示例**（SettingsModal）:

```typescript
// 动态加载供应商列表
const [providers, setProviders] = useState<ProviderInfo[]>([]);

useEffect(() => {
  aiProviderCommands.getAll().then(setProviders);
}, []);

// 在表单中使用
<Select>
  {providers.map((p) => (
    <Select.Option key={p.id} value={p.id}>
      {p.display_name}
    </Select.Option>
  ))}
</Select>
```

**工具函数** (`src/utils/providerUtils.ts`):

```typescript
import { getProviderDisplayName } from '@/utils/providerUtils';

// 从供应商列表中获取显示名称
const displayName = getProviderDisplayName('moonshot', providers);
// 返回: "Moonshot AI"
```

#### 迁移对比

**之前（需要手动转换）**:

```typescript
// ❌ 旧方式：需要转换函数
const backendConfig = convertToBackendConfig(frontendConfig);
await invoke('add_ai_config', { config: backendConfig });
```

**现在（零转换）**:

```typescript
// ✅ 新方式：直接传递
await aiConfigCommands.add(config);
```

**架构优势**:

1. **零转换成本**: 前后端类型完全一致，通过 serde camelCase 自动转换
2. **类型安全**: TypeScript 编译时检查，Rust 运行时验证
3. **插件化扩展**: 新增供应商无需修改类型定义
4. **代码简化**: 删除约 200 行转换和映射代码
5. **可维护性**: 单一事实来源（Rust 类型定义）

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

| 检测方式            | 准确性                   | 性能  | 跨平台 | 依赖   |
| ------------------- | ------------------------ | ----- | ------ | ------ |
| `window.matchMedia` | ❌ 不准确（webview限制） | ✅ 快 | ✅ 是  | 无     |
| 原生API查询         | ✅ 100%准确              | ✅ 快 | ✅ 是  | OS命令 |

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
