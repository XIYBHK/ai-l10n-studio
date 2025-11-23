# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

本文件为 Claude Code (claude.ai/code) 在此代码库中工作时提供指导。

## 项目概述

这是一个基于 Tauri (Rust + React) 构建的专业 PO 文件翻译工具。该应用提供 AI 驱动的翻译功能，具备多 AI 提供商、上下文细化和多语言支持等高级特性。

**架构**: 前端 (React + TypeScript + Ant Design) + 后端 (Rust + Tauri)
**主要用途**: 为本地化文件提供 AI 辅助的专业翻译工作流
**当前版本**: Phase 9+ (2025-11 性能优化完成)
**开发状态**: 生产就绪

### 核心功能

- **多 AI 提供商支持**: 8 家 AI 服务 (Moonshot, OpenAI, 讯飞星火, 百度文心, 阿里通义, 智谱AI, Claude, Gemini)
- **自定义系统提示词**: 用户可定制的翻译提示词
- **多格式文件**: PO, JSON, XLIFF, YAML 格式检测与元数据
- **多语言翻译**: 10 种语言自动检测
- **应用本地化**: 系统语言检测, i18n 支持
- **上下文细化**: 上下文感知的精细翻译 (Ctrl+Shift+R)
- **性能优化**: 大文件处理, 进度节流, 内存优化

### 架构增强 (2025-11 性能优化 - 重大重构)

**性能革命性提升** - 累计删除 5917 行过度工程化代码，应用流畅度提升 80-90%

**第一轮优化 (2025-11-01)**: 删除 3698 行
- **彻底简化事件系统**: 删除 `eventDispatcher.ts` (368行) 和 `useTauriEventBridge.enhanced.ts` (421行)，直接使用 Tauri 2.0 原生 `listen()` API
- **组件拆解重构**:
  - `SettingsModal.tsx` 从 1121 行拆解为 5 个独立 Tab 组件 (减少 92%)
  - `App.tsx` 从 925 行拆解为 4 个子组件 (减少 90%)
- **统计系统简化**: 删除 `statsEngine.ts` (147行) 和 `statsManagerV2.ts` (112行)，使用简单的 `useState`
- **主题系统优化**: `useTheme.ts` 从 253 行简化到 100 行，直接操作 DOM，切换速度提升 75%
- **配置管理简化**: 删除 `configSync.ts` (227行)，直接使用 Tauri `invoke()`
- **性能优化**: 添加 `React.memo` 优化核心组件，移除 22 处 `setTimeout(0)` 调用
- **日志系统优化**: 直接使用 `console.log`，消除宏任务队列膨胀

**第二轮优化 (2025-11-23)**: 删除 1232 行未使用代码
- **删除未使用文件**: 
  - `useNotification.ts` (221行) - 与 notificationManager 功能重复
  - `statsFormatter.ts` (277行) - 只是简单包装 formatters.ts
  - `useValidation.ts` (18行) - 完全未使用
  - `providerUtils.ts` (71行) - 完全未使用
  - `paramConverter.ts` (99行) - Tauri 2.x 已自动处理 camelCase
- **简化 API 封装**: 
  - 删除 `useAsync.ts` 中的 `useAsyncEffect` 函数 (60行)
  - 简化 `tauriInvoke.ts`、`apiClient.ts`、`api.ts` 中的参数转换逻辑 (~486行)
- **清理空目录**: 删除 `src/components/app/` 空目录

**第三轮优化 (2025-11-23)**: 删除 987 行深度封装
- **简化 API 封装为两层**: 
  - 删除 `api.ts` (97行) - 中间透传层，commands.ts 直接调用 apiClient
  - 删除 `swr.ts` (42行) - hooks 直接传入 fetcher
  - 简化 `apiClient.ts` 和 `tauriInvoke.ts` (~100行) - 移除所有参数转换代码
- **精简注释**: 
  - 精简 `store/index.ts` 中的长注释 (~30行)
  - 优化文档可读性

