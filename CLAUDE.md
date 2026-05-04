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

# 测试
npm test               # 前端单测（Vitest watch 模式）
npm run test:run       # 前端单测（单次运行）
npm run test:run -- src/__tests__/services/tauriInvoke.test.ts  # 运行单个测试文件
npm run test:coverage  # 前端覆盖率报告
cd src-tauri && cargo test --quiet   # Rust 单测
npm run test:e2e       # E2E 冒烟测试（构建 debug 二进制 + WebDriverIO）

# 代码质量
npm run format         # Prettier 格式化前端
npm run format:check   # 检查前端格式
npm run fmt            # cargo fmt 格式化 Rust
npm run lint:all       # 检查所有代码格式（Prettier + cargo fmt）

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

### 前端分层

- **Store（Zustand）**: 4 个 Store 按职责划分 — `useAppStore`（配置）、`useTranslationStore`（条目/导航）、`useSessionStore`（翻译进度）、`useStatsStore`（统计）
- **命令层**: `services/commands.ts` 统一 12 个模块（config、aiConfig、aiModel、aiProvider、systemPrompt、termLibrary、translationMemory、poFile、fileFormat、translator、log、i18n、system）
- **API 客户端**: `services/apiClient.ts` → `services/tauriInvoke.ts` 两层封装，提供重试、超时、去重、错误提示
- **核心 Hook**: `useTranslationFlow` 聚合文件操作+翻译执行+条目管理；`useChannelTranslation` 处理 Channel API 翻译；`useConfig`（useAppData/useAIConfigs）提供数据访问
- **组件**: `TranslationWorkspace` 三列布局（条目列表+编辑器+AI 工作区），`EntryList` 使用 @tanstack/react-virtual 虚拟滚动

### 后端分层

- **命令**: `src-tauri/src/commands/` — 9 个命令模块，在 `main.rs` 的 `invoke_handler` 注册
- **服务**: `src-tauri/src/services/` — 核心业务逻辑（翻译、解析、配置、统计）
- **AI 供应商**: `services/ai/` — 插件化架构，`providers/` 目录下每个供应商一个模块，`models/` 目录下对应模型实现，通过 `provider.rs` 的 Provider trait 统一接口
- **配置管理**: `ConfigDraft` 草稿模式，读写分离 + 原子更新
- **错误处理**: 统一使用 `error.rs` 中的 `AppError` 类型

## 开发模式

### 添加新 Tauri 命令

1. 在 `src-tauri/src/commands/` 添加命令函数
2. 在 `main.rs` 的 `invoke_handler` 注册
3. 在 `src/services/commands.ts` 添加前端调用

### 添加新 AI 供应商

插件化架构，在 `services/ai/providers/` 目录添加：
1. 实现模型文件（参考 `openai.rs`、`moonshot.rs`）
2. 在 `services/ai/models/mod.rs` 注册

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
const { config, refreshAll } = useAppData();

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
let draft = ConfigDraft::global().await;
let config = draft.data();            // 读取
let mut config = draft.draft();       // 修改
config.ai_configs.push(new_config);
draft.apply()?;                       // 保存 + 发射事件
```

## CI 工作流

4 个 GitHub Actions 工作流（`.github/workflows/`）：

- **check.yml** — push/PR 触发：Prettier 格式检查（增量）、cargo fmt、前端构建、前端单测、Rust 单测、Clippy（`-D warnings`）
- **ui-e2e.yml** — push to main：构建 debug 二进制 + WebDriverIO E2E 冒烟测试（Windows）
- **build.yml** — 手动触发：跨平台构建（macOS/Ubuntu/Windows），产物保留 30 天
- **release.yml** — 发布流程

## Clippy 与 Lint 规则

Cargo.toml 配置了严格的 Clippy lint（`[lints.clippy]`）：
- **deny**: correctness、suspicious、panic、unimplemented、unused_async、await_holding_lock、mutex_atomic
- **warn**: unwrap_used、expect_used、todo、dbg_macro、clone_on_ref_ptr
- 使用 `parking_lot::RwLock` 替代 `std::sync::RwLock`
- 完整规则见 `src-tauri/Cargo.toml` 的 `[lints]` 段

## 常见错误与解决方案

详见 `docs/ERRORS.md`。

**关键规则**：
- CI 配置不能使用 `|| true` 绕过检查
- 不要创建第三方库的类型 shim（如 swr-shim.d.ts）
- 统一使用 `AppError` 进行错误处理
- 遇到新错误并解决后，更新 `docs/ERRORS.md`

## 注意事项

**前端**：
- 事件系统直接使用 Tauri 2.0 原生 `listen()` API
- 大型组件拆分为 Hook + 组件（参考 `useTranslationFlow`）
- Store 按职责划分，避免重复管理相同状态
- 使用原子化 selectors 避免不必要重渲染
- 快捷键在 `App.tsx` 中通过原生事件监听器实现

**后端**：
- 大文件自动分块处理（10MB+ 每批 500 条目）
- 进度更新节流 100ms
- 模块拆分：提示词构建、统计计算独立管理

**开发规范**：
- 写代码时要复用，多用函数封装功能
- 不要保留旧代码和旧接口，直接用新的替换
- 错误处理统一封装，在一个地方管日志和提示
- 一个函数干一件事，功能复杂就拆小
- 不要使用 emoji
- 优先检查项目中是否有已实现框架/模块处理该问题
- 利用框架解决通用问题，避免临时补丁

## 技术栈

**前端**: React 19, TypeScript 5.9, Ant Design 6, Zustand 5, Vite 7.3, i18next 25.8, SWR 2.3, @tanstack/react-virtual 3.x, immer 11.x

**后端**: Tauri 2.9, Rust Edition 2024, Tokio 1.x, reqwest 0.12, serde, nom 7.x, flexi_logger 0.31, parking_lot 0.12, tokio-util 0.7 (CancellationToken)
