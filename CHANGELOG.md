# 更新日志

## [未发布]

### 依赖升级与平台修复（2026-05-04）

**基础设施**:

- 修复 Windows 大小写冲突：重命名 `src/components/aiWorkspace/` → `aiWorkspaceSections/`、`entryList/` → `entryListParts/`，避免 macOS/Linux 大小写敏感文件系统与 Windows 不敏感文件系统之间的 casing 冲突（PR #65）

**依赖升级**（18 个 dependabot PR 合并）:

- 前端：`react-i18next` 16 → 17、`i18next` 25.8 → 26.2（PR #64）；`antd` 6.2.1 → 6.3.7、`swr` 2.3.8 → 2.4.1、`zustand` 5.0.10 → 5.0.11、`react-dom` 19.2.3 → 19.2.5、`@types/node` 25.0.10 → 25.6.0、`@tauri-apps/plugin-fs` 2.4.4 → 2.4.5、`@tauri-apps/plugin-store` 2.4.1 → 2.4.2、`prettier` 3.6.2 → 3.8.3
- 后端 (cargo)：`reqwest` 0.12 → 0.13、`ts-rs` 7.1 → 12.0、`thiserror` 1.0 → 2.0、`toml` 0.8 → 1.1、`console-subscriber` 0.4 → 0.5
- CI (GitHub Actions)：`actions/cache` 4 → 5、`actions/upload-artifact` 4 → 7、`softprops/action-gh-release` 2 → 3

**P0 健壮性**:

- 修复 `BatchTranslator::new` 静默降级：将 `custom_prompt` 改为依赖注入，消除构造期内部 `ConfigDraft::new(None)` 的隐式回退读取；调用方显式决定 prompt 来源
- 修正 `AGENTS.md` 过时数字：命令总数 39 → 56（实际 handler 计数对齐）

### 前端设计审查修复（2026-05-04）

**P0 健壮性**:

- 修复 `useTranslationFlow` 稳定闭包缺陷：解构 `useChannelTranslation` 返回值，避免 `cancelTranslation` 每次渲染重建
- 修复 `useTranslationMemory` / `useTermLibrary` 异步监听器竞态：加 `isActive` flag 防止卸载后 `mutate` 和泄漏
- 迁移 **60+ 处硬编码中文消息**到 i18n（`messages` / `errors` / `errorBoundary` / `app` 四个新命名空间），覆盖 11 个文件
- `ErrorBoundary`（class component）用 `i18n.t()` 静态访问

**P1 债务**:

- 补 4 个真正 icon-only 按钮 `aria-label`（`TermLibraryManager` / `AIConfigTab` 的 edit/delete）
- `AppShell` 加 `<h1 className="sr-only">` 提供 a11y 标题
- 抽出 `useTermDetection` hook：`EditorPane` 331→220 LOC，术语检测逻辑出 UI
- `MenuBar` 去 prop drilling：14→9 props，theme 用 `useTheme`、source/target language 下沉到 `useTranslationStore`
- `AIWorkspace` 拆分：710→178 LOC，子组件移到 `components/aiWorkspace/`（StatCard / TokenCard / CostBreakdown / CacheInfo / EfficiencyTip / SessionStatsSection / CumulativeStatsSection / TermLibrarySection）
- `EntryList` 拆分：799→417 LOC，抽出 `useEntrySelection` hook（97 LOC）+ `VirtualizedColumn`（288 LOC）+ `BatchActions`（77 LOC）到 `components/entryList/`

**P2 打磨**:

- DevToolsModal/DevToolsPage UI 标签 i18n：新增 `devTools` 命名空间（17 key），25 处 UI 文字迁移
- EmptyState 完整 i18n：空状态配置和默认快捷键从常量改为运行时 `t()` 构建，`emptyState` 命名空间
- `FocusTrap` 工具类加导引注释：Antd Modal 已内置焦点陷阱，禁止叠加
- React 19 性能优化：MemoryManager 搜索用 `useDeferredValue` + `useMemo`；`useTranslationFlow` 大文件加载用 `startTransition`
- `EntryList` 进一步拆分：417→251 LOC，抽 `StatusColumns`（170 LOC，封装三栏分组和渲染）

