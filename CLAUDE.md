# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

基于 Tauri 2.x (Rust + React) 构建的 PO 文件翻译工具，提供 AI 驱动的翻译功能。

- **架构**: 前端 (React 19 + TypeScript + Ant Design 6) + 后端 (Rust Edition 2024 + Tauri 2.x)
- **主要用途**: 本地化文件的 AI 辅助翻译
- **状态**: 生产就绪

## 开发命令

```bash
# 核心开发
npm run tauri:dev      # 启动开发服务器（首次较慢，需编译 Rust）
npm run tauri:build    # 构建生产版本
npm run tauri:portable # 构建便携版本
npm run dev            # 仅前端开发（Vite）

# 代码质量
npm run format         # Prettier 格式化前端
npm run format:check   # 检查前端格式
npm run fmt            # cargo fmt 格式化 Rust
npm run lint:all       # 检查所有代码格式

# i18n 检查
npm run i18n:check     # 检查未使用的 i18n key

# 清理缓存
cd src-tauri && cargo clean  # 清理 Rust 构建
```

## 架构概览

```
React 组件
   ↓ useTranslationFlow / useAppData / SWR hooks
commands.ts (12个命令模块，~60个命令)
   ↓ apiClient (重试、超时、去重、错误提示)
   ↓ tauriInvoke (日志、错误处理)
Tauri Commands (main.rs 注册)
   ↓
Rust Services (services/)
   ├── ai_translator (核心翻译引擎)
   ├── prompt_builder (提示词构建)
   ├── translation_stats (统计计算)
   ├── batch_translator (批量翻译，Channel API)
   ├── translation_task (翻译任务，支持取消)
   ├── batch_progress_channel (进度通道)
   └── config_draft (原子更新)
   ↓
JSON 持久化
```

**Store 层架构（2026-01 重构）**：
```
useAppStore         → 应用配置（主题、语言、累计统计）
useTranslationStore → 翻译状态（条目、导航、文件路径）
useSessionStore     → 会话状态（翻译进度、会话统计）
useStatsStore       → 统计数据（持久化）
```

**前端命令层（12个模块）**：
- `configCommands` - 应用配置
- `aiConfigCommands` - AI 配置管理
- `aiModelCommands` - 模型信息、成本估算
- `aiProviderCommands` - 供应商查询
- `systemPromptCommands` - 系统提示词
- `termLibraryCommands` - 术语库管理
- `translationMemoryCommands` - 翻译记忆库
- `poFileCommands` - PO 文件解析
- `fileFormatCommands` - 文件格式检测
- `translatorCommands` - 翻译执行
- `logCommands` - 日志查询
- `i18nCommands` - 国际化
- `systemCommands` - 系统信息

### 前端关键文件 (`src/`)

**主应用**：
- `App.tsx` - 主应用入口
  - 应用初始化
  - 全局配置检查
  - 快捷键绑定
  - 组件组合

**核心 Hook**：
- `hooks/useTranslationFlow.ts` - 翻译流程 Hook
  - 文件操作逻辑（打开、保存、另存为）
  - 翻译执行逻辑（批量、选中、精翻）
  - 条目管理逻辑（选择、更新）
  - 统计更新逻辑
- `hooks/useChannelTranslation.ts` - Channel API 翻译
- `hooks/useConfig.ts` - 数据访问 hooks (useAppData, useAIConfigs)
- `hooks/useTheme.ts` - 主题管理（直接 DOM 操作）

**核心组件**：
- `components/TranslationWorkspace.tsx` - 工作区组件
  - 三列布局（条目列表、编辑器、AI 工作区）
  - 拖拽调整列宽
  - FileInfoBar 集成
- `components/MenuBar.tsx` - 工具栏
- `components/EntryList.tsx` - 条目列表（虚拟滚动）
- `components/EditorPane.tsx` - 编辑器

**核心服务**：
- `services/commands.ts` - 统一命令层（12个模块，~60个命令）
- `services/apiClient.ts` - API 客户端封装（重试、超时、去重）
- `services/tauriInvoke.ts` - Tauri 调用封装（日志、错误处理）

**Store（Zustand 状态管理）**：
- `store/useAppStore.ts` - 应用配置（主题、语言、累计统计）
- `store/useTranslationStore.ts` - 翻译状态（条目、当前条目、导航）
- `store/useSessionStore.ts` - 会话状态（翻译进度、会话统计）
- `store/useStatsStore.ts` - 统计数据（持久化）