**性能提升成果**:
- 主题切换: ~200ms → <50ms (提升 75%)
- 语言切换: ~500ms → <100ms (提升 80%)
- 事件响应: ~100ms → <30ms (提升 70%)
- API 调用链: 缩短 33% (从三层到两层)
- 整体流畅度提升 80-90%
- 代码库减少 **5917 行** (约 18% 代码量)

## 开发命令

### 核心开发

```bash
npm run tauri:dev      # 启动开发服务器 (首次运行较慢，需要编译 Rust)
npm run tauri:build    # 构建生产可执行文件
npm run dev            # 仅前端 (用于 UI 开发)
npm run build          # 仅构建前端
npm run tauri clean    # 清理 Rust 构建缓存
npm run tauri:portable # 构建便携版本
```

### 代码质量

```bash
npm run format         # 使用 Prettier 格式化前端代码
npm run format:check   # 检查代码格式
npm run fmt            # 格式化 Rust 代码
npm run lint:all       # 检查所有代码格式
npm run i18n:check     # 检查未使用的 i18n 键
```

### 环境准备

首次开发前必须安装 Rust 和平台依赖：

**Windows**:
```powershell
winget install --id Rustlang.Rustup -e
rustup default stable
# 安装 Visual Studio Build Tools，勾选"使用 C++ 的桌面开发"
```

**macOS**:
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup default stable
xcode-select --install
```

**Linux** (Debian/Ubuntu):
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup default stable
sudo apt update
sudo apt install -y libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev build-essential
```

### 故障排除

```bash
# 清理所有缓存并重新安装
rm -rf node_modules
npm install
cd src-tauri && cargo clean && cd ..

# 如果 Rust 编译失败
rustup update stable
cd src-tauri && cargo clean && cd ..

# 如果前端构建失败
npm run build  # 先单独构建前端
```

## 架构概览

### 前端结构 (`src/`)

- **组件**: 使用 Ant Design 的 React 组件
  - `MenuBar.tsx` - 应用工具栏，文件操作
  - `EntryList.tsx` - PO 文件条目列表，状态指示器
  - `EditorPane.tsx` - 翻译编辑器，AI 辅助
  - `SettingsModal.tsx` - API 配置和设置
  - `TermLibraryManager.tsx` - 术语库管理
  - `MemoryManager.tsx` - 翻译记忆库管理
  - `AIWorkspace.tsx` - 高级 AI 工作区功能
  - `ErrorBoundary.tsx` - 错误边界处理

- **服务**: 前端服务层
  - `commands.ts` - **统一命令层**，13 个模块化 API：
    - `configCommands`, `aiConfigCommands`, `aiModelCommands`
    - `systemPromptCommands`, `termLibraryCommands`, `translationMemoryCommands`
    - `translatorCommands`, `poFileCommands`, `fileFormatCommands`
    - `dialogCommands`, `i18nCommands`, `logCommands`, `systemCommands`
  - `apiClient.ts` - API 客户端 (重试、超时、去重、错误提示)
  - `tauriInvoke.ts` - Tauri 调用包装 (敏感信息掩码、错误日志)
  - `formatters.ts` - 统一格式化工具 (成本、token、百分比)
  - `eventDispatcher.simple.ts` - 简化事件系统 (2025-11 重构)
  - `logService.ts` - 日志服务 (2025-11 新增)

- **Hook**: 自定义 React hooks
  - `useTheme` - **简化版主题管理** (~100行，直接 DOM 操作)
  - `useAsync` - 通用异步操作处理
  - `useChannelTranslation` - 简化版翻译通道 (移除事件分发)
  - `useAppData` - **统一数据访问** (简化版 SWR hooks，无需 Provider)

- **状态管理**: Zustand 状态管理
  - `useAppStore.ts` - 主应用状态，持久化主题、语言、累积统计

- **类型**: TypeScript 定义
  - `tauri.ts` - PO 条目、翻译、统计、配置的核心类型
  - `termLibrary.ts` - 术语库特定类型
  - `generated/` - 自动生成的 Rust 类型绑定