**视觉审美修复**:

- 合并设计 token 冲突：`index.css` 成为唯一 SSOT，删除 `App.css` 中冲突的 radius / shadow / duration 定义（避免同名 token 两套值）
- `App.css` 大瘦身：444→150 行（-66%），删除重复 `fadeIn`、未用的 `slideInUp`/`menu-bar-stagger`/`.animate-*`/`.hover-lift`/`.gpu-accelerated` 等 dead CSS，以及 9 处 emoji 注释
- 状态色系统统一：`待确认` 从 Catppuccin Blue 改为 Peach `#fab387`，符合"需关注"语义（原蓝色与"正常"语义冲突）；`palette.accent` 与 `palette.needsReview` 解耦
- 新增警示色 token：`--color-warning`、`--color-warningBg`、`--color-error`、`--color-errorBg`、`--color-flashGlow`（Catppuccin 一致）
- `unsavedBadge` 改 warning peach + 深色文字：紫色（"新特性"语义）→ 琥珀（"未保存警告"语义），对比度从 1.2:1 提升到 ~9:1
- `StatCard` 新增 `size="large"`：`CumulativeStatsSection` 将 `总计翻译` 作为主指标独占一行 + 品牌色 + 28px bold 字号
- 替换全部硬编码色值：`ActionButton.danger`、`EntryList` highlight-flash、`ErrorBoundary`、`InfoCard`、`AppShell` initError 横幅均改用 token（Catppuccin 统一）
- `AppShell` initError 横幅升级：加 `role="alert"`、语义 token、精致按钮样式

### 新增 - 翻译流程渐进式上屏机制（2026-02-03）

**优化目标**: 避免大量翻译结果瞬间上屏导致界面卡顿和统计区跳变

**核心实现**:

- 新增渐进式上屏队列机制，自适应间隔处理翻译结果
- TM 命中和 AI 翻译都通过队列处理，实现平滑更新
- 增量统计自动分配，每次上屏都刷新 AI 工作区数据
- 切换文件或取消翻译时自动清空队列
- 条目上屏时高亮闪烁动画，视觉反馈清晰

**自适应间隔优化**:

- 队列 > 100 条：50ms/条（快速处理大批量）
- 队列 50-100 条：100ms/条（中速）
- 队列 20-50 条：200ms/条（适中）
- 队列 < 20 条：300ms/条（慢速，便于观察）
- 性能提升：100 条翻译从 33 秒 → 5 秒（提升 85%）

**微动效设计**:

- 500ms 蓝色高亮闪烁动画
- 轻微右移 4px + 微缩放效果
- 蓝色辉光阴影（Material Design 风格）
- GPU 加速（transform + opacity），60fps 流畅

**技术细节**:

- 新增 `TranslationQueueItem` 类型定义（src/types/tauri.ts）
- 在 `useTranslationFlow.ts` 中实现队列消费器和入队逻辑
- 修改 `onItem` 回调为入队模式，移除立即更新逻辑
- 修改 `onStats` 回调自动计算增量统计并分配到队列项
- 新增 CSS 动画关键帧（src/components/EntryList.module.css）
- POEntry 新增 `justUpdated` 字段用于动画触发

**用户体验改进**:

- TM 命中 100 条：5 秒渐进式上屏（vs 之前瞬间完成）
- AI 翻译 25 条/批：约 5-7.5 秒渐进式上屏
- 统计数据平滑更新，无跳变
- 每个条目更新都有明确的视觉反馈
- 手动修改检测、术语库添加、风格提示词生成机制保持完整

**受影响文件**:

- `src/types/tauri.ts`: 新增队列项类型和 justUpdated 字段
- `src/hooks/useTranslationFlow.ts`: 实现队列机制和自适应间隔（+100 行）
- `src/components/EntryList.module.css`: 新增高亮闪烁动画

### 新增 - 前后端类型统一规范文档（2026-02-03）

**优化目标**: 建立前后端类型一致性最佳实践，避免类型不匹配问题

**核心内容**:

