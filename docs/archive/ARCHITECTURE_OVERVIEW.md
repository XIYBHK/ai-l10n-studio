# 架构概览

> 简版摘要：
> - 分层：UI → 状态 → 服务 → 命令 → 业务 → 外部（AI/FS/Store）。
> - 通信：Tauri Commands + 事件系统（`eventDispatcher` + Bridge）。
> - 关键路径：PO 解析 → TM/去重 → AI 翻译 → TM 更新 → 进度事件。
> - 质量：Vitest + cargo test；性能优化含批量、去重、节流。

**PO Translator GUI** - Professional Translation Workflow Tool

---

## 🏗️ 系统架构

```
┌─────────────────────────────────────────────────────────────────┐
│                         用户界面层 (UI)                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │ MenuBar  │  │EntryList │  │EditorPane│  │ Settings │       │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘       │
│       │             │              │             │              │
└───────┼─────────────┼──────────────┼─────────────┼──────────────┘
        │             │              │             │
┌───────┼─────────────┼──────────────┼─────────────┼──────────────┐
│       │     状态管理层 (State Management)       │              │
│       │             │              │             │              │
│  ┌────▼─────┐  ┌───▼──────┐  ┌───▼──────┐  ┌──▼───────┐      │
│  │ Session  │  │ Settings │  │  Stats   │  │ Events   │      │
│  │  Store   │  │  Store   │  │  Store   │  │Dispatcher│      │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘      │
│       │             │              │             │              │
└───────┼─────────────┼──────────────┼─────────────┼──────────────┘
        │             │              │             │
┌───────┼─────────────┼──────────────┼─────────────┼──────────────┐
│       │         服务层 (Services)                │              │
│       │             │              │             │              │
│  ┌────▼─────────────▼──────────────▼─────────────▼─────┐       │
│  │              API Layer (api.ts)                      │       │
│  │  13 个 API 模块 + 统一错误处理 + 请求管理           │       │
│  │  （含 Channel API Hook：useChannelTranslation）     │       │
│  └────┬─────────────────────────────────────────────────┘       │
│       │                                                          │
└───────┼──────────────────────────────────────────────────────────┘
        │
        │ Tauri IPC
        ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Tauri Bridge (命令层)                        │
│  52 个注册命令 + 事件发射 + 参数验证                             │
└───────┬─────────────────────────────────────────────────────────┘
        │
┌───────▼─────────────────────────────────────────────────────────┐
│                   业务逻辑层 (Business Logic)                    │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │   翻译   │  │ 术语库   │  │ 记忆库   │  │ 配置管理 │       │
│  │ Translator│ │TermLib   │  │   TM     │  │  Config  │       │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │ PO Parser│  │ 语言检测 │  │ 文件格式 │  │ 日志系统 │       │
│  │          │  │          │  │          │  │          │       │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘       │
└───────┬─────────────────────────────────────────────────────────┘
        │
┌───────▼─────────────────────────────────────────────────────────┐
│                     外部服务 & 存储                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │ AI APIs  │  │文件系统  │  │Tauri Store │ │ 系统API  │       │
│  │ (8 个)   │  │  (PO)    │  │(持久化)    │  │(通知等)  │       │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘       │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📦 核心模块

### 前端 (TypeScript + React)

#### 1. 组件层
```
src/components/
├── MenuBar.tsx          # 顶部菜单栏
├── EntryList.tsx        # 条目列表（支持虚拟滚动）
├── EditorPane.tsx       # 编辑器面板
├── SettingsModal.tsx    # 设置对话框
├── AIWorkspace.tsx      # AI 工作空间
├── TermLibraryManager.tsx   # 术语库管理
├── MemoryManager.tsx    # 翻译记忆管理
└── ErrorBoundary.tsx    # 错误边界
```

#### 2. 状态管理
```
src/store/
├── useSessionStore.ts   # 会话状态（瞬态）
├── useSettingsStore.ts  # 用户设置（持久化）
├── useStatsStore.ts     # 累计统计（持久化）
└── index.ts             # 统一导出
```

#### 3. 服务层
```
src/services/
├── api.ts               # 统一 API 封装（13 模块，含 Channel API）
├── apiClient.ts         # 增强的 API 客户端
├── eventDispatcher.ts   # 事件分发器
└── configSync.ts        # 配置同步管理
```

#### 4. 类型定义
```
src/types/
├── tauri.ts             # 手写类型定义
├── termLibrary.ts       # 术语库类型
└── generated/           # ts-rs 自动生成（16个）
    ├── AIConfig.ts
    ├── POEntry.ts
    └── ...
```

---

### 后端 (Rust + Tauri)

#### 1. 命令层
```
src-tauri/src/commands/
├── translator.rs        # 翻译命令（7个）
├── ai_config.rs         # AI配置命令（7个）
├── config_sync.rs       # 配置同步命令（1个）
├── prompt_log.rs        # 提示词日志命令（2个）
└── mod.rs               # 模块组织
```

#### 2. 服务层
```
src-tauri/src/services/
├── ai_translator.rs     # AI 翻译引擎（含 Channel 支持）
├── batch_translator.rs  # 批量翻译
├── translation_memory.rs # 翻译记忆（83+短语）
├── term_library.rs      # 术语库
├── config_manager.rs    # 配置管理
├── po_parser.rs         # PO 文件解析
├── language_detector.rs # 语言检测
├── prompt_logger.rs     # 提示词日志
└── mod.rs               # 模块组织
```

#### 3. 工具层
```
src-tauri/src/utils/
├── logger.rs            # 日志系统
├── common.rs            # 通用工具
├── paths.rs             # 路径处理
└── mod.rs               # 模块组织
```

---

## 🔄 数据流

### 翻译流程（含 Channel）

```
用户点击翻译
    ↓