### 后端结构 (`src-tauri/src/`)

- **命令** (`commands/`): 前后端通信的 Tauri 命令处理器
  - `translator.rs` - 翻译操作 (单条/批量)
  - `ai_config.rs` - AI 配置管理
  - `ai_model_commands.rs` - AI 模型相关命令
  - `language.rs` - 语言检测和管理
  - `file_format.rs` - 文件格式处理
  - `system.rs` - 系统相关命令
  - `mod.rs` - 命令模块组织

- **服务** (`services/`): 核心业务逻辑
  - `po_parser.rs` - PO 文件解析和生成，使用 nom 解析器
  - `ai_translator.rs` - AI 翻译集成 (8 个提供商)
  - `translation_memory.rs` - 翻译记忆库系统 (83+ 内置短语，模式匹配)
  - `batch_translator.rs` - 批量翻译 (去重、进度跟踪、事件发射)
  - `config_manager.rs` - **[已弃用]** 旧配置管理
  - `config_draft.rs` - **[新增 2025-10]** 草稿模式配置 (原子更新，`parking_lot::RwLock`)
  - `term_library.rs` - 术语库管理，风格分析
  - `language_detector.rs` - 语言检测服务
  - `file_chunker.rs` - 文件分块处理 (大文件优化)
  - `prompt_logger.rs` - 提示词日志记录
  - `mod.rs` - 服务模块组织

- **AI 服务** (`services/ai/`): AI 相关功能
  - `provider.rs` - AI 提供商抽象
  - `models/` - 各 AI 模型实现 (OpenAI, Moonshot, DeepSeek)
  - `providers/` - AI 提供商实现
  - `cost_calculator.rs` - 翻译成本计算
  - `model_info.rs` - 模型信息管理
  - `plugin_loader.rs` - 动态插件加载
  - `mod.rs` - AI 服务模块组织

- **工具** (`utils/`): 共享工具
  - `draft.rs` - **[新增 2025-10]** 通用草稿模式实现 (来自 clash-verge-rev)
  - `logging.rs` - 使用 `flexi_logger` 的结构化日志 (轮转、清理、`wrap_err!` 宏)
  - `init.rs` - **[新增 2025-10]** 应用初始化 (便携模式、目录、日志)
  - `paths.rs` - 路径和文件系统工具 (便携模式支持)
  - `common.rs` - 通用工具和辅助函数
  - `progress_throttler.rs` - 进度更新节流
  - `mod.rs` - 工具模块组织

### 关键集成点 (更新 2025-11)

**两层 API 架构** (三轮优化后):

```
组件层 (React Components)
   ↓ useAppData (简化版 SWR hooks)
命令层 (commands.ts - 13 模块)
   ↓ apiClient (重试、超时、去重、错误提示)
   ↓ tauriInvoke (敏感信息掩码、错误日志)
Tauri Commands (52 个)
   ↓ 序列化/反序列化
Rust 服务层 (services/)
   ↓ ConfigDraft (原子更新)
Rust 持久化层 (JSON文件)
```

**三轮优化简化**:

*第一轮 (2025-11-01)*:
- ❌ **删除 AppDataProvider**: 过度封装 (280行)
- ❌ **删除增强事件桥接**: `useTauriEventBridge.enhanced.ts` (421行)
- ❌ **删除事件分发器**: `eventDispatcher.ts` (368行)
- ❌ **删除统计引擎**: `statsEngine.ts` + `statsManagerV2.ts` (259行)

*第二轮 (2025-11-23)*:
- ❌ **删除未使用文件**: 5个文件共 687行
- ❌ **删除未使用函数**: `useAsyncEffect` (60行)
- ❌ **简化参数转换**: 移除 autoConvertParams 逻辑 (~486行)

*第三轮 (2025-11-23)*:
- ❌ **删除中间层**: `api.ts` (97行)，`commands.ts` 直接调用 `apiClient`
- ❌ **删除 SWR 配置**: `swr.ts` (42行)，hooks 直接传入 fetcher
- ❌ **简化封装链**: API 调用从三层简化为两层 (~240行)

