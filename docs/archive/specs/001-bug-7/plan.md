# Implementation Plan: 关键用户界面和功能问题修复

**Branch**: `001-bug-7` | **Date**: 2025-10-14 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/001-bug-7/spec.md`

## Summary

修复7个关键的用户界面和功能问题，包括3个P1阻塞性问题（AI配置保存失败、系统提示词保存失败、语言检测失败）、2个P2用户体验问题（主题切换响应、外观设置功能）、1个P3改进项（日志管理）。

**技术方法**:

- 前端参数序列化修正（AI配置保存）
- 命令名称和参数格式对齐（系统提示词、语言检测）
- 状态管理优化（主题切换）
- 系统API集成（跟随系统主题、语言切换、打开日志目录）

## Technical Context

**Language/Version**:

- Frontend: TypeScript 5.3 + React 18
- Backend: Rust Edition 2024

**Primary Dependencies**:

- Frontend: Ant Design 5, Zustand (state), SWR (cache)
- Backend: Tauri 2.8, Tokio (async), serde (serialization)

**Storage**: JSON 文件（配置、翻译记忆）+ Tauri Store（用户偏好）

**Testing**:

- Frontend: Vitest (73 tests, 82.8% coverage)
- Backend: cargo test + nextest

**Target Platform**: 跨平台桌面应用（Windows 10+, macOS 10.14+, Linux）

**Project Type**: Desktop (Tauri hybrid architecture - Rust backend + React frontend)

**Performance Goals**:

- 配置保存操作 < 100ms
- 主题切换 < 100ms
- 语言切换 < 1s
- UI 响应时间 < 100ms

**Constraints**:

- 必须保持向后兼容（现有配置文件格式）
- 不能破坏现有翻译流程
- 遵循四层架构分离原则

**Scale/Scope**:

- 7个独立BUG修复
- 涉及3个前端组件（SettingsModal, MenuBar, App）
- 涉及4个后端命令（add_ai_config, update_system_prompt, get_default_target_lang, 待新增的系统API）
- 预计修改 < 20个文件

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

### 核心原则合规性检查

#### ✅ I. 四层架构分离

- **状态**: 符合
- **验证**: 修复限于各层内部，不引入跨层调用
  - 配置保存：修复 `SettingsModal` (组件层) → `commands.ts` (命令层) → Rust 命令
  - 主题切换：修复 `useAppStore` (状态层) 状态同步
  - 无跨层直接访问

#### ✅ II. 测试优先

- **状态**: 符合
- **计划**:
  1. 为每个BUG编写失败的回归测试
  2. 修复代码使测试通过
  3. 添加边界测试（特殊字符、并发、网络错误等）
- **测试覆盖**: 前端集成测试 + 后端单元测试

#### ✅ III. 统一错误处理

- **状态**: 符合（关键改进点）
- **计划**:
  - 所有配置保存失败显示具体错误（如"缺少API密钥"而非"保存失败"）
  - 后端错误使用 `anyhow::Result` 统一格式
  - 前端通过 `commands.ts` 统一处理错误消息

#### ✅ IV. 无遗留代码

- **状态**: 符合
- **计划**:
  - 删除旧的 `api.ts` 调用（如果存在），统一使用 `commands.ts`
  - 删除调试用的 console.log
  - 删除未使用的导入

#### ✅ V. 单一职责原则

- **状态**: 符合
- **验证**: 每个修复针对单一问题，不引入额外功能

#### ✅ VI. 类型安全优先

- **状态**: 符合
- **计划**:
  - 确保前后端类型一致（`AIConfig` 等）
  - 使用 TypeScript 严格模式捕获参数错误
  - Rust 通过 Clippy 检查

#### ✅ VII. 小步提交

- **状态**: 符合
- **计划**: 每个BUG修复单独提交（7个独立commit）

#### ✅ VIII. 文档简洁

- **状态**: 符合
- **计划**: 完成后仅更新 CHANGELOG.md，不创建额外文档

### 架构约束检查

#### ✅ 技术栈锁定

- **状态**: 符合
- **验证**: 不引入新依赖，仅修复现有代码

#### ✅ 性能标准

- **状态**: 符合
- **目标**: 所有操作响应时间 < 100ms（符合标准）

### 结论

**✅ 通过所有 Constitution 检查，可以进入 Phase 0 研究阶段**

## Project Structure

### Documentation (this feature)

```
specs/001-bug-7/
├── spec.md              # 功能规范
├── plan.md              # 本文件（实施计划）
├── research.md          # Phase 0: 技术研究
├── data-model.md        # Phase 1: 数据模型（配置结构）
├── contracts/           # Phase 1: API 契约
│   ├── commands.md      # Tauri 命令接口
│   └── events.md        # 事件定义
├── quickstart.md        # Phase 1: 快速验证指南
├── checklists/          # 质量检查清单
│   └── requirements.md  # 已完成
└── tasks.md             # Phase 2: 详细任务列表（待创建）
```

### Source Code (repository root)

```
ai-l10n-studio/
├── src/                           # 前端代码
│   ├── components/
│   │   ├── SettingsModal.tsx      # 🔧 AI配置、系统提示词、外观设置修复
│   │   ├── MenuBar.tsx            # 🔧 主题切换修复
│   │   └── ThemeModeSwitch.tsx    # 🔧 主题切换组件
│   ├── hooks/
│   │   └── useTheme.ts            # 🔧 主题管理逻辑
│   ├── store/
│   │   └── useAppStore.ts         # 🔧 主题状态管理
│   ├── services/
│   │   ├── commands.ts            # 🔧 命令层（确保参数正确）
│   │   └── api.ts                 # 检查是否有遗留调用
│   ├── i18n/
│   │   └── config.ts              # 🔧 语言切换逻辑
│   └── App.tsx                    # 🔧 语言检测修复
│
├── src-tauri/                     # 后端代码
│   ├── src/
│   │   ├── commands/
│   │   │   ├── config.rs          # 🔧 AI配置命令
│   │   │   ├── system_prompt.rs   # 🔧 系统提示词命令
│   │   │   ├── language.rs        # 🔧 语言检测命令
│   │   │   └── system.rs          # 🆕 系统API（打开目录等）
│   │   ├── services/
│   │   │   └── config_draft.rs    # 🔧 配置持久化
│   │   └── main.rs                # 检查命令注册
│   └── Cargo.toml
│
└── __tests__/                     # 🆕 回归测试
    ├── bug-fixes/
    │   ├── ai-config-save.test.tsx
    │   ├── system-prompt-save.test.tsx
    │   ├── language-detect.test.tsx
    │   ├── theme-toggle.test.tsx
    │   ├── appearance-settings.test.tsx
    │   └── log-directory.test.tsx
    └── integration/
        └── settings-workflow.test.tsx