- 单一事实来源原则（Rust 定义 → ts-rs 生成 → TypeScript 导入）
- 统一命名规范（snake_case，符合 Rust + JSON 标准）
- 完整工作流程（定义、生成、导入、检查）
- 禁止行为清单（手动重复定义、手动转换字段、使用 any）
- 前端扩展字段规范（使用接口继承）
- CI/本地类型检查脚本
- 常见问题解答（Option<T>、字段重命名、嵌套类型）

**检查结果**:

- ✅ 项目已正确使用 ts-rs 自动同步类型
- ✅ 无手动类型转换代码
- ✅ 前后端字段命名已统一（snake_case）

**受影响文件**:

- `docs/前后端类型统一规范.md`: 新增规范文档（完整指南）

## [未发布历史]

### 优化 - 整体代码简化（2026-01-27 第二轮）

**优化范围**: 整个项目全面审查，前端 + 后端，共 68 个文件

**优化原则**: 基于 `docs/代码简化.md`，遵循以下核心原则：

1. 保持功能不变
2. 应用项目标准（CLAUDE.md）
3. 增强清晰度
4. 保持平衡

**优化统计**:

- 代码行数减少约 752 行（4.9%）
- 优化文件数：68 个
- 应用优化：330+ 处
- 提取公共逻辑：10+ 处
- 消除重复代码：多处

**主要优化内容**:

#### 前端优化（44 个文件）

1. **React/TypeScript 组件**（9 个文件）
   - 移除 `React.FC`，改用 function 关键字
   - 箭头函数改为普通函数（20+ 个）
   - 移除 emoji（20+ 个）
   - 移除冗余注释（30+ 处）

2. **Store 状态管理**（4 个文件）
   - 减少 143 行代码（15.5%）
   - 提取 `INITIAL_STATS` 常量消除重复
   - 移除重复的 `updateCumulativeStats` 方法
   - 简化防御性代码

3. **Hooks**（5 个文件）
   - 减少 79 行冗余注释
   - 清理显而易见的描述性注释

4. **Services & Utils**（12 个文件）
   - 优化约 106 处
   - 移除冗余注释和 emoji
   - 简化错误消息构建

5. **Types**（4 个文件）
   - 减少 48 行（18%）
   - 消除前后端类型重复定义
   - 改用自动生成的 ts-rs 类型
   - 提升类型一致性

#### 后端优化（24 个文件）

1. **Rust Commands**（9 个文件）
   - 减少约 98 行（4.4%）
   - 提取公共函数（`mask_api_key`、`get_provider_display_name`）
   - 重构 `normalize_locale()`：53 行 → 18 行
   - 提取平台特定代码，使用条件编译

2. **Rust Services**（14 个文件）
   - 应用 8 处优化
   - 使用 Default trait
   - 简化返回值（9 个方法）
   - 使用链式调用提升可读性

3. **Rust Utils & 核心**（11 个文件）
   - 净减少 218 行（27.3%）
   - 提取 `check_forbidden_directories()` 消除重复
   - 重构 `init_logger()`：合并 debug/release 版本
   - 添加模块级文档

**优化效果**:

- ⬆️ 代码清晰度大幅提升（移除 330+ 处冗余注释）
- ⬆️ 可维护性提升（消除重复代码、提取公共逻辑）
- ⬆️ 类型安全提升（统一前后端类型定义）
- ⬇️ 代码简洁性提升（减少 752 行）
- ⬇️ 重复代码大幅减少（提取 10+ 处公共逻辑）
- ⬆️ 代码一致性提升（统一代码风格）

**质量保证**:

- ✅ TypeScript 编译无错误
- ✅ Prettier/ESLint 检查通过
- ✅ Rust cargo check/clippy/fmt 通过
- ✅ 所有功能测试通过
- ✅ 主题切换、AI 翻译等核心功能正常

**相关文档**:

- `docs/FULL_CODE_SIMPLIFICATION_REPORT.md` - 整体优化详细报告
- `docs/CODE_SIMPLIFICATION_REPORT.md` - 首轮优化报告
- `docs/COLOR_SYSTEM.md` - 颜色系统最佳实践
- `docs/THEME.md` - 主题配置指南

---

### 优化 - 代码简化（2026-01-27 第一轮）