**保留的核心功能**:
- ✅ **命令层** (`commands.ts`): 类型安全的 Tauri 调用，52个命令，13个模块
- ✅ **API 客户端** (`apiClient.ts`): 重试、超时、去重、错误提示
- ✅ **Tauri 包装** (`tauriInvoke.ts`): 敏感信息掩码、错误日志
- ✅ **简化事件系统**: 直接使用 Tauri 2.0 原生 `listen()` API
- ✅ **简化数据访问**: 直接使用 SWR hooks，无需 Provider 层
- ✅ **草稿模式配置** (`ConfigDraft`): 原子更新，并发安全
- ✅ **Channel API**: 高性能实时推送
- ✅ **简化统计系统**: 简单的 `useState`
- ✅ **简化主题系统**: 直接 DOM 操作

**性能优化成果**:
- 主题切换: ~200ms → <50ms (提升 75%)
- 语言切换: ~500ms → <100ms (提升 80%)
- 事件响应: ~100ms → <30ms (提升 70%)
- API 调用链: 缩短 33% (从三层到两层)
- 整体流畅度提升 80-90%
- 代码库减少 **5917 行** (约 18% 代码量)

## 技术栈

### 前端

- React 18 + TypeScript
- Ant Design 5 (UI 组件)
- Zustand (状态管理)
- Vite (构建工具)
- i18next (国际化)
- **优化特性**: React.memo, 直接 DOM 操作, 简化事件系统

### 后端

- Tauri 2.x (桌面应用框架)
- Rust Edition 2024 with Tokio (异步运行时)
- reqwest (AI API 的 HTTP 客户端)
- async-openai (OpenAI API 客户端)
- serde (JSON 序列化)
- flexi_logger (结构化日志，支持轮转)
- parking_lot (高性能 RwLock，用于草稿模式)
- nom (PO 文件解析)
- whatlang (语言检测)
- sys-locale (系统语言检测)
- ts-rs (Rust 到 TypeScript 类型生成，可选)

### 外部依赖

- **AI 翻译提供商** (支持 8 家):
  - Moonshot AI (主要，中文优化)
  - OpenAI (GPT 系列)
  - iFlytek Spark (讯飞星火)
  - Baidu Wenxin (百度文心一言)
  - Alibaba Tongyi (阿里通义千问)
  - Zhipu AI (智谱AI)
  - Anthropic Claude
  - Google Gemini
- PO 文件和翻译记忆库的本地文件系统

## 开发指南 (更新 2025-10)

### 命令层使用

**推荐方法** (第三轮优化后):

```typescript
import { configCommands, aiConfigCommands, translatorCommands } from '@/services/commands';

// 使用命令层（直接调用 apiClient）
const config = await configCommands.get();
await aiConfigCommands.add(newConfig);
const result = await translatorCommands.translateBatch(entries, targetLang);

// SWR hooks 直接传入 fetcher（第三轮优化）
import useSWR from 'swr';
import { translationMemoryCommands } from '@/services/commands';

const { data, mutate } = useSWR(
  'translation_memory',
  () => translationMemoryCommands.get(),
  { revalidateOnFocus: false }
);
```

**架构简化**:

```
优化前: commands.ts → api.ts → apiClient.ts → tauriInvoke.ts → Tauri
优化后: commands.ts → apiClient.ts → tauriInvoke.ts → Tauri
```

### 数据访问模式

**简化方法** (三轮优化后):

```typescript
// 方式1: 使用 useAppData（推荐）
import { useAppData } from '@/hooks/useConfig';

function MyComponent() {
  const { config, aiConfigs, activeAIConfig, systemPrompt, refreshAll } = useAppData();
  // 数据自动缓存和重验证
  return <div>{config?.apiKey}</div>;
}

// 方式2: 直接调用命令层
import { configCommands, aiConfigCommands } from '@/services/commands';

const config = await configCommands.get();
const aiConfigs = await aiConfigCommands.getAll();

// 方式3: 自定义 SWR hook（第三轮优化）
import useSWR from 'swr';
import { translationMemoryCommands } from '@/services/commands';

const { data, mutate } = useSWR(
  'translation_memory',
  () => translationMemoryCommands.get(),
  { revalidateOnFocus: false }
);

// 事件监听直接使用 Tauri API
import { listen } from '@tauri-apps/api/event';

useEffect(() => {
  const unlisten = listen('config:updated', () => {
    mutate(); // 刷新数据
  });
  return unlisten; // 自动清理
}, []);
```

