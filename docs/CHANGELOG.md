# 更新日志

## 2025-01-12 - 前后端联动架构优化

### 迁移进度
- ✅ Phase 1.1: 配置 Hook 迁移 (useConfig.ts) + 编译修复
  - 迁移 4 个 API 调用到 commands
  - 修复后端 config_draft.rs 编译错误
  - 前后端编译验证通过
- ⏳ Phase 1.2-1.5: 前端组件迁移中...
- ⏸️ Phase 2: 后端 Draft 配置管理（待前端完成）

### 新增
- **统一命令层** `src/services/commands.ts`
  - 集中管理 73 个 Tauri 命令常量，避免字符串硬编码
  - 类型安全的命令调用封装（11 个模块化 API 组）
  - 完整 TypeScript 类型标注，统一错误处理
- **Draft 配置管理模式** `src-tauri/src/utils/draft.rs`
  - 原子性配置更新（要么全部成功，要么全部回滚）
  - 草稿机制：修改在草稿上进行，确认后提交生效
  - 并发安全（RwLock + parking_lot）
  - `ConfigDraft` 管理器：自动保存和事件通知
- **增强版事件监听器** `src/hooks/useTauriEventBridge.enhanced.ts`
  - 防抖和节流策略（避免 500ms 内重复触发）
  - 定时器自动管理（防止内存泄漏）
  - 事件回退机制（Tauri 失败时使用 window 事件）
  - 预定义常用事件配置（config/term/file/translation）
- **AppDataProvider 统一数据提供者** `src/providers/`
  - 集中管理 6 类核心数据（config/AI/prompt/term/memory）
  - `refreshAll()` 一键刷新所有数据
  - 自动事件监听和 SWR 缓存同步
  - 全局加载状态和错误管理

### 优化
- **前端架构**：引入 Context Provider 模式，组件通过 `useAppData()` 统一访问数据
- **命令调用**：从分散的 API 调用改为集中的命令层，便于维护和重构
- **配置更新流程**：draft → modify → apply → save → emit_event 原子化流程
- **事件处理**：节流间隔可配置（默认 500ms），延迟执行支持（避免竞态）

### 技术升级
- 新增依赖：
  - Rust: `parking_lot = "0.12"` - 高性能 RwLock
- 架构模式：
  - 前端：Command Layer + Context Provider + Enhanced Event Bridge
  - 后端：Draft Pattern + Event Emission + Atomic Updates

### 重构影响
- ✅ 解决"后端新实现 → 前端对照修改"痛点：通过 `refreshAll()` 批量同步
- ✅ 降低维护成本：命令集中定义，修改只需一处
- ✅ 提升代码质量：类型安全 + 防抖节流 + 自动 cleanup
- ✅ 增强可测试性：Draft 模式支持事务式测试
- ✅ 清理技术债：删除旧版本 `useTauriEventBridge.ts`，避免新老实现并存

---

## 2025-01-12 - 工程化增强

### 新增
- **便携模式支持**：创建 `.config/PORTABLE` 文件即可启用，所有数据存储在程序目录
- **主题系统增强**：支持 浅色/深色/跟随系统 三种模式，实时监听系统主题变化
- **系统语言检测**：首次启动自动适配系统语言（Rust 后端 API）
- **工程化日志系统**：flexi_logger + 结构化日志宏，支持自动轮转和清理
- **开发工具脚本**：
  - `npm run i18n:check` - 自动检测并清理未使用的 i18n 键
  - `npm run tauri:portable` - Windows 便携版一键打包

### 优化
- **统一路径管理**：`src-tauri/src/utils/paths.rs` 统一所有文件路径获取
- **配置扩展**：新增 `theme_mode`, `language`, `log_retention_days` 字段
- **应用初始化流程**：便携模式检测 → 目录创建 → 日志初始化 → 配置加载
- **代码质量保障**：启用 36 条 Clippy Lints 规则（禁止 panic/unwrap，强制异步最佳实践）

### 技术升级
- **Rust Edition 2024**：最新语法支持（let chains 等）
- **新增依赖**：
  - Rust: `once_cell`, `flexi_logger`, `log`, `dunce`
  - Node.js: `adm-zip`

### 文档
- 新增 `scripts/README.md` - 开发工具使用说明
- 更新 `CLAUDE.md` - Phase 9 工程化增强完成标记

---

## 2025-01-11

### 新增
- 统一格式化工具模块 `src/utils/formatters.ts`
  - `formatCost()` - 成本显示（美元格式）
  - `formatCostByLocale()` - 🆕 多语言货币支持（中文显示人民币，其他显示美元）
  - `formatTokens()`, `formatPercentage()`, `formatDuration()` 等
- **统计格式化器** `src/services/statsFormatter.ts`
  - 整合统计系统 V2（Event Sourcing）和格式化工具
  - 提供 ready-to-display 数据（`FormattedStatsSummary`）
  - 支持多种视图：完整版、简洁版、调试版、多语言成本
- 设置页预设模型选择器（显示模型定价和参数）

### 优化
- 供应商配置统一管理（从 `PROVIDER_INFO_MAP` 动态生成，减少48行重复代码）
- 成本显示格式统一为美元（`$0.0023` 小金额4位小数，`$12.35` 大金额2位小数）
- AIWorkspace 统计面板应用统一格式化函数（6处）
- **StatsEngine 集成格式化器**：新增 `getFormattedSessionStats()` 和增强调试信息
- 累计统计区排版优化：「总计翻译-AI调用 / 记忆命中-去重命中」

### 修复
- 修正本次会话统计百分比计算逻辑：使用实际处理条目数（tm_hits + deduplicated + ai_translated）作为分母，而非文件总条目数
- API 参数名错误：`providerType` → `provider`（影响4个 AI 模型 API）

### 文档
- 更新 `docs/API.md` 统一格式化工具说明

