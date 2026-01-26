# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

基于 Tauri 2.x (Rust + React) 构建的 PO 文件翻译工具，提供 AI 驱动的翻译功能。

- **架构**: 前端 (React 18 + TypeScript + Ant Design 5) + 后端 (Rust + Tauri 2.x)
- **主要用途**: 本地化文件的 AI 辅助翻译
- **状态**: 生产就绪

## 开发命令

```bash
# 核心开发
npm run tauri:dev      # 启动开发服务器（首次较慢，需编译 Rust）
npm run tauri:build    # 构建生产版本
npm run dev            # 仅前端开发

# 代码质量
npm run format         # Prettier 格式化前端
npm run fmt            # cargo fmt 格式化 Rust
npm run lint:all       # 检查所有代码格式

# 清理缓存
cd src-tauri && cargo clean  # 清理 Rust 构建
```

## 架构概览

```
React 组件
   ↓ useTranslationFlow / useAppData / SWR hooks
commands.ts (12个模块，~47个命令)
   ↓ apiClient (重试、超时、去重、错误提示)
   ↓ tauriInvoke (日志、错误处理)
Tauri Commands (main.rs 注册)
   ↓
Rust Services (services/)
   ├── ai_translator (核心翻译引擎)
   ├── prompt_builder (提示词构建) 🆕
   ├── translation_stats (统计计算) 🆕
   ├── batch_translator (批量翻译)
   └── config_draft (原子更新)
   ↓
JSON 持久化
```

**Store 层架构（2026-01 重构）**：
```
useAppStore         → 应用配置（主题、语言、累计统计）
useTranslationStore → 翻译状态（条目、导航、文件路径） 🆕
useSessionStore     → 会话状态（翻译进度、会话统计）
useStatsStore       → 统计数据（持久化）
```

### 前端关键文件 (`src/`)

**主应用**：
- `App.tsx` - 主应用（168 行，已拆分优化）
  - 应用初始化
  - 全局配置检查
  - 快捷键绑定
  - 组件组合

**新增架构（2026-01）**：
- `hooks/useTranslationFlow.ts` - 翻译流程 Hook（370 行）
  - 文件操作逻辑（打开、保存、另存为）
  - 翻译执行逻辑（批量、选中、精翻）
  - 条目管理逻辑（选择、更新）
  - 统计更新逻辑
- `components/TranslationWorkspace.tsx` - 工作区组件（172 行）
  - 三列布局（条目列表、编辑器、AI 工作区）
  - 拖拽调整列宽
  - FileInfoBar 集成

**核心服务**：
- `services/commands.ts` - 统一命令层，所有 Tauri 调用入口
- `services/apiClient.ts` - API 客户端封装
- `services/tauriInvoke.ts` - Tauri 调用封装（日志、错误处理）

**Hooks**：
- `hooks/useConfig.ts` - 数据访问 hooks (useAppData, useAIConfigs)
- `hooks/useTheme.ts` - 主题管理（直接 DOM 操作）
- `hooks/useChannelTranslation.ts` - Channel API 翻译

**Store（Zustand 状态管理）**：
- `store/useAppStore.ts` - 应用配置（主题、语言、累计统计）
- `store/useTranslationStore.ts` - 翻译状态（条目、当前条目、导航）
- `store/useSessionStore.ts` - 会话状态（翻译进度、会话统计）
- `store/useStatsStore.ts` - 统计数据（持久化）

### 后端关键文件 (`src-tauri/src/`)

**入口和配置**：
- `main.rs` - 入口，注册所有 Tauri 命令
- `error.rs` - 统一错误类型（AppError，10 种错误类型）

**核心服务**：
- `services/config_draft.rs` - 草稿模式配置（原子更新）
- `services/ai_translator.rs` - AI 翻译核心（1136 行，已优化）
- `services/batch_translator.rs` - 批量翻译（去重、进度）
- `services/po_parser.rs` - PO 文件解析（nom）

**新增模块（2026-01）**：
- `services/prompt_builder.rs` - 提示词构建器（106 行）
  - `build_system_prompt()` - 系统提示词构建
  - `build_translation_prompt()` - 翻译提示词构建
- `services/translation_stats.rs` - 翻译统计（231 行）
  - `TokenStats` 结构体及方法
  - `BatchStats` 结构体及方法
  - 成本计算逻辑

**AI 供应商架构**：
- `services/ai/` - AI 供应商实现
  - `providers/` - moonshot, openai, deepseek
  - `plugin_loader.rs` - 插件加载

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

## 常见任务

### 添加新 Tauri 命令

1. 在 `src-tauri/src/commands/` 添加命令函数
2. 在 `main.rs` 的 `invoke_handler` 注册
3. 在 `src/services/commands.ts` 添加前端调用

### 添加新 AI 供应商

插件化架构，在 `plugins/` 目录添加：
1. `plugin.toml` - 配置（供应商信息、模型、定价）
2. `provider.rs` - 实现 `AIProvider` trait

### 添加新组件

1. 在 `src/components/` 创建组件
2. 使用 `useAppData` 或 commands 获取数据
3. 使用 `listen()` 订阅后端事件

### 使用翻译流程 Hook（2026-01 新增）

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

  return (
    <button onClick={openFile}>打开文件</button>
  );
}
```

### 使用 Store（2026-01 重构）

```typescript
// 应用配置（主题、语言）
import { useAppStore } from '@/store/useAppStore';
const theme = useAppStore((state) => state.theme);

// 翻译状态（条目、导航） 🆕
import { useTranslationStore } from '@/store/useTranslationStore';
const { entries, currentEntry, nextEntry } = useTranslationStore();

// 会话状态（进度） 🆕
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

**后端**:
- Tauri 2.x
- Rust Edition 2024
- Tokio (异步运行时)
- reqwest (HTTP 客户端)
- serde (序列化)
- nom (解析器组合子)
- flexi_logger (日志)
- parking_lot (并发原语)

## 注意事项

**前端**：
- 事件系统直接使用 Tauri 2.0 原生 `listen()` API
- 大型组件拆分为 Hook + 组件（参考 `useTranslationFlow`）
- Store 按职责划分：应用配置、翻译状态、会话状态、统计数据
- 避免在 Store 中重复管理相同状态

**后端**：
- 配置修改使用 `ConfigDraft` 草稿模式确保原子更新
- 错误处理使用统一的 `AppError` 类型
- 大文件自动分块处理（10MB+ 每批 500 条目）
- 进度更新节流 100ms
- 模块拆分：提示词构建、统计计算独立管理

**性能优化**：
- 虚拟滚动：`@tanstack/react-virtual`
- 批量翻译使用 Channel API（性能提升 40%）
- 进度更新节流（100ms 间隔）
- React.memo 优化核心组件