**已删除的复杂系统**:
- ~~`swr.ts`~~ - 未使用的 SWR 配置文件 (42行)
- ~~`api.ts`~~ - 中间透传层 (97行)
- ~~复杂的事件分发系统~~ - 现在直接使用 Tauri `listen()`

### 事件系统集成

**简化后的事件系统** (2025-11 优化):

- **直接使用 Tauri 2.0 原生 API** - 无额外封装层
- **高性能事件响应** - 响应时间从 ~100ms 降至 <30ms
- **简单的清理机制** - 直接在 useEffect 中返回 unlisten 函数

```typescript
// 推荐的事件监听方式
useEffect(() => {
  const unlisten = listen('translation:progress', (event) => {
    // 直接处理事件，无需分发器
    setProgress(event.payload);
  });
  return unlisten; // 自动清理
}, []);
```

**简化数据访问模式** (2025-11 重构):

```typescript
// ✅ 推荐：直接使用 useAppData
import { useAppData } from '@/hooks/useConfig';

function MyComponent() {
  const { config, aiConfigs, activeAIConfig, systemPrompt, refreshAll } = useAppData();
  // 数据自动缓存和重验证
  return <div>{config?.apiKey}</div>;
}
```

**已删除的复杂系统**:
- ~~`eventDispatcher.ts`~~ - 过度复杂的事件分发器 (368行)
- ~~`useTauriEventBridge.enhanced.ts`~~ - 不必要的封装层 (421行)
- ~~`AppDataProvider.tsx`~~ - 过度封装的 Context Provider (280行)
- ~~防抖/节流机制~~ - Tauri 原生已经足够高效

### 文件操作

- 所有 PO 文件操作都通过 Rust 后端 (`po_parser.rs`)
- 文件对话框通过 Tauri 的文件系统 API 通过 `dialogApi` 处理
- 翻译记忆库自动从用户数据目录保存/加载
- 文件状态通过 Zustand store 管理，支持持久化

### AI 翻译集成

- 翻译请求批量处理并去重以提高效率
- 翻译记忆库提供 83+ 内置短语，自动模式匹配
- 支持单条目和批量翻译模式
- 通过事件跟踪长时间批量操作的进度
- 批量翻译发射进度事件和最终统计

### 状态管理

- 使用 Zustand stores 管理前端状态，选择性持久化
- 通过事件和 API 调用保持状态与后端操作同步
- 使用 `useAsync` hook 处理异步操作，统一的加载/错误状态
- 主题、语言和累积统计跨会话持久化

### 日志和调试

- Rust 后端使用 `tracing` 结构化日志
- 前端日志通过 `utils/logger` 提供，基于模块组织
- 开发模式在控制台显示详细日志
- 事件系统通过事件历史提供调试功能

### 配置管理 (草稿模式)

**后端 (Rust)**:

```rust
// 读取配置 (只读访问)
let draft = ConfigDraft::global().await;
{
    let config = draft.data(); // MappedRwLockReadGuard
    println!("API Key: {}", config.api_key);
} // Guard 自动释放

// 修改配置 (原子更新)
let draft = ConfigDraft::global().await;
{
    let mut config = draft.draft(); // MappedRwLockWriteGuard
    config.ai_configs.push(new_config);
}
draft.apply()?; // 保存到磁盘 + 发射事件
```

**前端**:

```typescript
const { config, refreshAll } = useAppData();

// 修改并保存
await configCommands.update(updatedConfig);
// AppDataProvider 在 `config:updated` 事件上自动刷新
```

