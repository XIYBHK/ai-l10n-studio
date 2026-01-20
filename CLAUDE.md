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
   ↓ useAppData / SWR hooks
commands.ts (12个模块，~47个命令)
   ↓ apiClient (重试、超时、去重)
   ↓ tauriInvoke (日志、错误处理)
Tauri Commands (main.rs 注册)
   ↓
Rust Services (services/)
   ↓ ConfigDraft (原子更新)
JSON 持久化
```

### 前端关键文件 (`src/`)

- `App.tsx` - 主应用，文件操作、翻译流程、布局
- `services/commands.ts` - 统一命令层，所有 Tauri 调用入口
- `services/apiClient.ts` - API 客户端封装
- `hooks/useConfig.ts` - 数据访问 hooks (useAppData, useAIConfigs)
- `hooks/useTheme.ts` - 主题管理（直接 DOM 操作）
- `hooks/useChannelTranslation.ts` - Channel API 翻译
- `store/useAppStore.ts` - Zustand 状态（主题、语言持久化）
- `store/useSessionStore.ts` - 会话状态
- `store/useStatsStore.ts` - 统计状态

### 后端关键文件 (`src-tauri/src/`)

- `main.rs` - 入口，注册所有 Tauri 命令
- `services/config_draft.rs` - 草稿模式配置（原子更新）
- `services/ai_translator.rs` - AI 翻译核心
- `services/batch_translator.rs` - 批量翻译（去重、进度）
- `services/po_parser.rs` - PO 文件解析（nom）
- `services/ai/` - AI 供应商实现
  - `providers/` - moonshot, openai, deepseek
  - `plugin_loader.rs` - 插件加载
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

## 技术栈

**前端**: React 18, TypeScript, Ant Design 5, Zustand, Vite, i18next, SWR

**后端**: Tauri 2.x, Rust Edition 2024, Tokio, reqwest, serde, nom, flexi_logger, parking_lot

## 注意事项

- 事件系统直接使用 Tauri 2.0 原生 `listen()` API
- 配置修改使用 `ConfigDraft` 草稿模式确保原子更新
- 大文件自动分块处理（10MB+ 每批 500 条目）
- 进度更新节流 100ms