### 后端关键文件 (`src-tauri/src/`)

**入口和配置**：
- `main.rs` - 入口，注册所有 Tauri 命令
- `error.rs` - 统一错误类型（AppError）

**命令模块（9个）**：
- `commands/ai_config.rs` - AI 配置命令
- `commands/ai_model_commands.rs` - 模型信息、成本估算
- `commands/config_sync.rs` - 配置同步
- `commands/file_format.rs` - 文件格式检测
- `commands/language.rs` - 语言检测
- `commands/prompt_log.rs` - 提示词日志
- `commands/system.rs` - 系统命令
- `commands/translator.rs` - 翻译命令

**核心服务**：
- `services/ai_translator.rs` - AI 翻译核心
- `services/batch_translator.rs` - 批量翻译（去重、进度）
- `services/translation_task.rs` - 翻译任务（支持取消）
- `services/batch_progress_channel.rs` - 进度通道（Channel API）
- `services/po_parser.rs` - PO 文件解析（nom）
- `services/config_draft.rs` - 草稿模式配置（原子更新）
- `services/prompt_builder.rs` - 提示词构建器
- `services/translation_stats.rs` - 翻译统计（TokenStats、BatchStats）
- `services/file_format.rs` - 文件格式检测
- `services/language_detector.rs` - 语言检测
- `services/term_library.rs` - 术语库管理
- `services/translation_memory.rs` - 翻译记忆库
- `services/prompt_logger.rs` - 提示词日志
- `services/file_chunker.rs` - 文件分块处理

**AI 供应商架构**：
- `services/ai/` - AI 供应商实现
  - `providers/` - moonshot, openai, deepseek, zhipuai, minimax
  - `models/` - 各厂商模型实现
  - `plugin_loader.rs` - 插件加载
  - `provider.rs` - Provider trait
  - `cost_calculator.rs` - 成本计算
  - `model_info.rs` - 模型信息
  - `plugin_config.rs` - 插件配置

**工具模块**：
- `utils/init.rs` - 应用初始化
- `utils/draft.rs` - 通用草稿模式

## 开发模式

### 命令层调用

```typescript
import { configCommands, aiConfigCommands, translatorCommands } from '@/services/commands';

const config = await configCommands.get();
const result = await translatorCommands.batchTranslate(entries, targetLang);
```

### 数据访问

```typescript
// 推荐：使用 useAppData
import { useAppData, useAIConfigs } from '@/hooks/useConfig';

function MyComponent() {
  const { config, refreshAll } = useAppData();
  const { configs, active } = useAIConfigs();
}

// 或直接 SWR
import useSWR from 'swr';
const { data, mutate } = useSWR('key', () => someCommand.get());
```

### 事件监听

```typescript
import { listen } from '@tauri-apps/api/event';

useEffect(() => {
  const unlisten = listen('translation:progress', (event) => {
    setProgress(event.payload);
  });
  return unlisten;
}, []);
```

### 配置管理 (Rust 草稿模式)

```rust
// 读取
let draft = ConfigDraft::global().await;
let config = draft.data();

// 修改
let mut config = draft.draft();
config.ai_configs.push(new_config);
draft.apply()?; // 保存 + 发射事件
```

### 快捷键参考

| 快捷键 | 功能 |
|--------|------|
| `Ctrl+O` | 打开文件 |
| `Ctrl+S` | 保存文件 |
| `Ctrl+Shift+S` | 另存为 |
| `Ctrl+Shift+R` | 精翻选中条目（Contextual Refine） |
| `Ctrl+,` | 打开设置 |
| `Ctrl+D` | 打开开发工具 |

快捷键在 `App.tsx` 中通过原生事件监听器实现，不使用第三方库。

## 常见任务

### 添加新 Tauri 命令

1. 在 `src-tauri/src/commands/` 添加命令函数
2. 在 `main.rs` 的 `invoke_handler` 注册
3. 在 `src/services/commands.ts` 添加前端调用

### 添加新 AI 供应商

插件化架构，在 `services/ai/providers/` 目录添加：
1. 实现模型文件（参考 `openai.rs`、`moonshot.rs`）
2. 在 `services/ai/models/mod.rs` 注册