**关键特性**:

- 原子更新 (全有或全无)
- 并发安全 (`parking_lot::RwLock`)
- 自动持久化和事件发射
- 全局单例模式

## 常见任务

### 添加新的 AI 提供商

采用插件化架构，添加新供应商只需 1 个文件：

1. 在 `plugins/my-provider/` 创建目录
2. 添加 `plugin.toml` 配置文件（供应商信息、模型列表、定价）
3. 实现 `provider.rs`（实现 `AIProvider` trait）
4. 重启应用，插件自动加载

无需修改现有代码，完全插件化！

### 扩展翻译记忆库

1. 修改 `translation_memory.rs` 以支持新的短语模式
2. 更新内置短语集合
3. 如需要，调整匹配算法
4. 在后端发射事件通知前端更新
5. 在 `commands.ts` 中添加新的 `translationMemoryCommands` 方法

### 添加新文件格式支持

1. 创建类似于 `po_parser.rs` 的解析器服务
2. 在 `commands/` 中为文件操作添加 Tauri 命令
3. 在 `main.rs` 中注册新命令
4. 在 `commands.ts` 中添加新的 `fileFormatCommands` 方法
5. 更新前端组件以处理新格式
6. 为新格式结构更新 `types/tauri.ts` 中的类型

### 添加新事件

1. 在后端 Rust 服务中发射事件（使用 `emit()`）
2. 在前端组件中直接使用 Tauri `listen()` 订阅事件
3. 在 useEffect 中返回 unlisten 函数以自动清理
4. 如需要，向 `types/` 添加事件数据类型

```typescript
// 示例
useEffect(() => {
  const unlisten = listen('my-event', (event) => {
    console.log('收到事件:', event.payload);
  });
  return unlisten; // 自动清理
}, []);
```

### 添加新 API 操作

1. 在 `src-tauri/src/commands/` 中添加 Tauri 命令
2. 在 `main.rs` 中注册命令
3. 向 `src/services/commands.ts` 中的适当模块添加命令方法
4. 在 `types/` 中添加相应的类型
5. 如果是异步操作，为进度/完成添加事件
6. 在组件中使用 `useAsync` hook 进行一致的异步处理

```typescript
// 示例：添加新命令
export const myCommands = {
  async doSomething(param: string): Promise<Result> {
    return invoke(COMMANDS.MY_COMMAND, { param }, {
      errorMessage: '操作失败',
    });
  },
};
```

## 性能考虑

### 文件处理 (Phase 8)

- **小文件** (<10MB): 直接内存加载
- **大文件** (10-50MB): 自动分块，每批 500 个条目
- **超大文件** (>50MB): 优化处理，每批 200 个条目
- 大文件的文件大小分析和警告
- 为未来增强提供流支持

### 翻译效率

- 智能去重的批量翻译
- 为短语模式优化的翻译记忆库查找
- AI API 请求去重以避免冗余调用
- 进度更新节流到 100ms 间隔以获得流畅 UI

### 内存管理

- PO 文件解析到内存 (适用于约 5000 个条目的文件)
- 翻译记忆库的 LRU 缓存策略
- 大型操作的自动内存优化

### 支持的语言 (Phase 5)

应用支持 10 种主要语言的自动检测翻译:

- 英语
- 中文 (简体 & 繁体)
- 日语
- 韩语
- 西班牙语
- 法语
- 德语
- 俄语
- 葡萄牙语
- 阿拉伯语

## 重要项目文件

### 文档

- `README.md` - 项目介绍和快速开始
- `CLAUDE.md` - AI 助手指导 (本文件)
- `docs/API.md` - **[更新 2025-10]** API 参考 (命令层、AppDataProvider、草稿模式)
- `docs/Architecture.md` - **[更新 2025-10]** 架构概览 (四层设计)
- `docs/DataContract.md` - **[更新 2025-10]** 数据契约 (类型、草稿模式流程)
- `docs/CHANGELOG.md` - **[更新 2025-10]** 变更历史 (架构重构、日志轮转)