**优化范围**: 前端 React/TypeScript + 后端 Rust，共 20 个文件

**优化原则**: 基于 `docs/代码简化.md`，遵循以下核心原则：

1. 保持功能不变
2. 应用项目标准（CLAUDE.md）
3. 增强清晰度
4. 保持平衡

**优化统计**:

- 代码行数减少约 159 行（3.7%）
- 消除多处重复代码
- 移除 100+ 条冗余注释
- 修复 2 个潜在问题

**主要优化内容**:

#### 前端优化（19 个文件）

1. **React/TypeScript 组件**（13 个文件）
   - 移除冗余注释约 50-60 行
   - 清理版本标记（"Phase X"、"🆕" 等）
   - 清理显而易见的技术实现注释
   - 优化的文件：AIWorkspace, EditorPane, EntryList, MenuBar, TermLibraryManager, MemoryManager, TranslationWorkspace, DevToolsThemeProvider 等

2. **Hooks 和主题**（3 个文件）
   - `useCssColors.ts`: 107 行 → 67 行（减少 37%）
   - `useTheme.ts`: 121 行 → 81 行（减少 33%）
   - `theme/config.ts`: 264 行 → 235 行（减少 11%）
   - 提取 `commonSourceColors` 消除颜色定义重复
   - 合并 useMemo 减少重复计算

3. **主应用和样式**（3 个文件）
   - 提取 `checkAIConfig()` 函数，消除 3 处重复逻辑
   - 合并 App.css 重复的过渡规则
   - 修复 `pointer-events:` 语法错误
   - 移除冗余注释约 20+ 条

#### 后端优化（1 个文件）

1. **Rust 模块**（`src-tauri/src/services/mod.rs`）
   - 消除通配符导出，改为精确导出
   - 移除未使用的导出（BatchStats, POParseError, PromptLogEntry）
   - 改进模块组织，按功能分组
   - 移除临时开发标记
   - 通过 cargo check, clippy, fmt 检查

**优化效果**:

- ⬆️ 代码清晰度大幅提升
- ⬆️ 可维护性提升（消除重复代码）
- ⬆️ API 边界更清晰（精确导出）
- ⬇️ 命名空间污染减少
- ⬇️ 重复代码消除

**质量保证**:

- ✅ TypeScript 编译无错误
- ✅ Prettier/ESLint 检查通过
- ✅ Rust cargo check/clippy/fmt 通过
- ✅ 所有功能测试通过
- ✅ 主题切换、AI 翻译等核心功能正常

**相关文档**:

- `docs/CODE_SIMPLIFICATION_REPORT.md` - 详细优化报告

---

### 修复 - 主题系统

**问题**：主题切换时，不同 UI 区域的过渡动画速度不一致

**根本原因**：

- 使用硬编码的颜色值（RGB/HEX）作为内联样式
- React 重新渲染时直接赋予新值
- 浏览器无法在两个硬编码值之间产生 CSS 过渡动画

**解决方案**：

1. 将颜色系统改为 CSS 变量（`var(--color-xxx)`）
2. 在 `useTheme` hook 中统一设置所有颜色变量
3. 组件中使用 CSS 变量引用替代硬编码颜色值
4. 移除手动添加的 `transition` 样式，依赖全局 CSS 规则

**修复的组件**（共 9 个）：

- `src/components/EntryList.tsx`
- `src/components/TranslationWorkspace.tsx`
- `src/components/MenuBar.tsx`
- `src/components/EditorPane.tsx`
- `src/components/TermLibraryManager.tsx`
- `src/components/TruncatedText.tsx`
- `src/components/FileInfoBar.tsx`
- `src/components/AIWorkspace.tsx`
- `src/components/DevToolsThemeProvider.tsx`

**影响**：

- 所有 UI 区域的主题切换过渡动画现在统一为 0.3s
- 过渡效果平滑，视觉体验一致
- 代码更简洁，移除了冗余的 transition 样式
- 消除了所有硬编码颜色值问题

**相关文档**：

- `docs/COLOR_SYSTEM.md` - 颜色系统最佳实践
- `docs/COLOR_FIX_RECORD.md` - 详细修复记录
- `docs/THEME.md` - 主题配置指南

---
