# Documentation Index

**Last Updated**: 2026-05-04

## Core Docs

| File | Purpose |
|---|---|
| `Architecture.md` | 当前架构、技术栈、分层摘要 + 历史重构脉络 |
| `API.md` | Tauri IPC commands、前端 hooks、Zustand stores 的当前契约 |
| `DataContract.md` | 前后端共享数据类型、IPC 规则、持久化分层 |
| `THEME.md` | Catppuccin 主题配置、palette 结构、Antd 集成 |
| `COLOR_SYSTEM.md` | CSS token 清单、SSOT 原则、对比度验收 |
| `SECURITY_NOTES.md` | 当前密钥存储策略（公开配置 + secrets 拆分） |
| `ERRORS.md` | 历史错误排查目录（活文档，解新问题时追加） |

## Recommended Reading Order

新人入项目：

1. `Architecture.md` - 理解宏观结构
2. `API.md` - 前后端调用约定
3. `DataContract.md` - 数据类型契约
4. `SECURITY_NOTES.md` - 密钥边界

做 UI 改动：

1. `COLOR_SYSTEM.md` - token 系统
2. `THEME.md` - 主题集成
3. 根 `AGENTS.md` + `src/AGENTS.md` - 开发规约

## Conventions

- **Runtime config**: 优先 `ConfigDraft`；`ConfigManager` 仅保留导入/导出与兼容
- **Type SSOT**: Rust 类型先定义，TypeScript 通过 `ts-rs` 生成或手动对齐
- **Design token SSOT**: `src/index.css`（禁止在 `App.css` 或组件 CSS 模块重复定义）
- **i18n**: 所有用户可见字符串必须走 `t()`
- **无 emoji**: 所有项目文件（代码、注释、文档）

## Archived Reports

历史阶段的工作总结与已解决问题的详细记录，不作为当前架构参考：

**历史演进脉络**：

- `architecture-history.md` - 2025-11 重构（-5917 行）、2026-01 质量优化、Phase 10 虚拟滚动等完整历程（从 `Architecture.md` 切出）
- `errors-history.md` - 2025-10 架构重构编译错误、2025-12 Phase 10 CI 质量、2026-01 日志系统 / Rust 错误统一 等已修复问题的诊断过程（从 `ERRORS.md` 切出）

**一次性完成报告**：

- `2025-12-16-performance-phase10.md` - 虚拟滚动升级 + 事件节流
- `2026-01-27-full-simplification.md` - 68 文件代码简化
- `2026-03-22-review-final.md` - 乱码修复审查
- `type-unification-spec.md` - 早期类型统一规范（已被 `DataContract.md` 覆盖）
- `code-simplifier-agent-prompt.md` - agent prompt 定义，非项目文档

**更早的历史材料**：

- `ARCHITECTURE_OVERVIEW.md`、`API_REFERENCE_V2.md`、`专业翻译提示词.md`、`gui/`

## 项目外部文档

- 根 `README.md` - 用户入门、环境依赖、基本使用
- 根 `CHANGELOG.md` - 版本更新历史（持续滚动）
- 根 `AGENTS.md` - 项目根知识库（agent 和新人的快速索引）
- `src/AGENTS.md` - 前端专属知识库
