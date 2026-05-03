# API 参考

**Last Updated**: 2026-05-04
**Scope**: Tauri IPC commands, frontend services, hooks, and stores

## 架构总览

```
React Component
   │
   ├─ Hook (useConfig / useTranslationFlow / ...)      ← 推荐入口
   │   │
   │   └─ Command Module (aiConfigCommands.add(), ...)
   │
   └─ Command Module (directly in event handler)       ← 次选
       │
       ├─ apiClient.invoke(name, args)                 ← 高层（错误 UI）
       │   │
       │   └─ tauriInvoke(name, args)                  ← 中间层（日志、PII 脱敏）
       │       │
       │       └─ @tauri-apps/api.invoke()             ← Tauri IPC
       │
       └─ Backend Rust Command                          ← 35+ handlers
```

**两条铁律**：

1. 组件禁止直接调用 `invoke()`；必须经 `apiClient` 或 `tauriInvoke`
2. 持久化数据必须通过 SWR hook 访问（`useConfig` / `useAIConfigs` / `useTranslationMemory` / `useTermLibrary`）

---

## 命令模块（`src/services/`）

13 个命令对象按功能分散在 6 个文件：

| 文件 | 暴露的 Commands |
|---|---|
| `aiCommands.ts` | `aiConfigCommands`、`aiModelCommands`、`aiProviderCommands`、`systemPromptCommands` |
| `configCommands.ts` | `configCommands` |
| `fileCommands.ts` | `poFileCommands`、`fileFormatCommands`、`dialogCommands` |
| `logCommands.ts` | `logCommands` |
| `termCommands.ts` | `termLibraryCommands`、`translationMemoryCommands` |
| `translationCommands.ts` | `translatorCommands`、`i18nCommands` |

### 典型用法

```typescript
import { aiConfigCommands } from '../services/aiCommands';
import { poFileCommands } from '../services/fileCommands';

const configs = await aiConfigCommands.getAll();
const entries = await poFileCommands.parse(filePath);
```

### 核心命令对象

#### `aiConfigCommands`（AI 提供商配置 CRUD）

```typescript
aiConfigCommands.getAll(): Promise<AIConfig[]>
aiConfigCommands.getActive(): Promise<AIConfig | null>
aiConfigCommands.add(config: AIConfig): Promise<void>
aiConfigCommands.update(index: string, config: AIConfig): Promise<void>
aiConfigCommands.delete(index: string): Promise<void>
aiConfigCommands.setActive(index: string): Promise<void>
aiConfigCommands.testConnection(providerId, apiKey, baseUrl?, model?): Promise<void>
```

#### `aiModelCommands`（模型信息 + 精确成本）

```typescript
aiModelCommands.getProviderModels(provider: string): Promise<ModelInfo[]>
aiModelCommands.getModelInfo(provider: string, modelId: string): Promise<ModelInfo | null>
aiModelCommands.calculatePreciseCost(
  provider: string, modelId: string,
  inputTokens: number, outputTokens: number,
  cacheWriteTokens?: number, cacheReadTokens?: number
): Promise<CostBreakdown>
```

#### `aiProviderCommands`（动态供应商系统）

```typescript
aiProviderCommands.getAll(): Promise<ProviderInfo[]>
aiProviderCommands.getProvider(id: string): Promise<ProviderInfo | null>
aiProviderCommands.findProviderForModel(modelId: string): Promise<ProviderInfo | null>
aiProviderCommands.getAllModels(): Promise<ModelInfo[]>
```

#### `translatorCommands`（翻译执行）

```typescript
translatorCommands.translateSingle(text: string, targetLang: string): Promise<string>
translatorCommands.contextualRefine(requests: RefineRequest[], targetLang: string): Promise<string[]>
// 批量翻译用 useChannelTranslation hook（流式进度），不用此处
```

#### `poFileCommands` / `dialogCommands`（文件操作）

```typescript
poFileCommands.parse(filePath: string): Promise<POEntry[]>
poFileCommands.save(filePath: string, entries: POEntry[]): Promise<void>
dialogCommands.openFile(): Promise<string | null>
dialogCommands.saveFile(): Promise<string | null>
```

#### `termLibraryCommands` / `translationMemoryCommands`（术语库 + 翻译记忆库）

```typescript
translationMemoryCommands.get(): Promise<TranslationMemory>
translationMemoryCommands.save(memory: TranslationMemory): Promise<void>
translationMemoryCommands.mergeBuiltinPhrases(): Promise<number>

termLibraryCommands.get(): Promise<TermLibrary>
termLibraryCommands.addTerm(data: TermInput): Promise<void>
termLibraryCommands.shouldUpdateStyleSummary(): Promise<boolean>
termLibraryCommands.generateStyleSummary(): Promise<void>
```

#### `i18nCommands`（语言检测）