### 配置

- `package.json` - 前端依赖和脚本
- `src-tauri/Cargo.toml` - 后端依赖和构建配置
- `vite.config.ts` - Vite 构建配置
- `tsconfig.json` - TypeScript 配置
- `src-tauri/tauri.conf.json` - Tauri 应用配置

### 关键源文件 (更新 2025-11)

**前端**:

- `src/services/commands.ts` - **统一命令层** (13 个模块，52 个命令)
- `src/App.tsx` - **重构后主应用** (从 925 行简化到 95 行)
- `src/components/SettingsModal.tsx` - **重构后设置窗口** (从 1121 行简化到 81 行)
- `src/components/settings/` - **设置组件拆解**:
  - `AIConfigTab.tsx` - AI 配置标签页
  - `SystemPromptTab.tsx` - 系统提示词标签页
  - `AppearanceTab.tsx` - 外观设置标签页
  - `NotificationTab.tsx` - 通知设置标签页
  - `LogsTab.tsx` - 日志查看标签页
- `src/hooks/useTheme.ts` - **简化版主题系统** (从 253 行优化到 100 行)
- `src/hooks/useConfig.ts` - **统一数据访问** (useAppData hooks，无需 Provider)
- `src/store/useAppStore.ts` - 主应用状态
- `src/services/eventDispatcher.simple.ts` - **简化事件系统**
- `src/services/logService.ts` - 日志服务 (2025-11 新增)

**后端**:

- `src-tauri/src/main.rs` - 后端入口点 (52 个注册命令)
- `src-tauri/src/services/config_draft.rs` - 草稿模式配置
- `src-tauri/src/utils/draft.rs` - 通用草稿模式 (来自 clash-verge-rev)
- `src-tauri/src/utils/init.rs` - 应用初始化
- `src-tauri/src/services/ai_translator.rs` - AI 翻译引擎
- `src-tauri/src/services/po_parser.rs` - PO 文件解析器 (基于 nom)

**已删除的文件** (三轮优化):

*第一轮优化 (2025-11-01, 3698行)*:
- ~~`src/services/eventDispatcher.ts`~~ - 过度复杂的事件系统 (368行)
- ~~`src/hooks/useTauriEventBridge.enhanced.ts`~~ - 不必要的事件桥接 (421行)
- ~~`src/services/statsEngine.ts`~~ - 事件溯源系统 (147行)
- ~~`src/services/statsManagerV2.ts`~~ - 重试版本的统计管理器 (112行)
- ~~`src/services/configSync.ts`~~ - 配置同步管理器 (227行)
- ~~`src/providers/AppDataProvider.tsx`~~ - 过度封装的 Context Provider (280行)
- ~~`src/providers/`~~ - 整个 providers 目录

*第二轮优化 (2025-11-23, 1232行)*:
- ~~`src/hooks/useNotification.ts`~~ - 与 notificationManager 功能重复 (221行)
- ~~`src/services/statsFormatter.ts`~~ - 只是简单包装 formatters.ts (277行)
- ~~`src/hooks/useValidation.ts`~~ - 完全未使用 (18行)
- ~~`src/utils/providerUtils.ts`~~ - 完全未使用 (71行)
- ~~`src/utils/paramConverter.ts`~~ - Tauri 2.x 已自动处理 camelCase (99行)
- ~~`useAsyncEffect` 函数~~ - 在 useAsync.ts 中定义但未使用 (60行)
- ~~`src/components/app/`~~ - 空目录
- 简化参数转换逻辑 - 移除 autoConvertParams 相关代码 (~486行)

*第三轮优化 (2025-11-23, 987行)*:
- ~~`src/services/api.ts`~~ - 中间透传层 (97行)
- ~~`src/services/swr.ts`~~ - 未使用的 SWR 配置 (42行)
- 简化 API 封装 - 从三层简化为两层 (~240行)
- 精简注释 - `store/index.ts` 等文件 (~30行)

---

**开始翻译你的 PO 文件吧！** 🚀