```

**Structure Decision**:

- 采用现有的 **Desktop (Tauri)** 混合架构
- 前端：`src/` 目录，React 组件 + TypeScript
- 后端：`src-tauri/src/` 目录，Rust services + commands
- 测试：前端测试在 `src/__tests__/`，后端测试在 `src-tauri/src/` 内联
- 不引入新的目录结构，遵循现有约定

### 关键文件修复清单

| 优先级 | 问题           | 涉及文件                                                                                               | 修改类型                                              |
| ------ | -------------- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------- |
| P1     | AI配置保存     | `src/components/SettingsModal.tsx`<br>`src/services/commands.ts`<br>`src-tauri/src/commands/config.rs` | 参数序列化修正<br>字段验证                            |
| P1     | 系统提示词保存 | `src/components/SettingsModal.tsx`<br>`src/services/commands.ts`                                       | 命令名称修正<br>`update_system_prompt` 调用           |
| P1     | 语言检测失败   | `src/App.tsx`<br>`src/services/commands.ts`<br>`src-tauri/src/commands/language.rs`                    | 参数命名对齐<br>`sourceLangCode` → `source_lang_code` |
| P2     | 主题切换       | `src/components/ThemeModeSwitch.tsx`<br>`src/store/useAppStore.ts`                                     | 状态同步修正                                          |
| P2     | 跟随系统主题   | `src/hooks/useTheme.ts`                                                                                | 系统主题监听                                          |
| P2     | 语言切换       | `src/components/SettingsModal.tsx`<br>`src/i18n/config.ts`                                             | i18n 强制刷新                                         |
| P3     | 日志目录按钮   | `src/components/SettingsModal.tsx`<br>`src-tauri/src/commands/system.rs`                               | UI 添加按钮<br>新增 Tauri 命令                        |

## Complexity Tracking

_本次修复无 Constitution 违规，无需记录复杂度豁免。_

所有修复均符合：

- 四层架构分离
- 现有技术栈
- 性能标准
- 单一职责原则

---

## 下一步

1. ✅ **Phase 0**: 执行技术研究（`research.md`）
2. ⏳ **Phase 1**: 生成数据模型和 API 契约
3. ⏳ **Phase 2**: 创建详细任务列表（`/speckit.tasks`）
4. ⏳ **实施**: 按任务列表逐个修复并测试