```typescript
i18nCommands.detectLanguage(text: string): Promise<LanguageInfo>
i18nCommands.getDefaultTargetLanguage(sourceCode: string): Promise<LanguageInfo>
i18nCommands.getSupportedLanguages(): Promise<LanguageInfo[]>
i18nCommands.getSystemLocale(): Promise<string>
```

---

## Hook API

### 核心 Hooks

| Hook | 用途 |
|---|---|
| `useTranslationFlow` | 主业务编排：文件操作、翻译执行、事件监听、渐进式队列 |
| `useChannelTranslation` | Tauri Channel 流式批量翻译（解构使用以保持稳定函数引用） |
| `useConfig` / `useAppData` | SWR 数据聚合（应用配置、AI 配置、系统提示词） |
| `useAIConfigs` / `useSystemPrompt` | 细粒度 SWR 数据 hook |
| `useTranslationMemory` / `useTermLibrary` | SWR + Tauri event-driven refresh（内置 `isActive` 竞态守卫） |
| `useTheme` | 主题管理（明暗/系统，DOM `data-theme` 属性切换） |
| `useTermDetection` | 术语差异分析 + 确认弹窗状态（从 EditorPane 抽出） |
| `useEntrySelection` | 列表选择状态（Set 基础 + range 选择） |
| `useAsync` | 通用异步状态（loading/error/data） |
| `useCssColors` | CSS 变量常量（无 Hook 开销，`CSS_COLORS` 对象） |
| `useSupportedLanguages` | 后端拉取支持语言列表 |

### `useTranslationFlow` 返回值

```typescript
function useTranslationFlow(): {
  entries: POEntry[];
  currentEntry: POEntry | null;
  currentFilePath: string | null;
  isTranslating: boolean;
  progress: number;
  translationStats: TranslationStats | null;
  sourceLanguage: string;   // ← 来自 useTranslationStore
  targetLanguage: string;   // ← 来自 useTranslationStore
  openFile: () => Promise<void>;
  saveFile: () => Promise<void>;
  saveAsFile: () => Promise<void>;
  translateAll: () => Promise<void>;
  handleTranslateSelected: (indices: number[]) => Promise<void>;
  handleContextualRefine: (indices: number[]) => Promise<void>;
  handleEntrySelect: (entry: POEntry) => void;
  handleEntryUpdate: (index: number, updates: Partial<POEntry>) => void;
  cancelTranslation: () => void;
  resetTranslationStats: () => void;
};
```

### `useChannelTranslation` 使用模式

```typescript
// 正确：解构出稳定函数引用
const { translateBatch, cancelTranslation } = useChannelTranslation();

await translateBatch(texts, targetLanguage, {
  onProgress: (current, total, percentage) => setProgress(percentage),
  onStats: (stats) => updateStats(stats),
  onItem: (index, translation) => enqueueUpdate({ index, translation }),
});
```

避免 `const ct = useChannelTranslation(); ct.cancelTranslation()` —— 返回对象每次渲染都是新引用。

### 异步监听器标准模式

所有订阅 `listen()` 的 hook 必须加 `isActive` 标志防竞态：

```typescript
useEffect(() => {
  let unlistenFn: (() => void) | null = null;
  let isActive = true;

  listen('event-name', (event) => {
    if (isActive) handleEvent(event);
  }).then((fn) => {
    if (isActive) unlistenFn = fn;
    else fn();  // 已卸载，立即清理
  });

  return () => {
    isActive = false;
    unlistenFn?.();
  };
}, [deps]);
```

---

## Zustand Store API

4 个 store 按责任拆分。全部使用原子 selector。

### `useAppStore`（持久化）

```typescript
theme: 'light' | 'dark' | 'system';
systemTheme: 'light' | 'dark';
language: 'zh-CN' | 'en-US';
config: AppConfig | null;
setTheme(): void;
setLanguage(): void;
```

Hooks：`useThemeMode()`、`useLanguage()`、`useSystemTheme()`、`useSetThemeAction()`、`useSetLanguageAction()`。

### `useTranslationStore`（会话，非持久）

```typescript
entries: POEntry[];
entryIndexMap: Map<POEntry, number>;  // O(1) 查找
currentEntry: POEntry | null;
currentIndex: number;
currentFilePath: string | null;
sourceLanguage: string;
targetLanguage: string;
setEntries / setCurrentEntry / updateEntry / setCurrentFilePath: action
setSourceLanguage / setTargetLanguage: action
getEntryIndex(entry): number;  // O(1) Map lookup
nextEntry / previousEntry: action
```

Hooks：`useEntries()`、`useCurrentEntry()`、`useSourceLanguage()`、`useTargetLanguage()`、`useSetSourceLanguage()`、`useSetTargetLanguage()` 等。

### `useSessionStore`（会话，非持久）

```typescript
isTranslating: boolean;
progress: number;
sessionStats: TranslationStats;
setTranslating / setProgress / resetSessionStats / updateSessionStats: action
```