前端组件触发
    ↓
调用 translatorApi.translateBatch() / useChannelTranslation.translateBatch()
    ↓
API 层: invoke('translate_batch', { texts })
或 Channel: invoke('translate_batch_with_channel', { texts, progressChannel, statsChannel })
    ↓
Tauri Bridge: 路由到后端命令
    ↓
translate_batch 命令处理
    ↓
1. 获取活跃的 AI 配置
2. 查询翻译记忆库 (TM)
3. 去重处理
4. 调用 AI 翻译器
5. 更新翻译记忆
6. 发射进度事件 / 通过 Channel 推送进度
    ↓
返回翻译结果 + 统计
    ↓
API 层: 处理响应
    ↓
更新 Session Store
    ↓
UI 自动刷新
```

### 事件流

```
后端事件发生
    ↓
emit_event('translation:progress', data)
    ↓
Tauri 事件桥接
    ↓
前端 eventDispatcher.emit()
    ↓
所有订阅者收到通知
    ↓
组件更新 UI
```

---

## 🎨 设计模式

### 1. 分层架构
- **UI 层**: 纯展示，不含业务逻辑
- **状态层**: 统一状态管理
- **服务层**: API 封装和业务逻辑
- **命令层**: Tauri 桥接
- **业务层**: 核心算法和处理

### 2. 事件驱动
- 松耦合的组件通信
- 类型安全的事件系统
- 支持历史回溯和调试

### 3. 单一职责
- 每个模块职责明确
- API 按功能分组
- Store 按生命周期分离

### 4. 依赖注入
- 通过 Props 传递依赖
- 通过 Context 共享全局状态
- 通过 Hooks 封装逻辑

---

## 🔐 安全性

### 前端
- ✅ API Key 不存储在前端状态
- ✅ 敏感数据由后端管理
- ✅ XSS 防护（React 自动转义）

### 后端
- ✅ API Key 加密存储
- ✅ 命令参数验证
- ✅ 文件路径沙箱化
- ✅ 网络请求超时控制

---

## ⚡ 性能优化

### 已实施
- ✅ 虚拟滚动（>500 条目）
- ✅ 请求去重
- ✅ 批量处理
- ✅ 翻译记忆缓存
- ✅ 进度节流（100ms）
- ✅ 懒加载组件

### 待优化
- ⏳ Web Worker（CPU 密集任务）
- ⏳ IndexedDB（大数据存储）
- ⏳ 流式处理（超大文件）

---

## 🧪 测试策略

### 自动化测试
- **单元测试**: 73 个（46 后端 + 27 前端）
- **集成测试**: 覆盖核心流程
- **类型检查**: TypeScript + ts-rs

### 手动测试
- **功能测试**: 每个 Phase 完成后
- **性能测试**: 大文件场景
- **兼容性测试**: 多平台验证

---

## 📊 技术栈总览

| 层级 | 技术 | 版本 | 用途 |
|------|------|------|------|
| **前端框架** | React | 18 | UI 构建 |
| **UI 组件** | Ant Design | 5 | 组件库 |
| **状态管理** | Zustand | - | 状态管理 |
| **构建工具** | Vite | - | 打包构建 |
| **国际化** | i18next | - | 多语言 |
| **后端框架** | Tauri | 2.x | 桌面应用 |
| **后端语言** | Rust | - | 系统编程 |
| **异步运行时** | Tokio | - | 异步处理 |
| **HTTP 客户端** | reqwest | 0.12 | AI API 调用 |
| **解析器** | nom | 7.0 | PO 文件解析 |
| **日志** | tracing | - | 结构化日志 |
| **类型生成** | ts-rs | 7.1 | Rust↔TS 类型同步 |

---

## 📈 项目指标

### 代码规模
- **前端**: ~15,000 行 TypeScript
- **后端**: ~8,000 行 Rust
- **测试**: ~3,000 行
- **文档**: ~5,000 行

### 功能完成度
- **8/8 Phases**: 100% 完成
- **52 Commands**: 全部实现
- **13 API Modules**: 全部封装
- **16 Type Definitions**: 自动生成

### 质量指标
- **测试通过率**: 100%
- **代码覆盖率**: 82.8%
- **构建成功率**: 100%
- **编译时间**: ~27s (前端) + ~27s (后端)

---

## 🎯 设计原则

1. **简单优于复杂** - 能用简单方案就不用复杂方案
2. **显式优于隐式** - 明确的 API 胜过魔法
3. **安全优于速度** - 类型安全和错误处理优先
4. **文档优于记忆** - 完善的文档降低学习成本
5. **测试优于调试** - 自动化测试胜过手动验证

---

## 📚 文档索引

| 文档 | 用途 | 受众 |
|------|------|------|
| `README.md` | 项目介绍 | 所有人 |
| `CLAUDE.md` | 开发指南 | 开发者 |
| `API_REFERENCE.md` | 完整 API 参考 | 开发者 |
| `QUICK_API_REFERENCE.md` | 快速参考 | 开发者 |
| `ARCHITECTURE_OVERVIEW.md` | 架构概览（本文档） | 架构师 |
| `ARCHITECTURE_IMPROVEMENTS.md` | 改进计划 | 维护者 |
| `STORE_MIGRATION_GUIDE.md` | Store 迁移 | 开发者 |
| `TYPE_GENERATION.md` | 类型生成 | 开发者 |
| `PERFORMANCE_UPGRADE.md` | 性能优化 | 开发者 |
| `CONFIG_SYNC_ARCHITECTURE.md` | 配置同步 | 架构师 |

---

**最后更新**: 2025-10-08  
**架构版本**: Phase 8 (Production Ready)