### 添加新组件

1. 在 `src/components/` 创建组件
2. 使用 `useAppData` 或 commands 获取数据
3. 使用 `listen()` 订阅后端事件

### 使用翻译流程 Hook

```typescript
import { useTranslationFlow } from '@/hooks/useTranslationFlow';

function MyComponent() {
  const {
    // 状态
    entries,
    currentEntry,
    isTranslating,
    progress,
    // 文件操作
    openFile,
    saveFile,
    saveAsFile,
    // 翻译
    translateBatch,
    translateSelection,
    refineTranslation,
    // 条目操作
    selectEntry,
    updateCurrentEntry,
    nextEntry,
    previousEntry,
  } = useTranslationFlow();

  return <button onClick={openFile}>打开文件</button>;
}
```

### 使用 Store

```typescript
// 应用配置（主题、语言）
import { useAppStore } from '@/store/useAppStore';
const theme = useAppStore((state) => state.theme);

// 翻译状态（条目、导航）
import { useTranslationStore } from '@/store/useTranslationStore';
const { entries, currentEntry, nextEntry } = useTranslationStore();

// 会话状态（进度）
import { useSessionStore } from '@/store/useSessionStore';
const { isTranslating, progress } = useSessionStore();

// 统计数据
import { useStatsStore } from '@/store/useStatsStore';
const { cumulativeStats } = useStatsStore();
```

## 技术栈

**前端**:
- React 19
- TypeScript 5.9
- Ant Design 6
- Zustand 5
- Vite 7.3
- i18next 25.8
- SWR 2.3
- @tanstack/react-virtual 3.x（虚拟滚动）
- immer 11.x（不可变更新）

**后端**:
- Tauri 2.9
- Rust Edition 2024
- Tokio 1.x（异步运行时）
- reqwest 0.12（HTTP 客户端）
- serde（序列化）
- nom 7.x（解析器组合子）
- flexi_logger 0.31（日志）
- parking_lot 0.12（并发原语）
- whatlang 0.16（语言检测）
- sys-locale 0.3（系统语言）
- tokio-util 0.7（CancellationToken）
- once_cell 1.21（全局状态）
- dunce 1.0（路径规范化）

## 常见错误与解决方案

开发过程中遇到的典型错误已记录在以下文档中：

- **快速参考**: `memory/MEMORY.md` - 10 个关键经验教训
- **详细分析**: `docs/ERRORS.md` - 完整的错误分析和解决方案

**重要提醒**：
- 遇到新错误并解决后，请更新上述文档，避免重复犯错
- CI 配置不能使用 `|| true` 绕过检查
- 不要创建第三方库的类型 shim（如 swr-shim.d.ts）
- 统一使用 `AppError` 进行错误处理

## 注意事项

**前端**：
- 事件系统直接使用 Tauri 2.0 原生 `listen()` API
- 大型组件拆分为 Hook + 组件（参考 `useTranslationFlow`）
- Store 按职责划分：应用配置、翻译状态、会话状态、统计数据
- 避免在 Store 中重复管理相同状态
- 使用原子化 selectors 避免不必要重渲染
- 使用 O(1) 索引查找替代 O(n) indexOf

**后端**：
- 配置修改使用 `ConfigDraft` 草稿模式确保原子更新
- 错误处理使用统一的 `AppError` 类型
- 大文件自动分块处理（10MB+ 每批 500 条目）
- 进度更新节流 100ms
- 模块拆分：提示词构建、统计计算独立管理
- 遵循 Clippy 规则（Cargo.toml 中配置了严格的 lint）
- 使用 parking_lot::RwLock 替代 std::sync::RwLock

**性能优化**：
- 虚拟滚动：`@tanstack/react-virtual`
- 批量翻译使用 Channel API（性能提升 40%）
- 进度更新节流（100ms 间隔）
- React.memo 优化核心组件

**开发规范**（来自 .cursor/rules）：
- 写代码时要复用，多用函数封装功能
- 不要保留旧代码和旧接口，直接用新的替换
- 错误处理统一封装，在一个地方管日志和提示
- 一个函数干一件事，功能复杂就拆小
- 不要使用 emoji
- 优先检查项目中是否有已实现框架/模块处理该问题
- 利用框架解决通用问题，避免临时补丁