### `useStatsStore`（持久化，基于 `tauriStore`）

```typescript
cumulativeStats: TranslationStats;
updateCumulativeStats(stats: Partial<TranslationStats>): void;
resetCumulativeStats(): void;
```

### 原子 selector 规则

```typescript
// 正确：每个 hook 只订阅自己需要的字段
const entries = useEntries();
const currentEntry = useCurrentEntry();

// 错误：bulk 订阅造成不必要重渲染
const state = useTranslationStore();  // 禁止
```

---

## 后端 Rust 命令

### 组织

`src-tauri/src/commands/` 下 9 个命令模块，注册在 `main.rs` 的 `invoke_handler`：

| 模块 | 命令主题 |
|---|---|
| `ai_config.rs` | AI 配置 CRUD |
| `ai_model_commands.rs` | 模型信息、成本计算 |
| `config_sync.rs` | 应用配置读写 |
| `file_format.rs` | PO/JSON/XLIFF/YAML 格式检测 |
| `language.rs` | 语言检测、系统 locale |
| `prompt_log.rs` | 提示词日志 |
| `system.rs` | 系统信息 |
| `translator.rs` | 批量翻译、Channel 流式、取消 |
| `mod.rs` | 模块汇总 |

### 添加新命令（3 步）

1. 在 `src-tauri/src/commands/*.rs` 中写 `#[tauri::command] pub async fn foo(...) -> Result<T, AppError>`
2. 在 `main.rs` 的 `.invoke_handler(tauri::generate_handler![..., foo])` 注册
3. 在 `src/services/*Commands.ts` 的对应命令对象加包装：`foo: (args) => apiClient.invoke('foo', { args })`

### 错误处理

所有 Rust 命令返回 `Result<T, AppError>`（`src-tauri/src/error.rs`）。`AppError` 枚举 10 类（Config / Translation / Io / Network / Serde / Proxy / Parse / Plugin / Validation / Generic）自动从 `anyhow` / `reqwest` / `std::io` / `serde_json` 转换。

```rust
use crate::error::AppError;

#[tauri::command]
async fn save_config(config: AppConfig) -> Result<(), AppError> {
    let draft = ConfigDraft::global().await;
    {
        let mut data = draft.draft();
        *data = config;
    }
    draft.apply()?;  // 保存到磁盘 + 发送 config:updated 事件
    Ok(())
}
```

---

## 配置 Draft 模式（`ConfigDraft`）

**位置**: `src-tauri/src/services/config_draft.rs`

### 原则

- **全局单例**：`ConfigDraft::global().await`
- **原子更新**：`draft()` 返回可写克隆 → 修改 → `apply()` 一次性写盘并发事件
- **并发安全**：`parking_lot::RwLock`，读者多线程并发，写者排他
- **Guard 不跨 await**：所有 read/write guard 必须在 `await` 前释放

```rust
// 正确
let draft = ConfigDraft::global().await;
{
    let mut cfg = draft.draft();
    cfg.log_level = Some("debug".into());
}  // guard 释放
draft.apply()?;

// 错误（编译失败：guard not Send）
let cfg = draft.data();
some_async_fn().await;  // guard 跨 await 点
```

### 数据流

```
Frontend: configCommands.update(config)
   ↓ Tauri IPC (camelCase → snake_case via serde)
Backend: #[tauri::command] update_app_config(config)
   ↓
ConfigDraft::global().draft() → 写入 → apply()
   ↓
1. 序列化到磁盘 `app_config.json`
2. Tauri emit('config:updated', config)
   ↓ listen
Frontend: SWR mutate('app_config')
```

---

## 流式批量翻译（Channel API）

**用途**：批量翻译百条以上条目时保持 UI 响应。

```typescript
const { translateBatch, cancelTranslation } = useChannelTranslation();

const result = await translateBatch(texts, targetLanguage, {
  onProgress: (current, total, percentage) => {/* 进度条 */},
  onStats: (stats) => {/* 实时统计 */},
  onItem: (index, translation) => {
    enqueueUpdate({ index, translation, source: 'ai' });  // 入队渐进式上屏
  },
});

// 需取消时：
await cancelTranslation();
```

后端 `translator.rs::translate_batch_with_channel` 通过双 Channel 推送 `BatchProgressEvent` 和 `BatchStatsEvent`，前端无需轮询。

---

## 参考

- 数据契约与类型定义：`docs/DataContract.md`
- 架构总览与演进：`docs/Architecture.md`
- 主题与色彩：`docs/THEME.md`、`docs/COLOR_SYSTEM.md`
- 安全与密钥存储：`docs/SECURITY_NOTES.md`
- 错误排查：`docs/ERRORS.md`
- 前端知识库：`src/AGENTS.md`
- 项目根知识库：`AGENTS.md`
