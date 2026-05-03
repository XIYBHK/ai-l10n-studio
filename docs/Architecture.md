# 架构概览

**Last Updated**: 2026-05-04
**历史演进参考**: `archive/architecture-history.md`（2025-11 性能重构、2026-01 质量优化、Phase 10 虚拟滚动等完整历程）

## 核心技术栈

| 层 | 技术 |
|---|---|
| 前端框架 | React 19 + TypeScript + Vite |
| UI 库 | Ant Design 6 |
| 状态管理 | Zustand 5（4 stores，原子 selector） |
| 数据获取 | SWR |
| 虚拟化 | @tanstack/react-virtual |
| i18n | react-i18next（14 命名空间） |
| 桌面壳 | Tauri 2.x |
| 后端语言 | Rust 2024 edition |
| 异步运行时 | Tokio |
| 解析器 | nom（PO 文件） |
| 序列化 | serde（camelCase ↔ snake_case 自动） |
| 类型生成 | ts-rs（Rust → TypeScript） |
| 并发原语 | parking_lot::RwLock |
| 持久化 | tauri-plugin-store（JSON，应用数据目录） |

## 设计原则

- **单一真相源**：Rust 类型先定义，前端通过 `ts-rs` 生成或手动对齐；设计 token 统一在 `src/index.css`
- **运行时配置**：优先使用 `ConfigDraft`（全局单例 + 原子 apply）；`ConfigManager` 仅保留导入/导出与兼容
- **密钥分离**：公开配置 + 独立 secrets 文件，详见 `SECURITY_NOTES.md`
- **替换而非共存**：新代码落地即移除旧代码，避免 legacy wrapper
- **框架优先**：新增功能先检查现有模块，避免临时补丁

## 代码组织

```
ai-l10n-studio/
├── src/                  # React frontend（详见 src/AGENTS.md）
│   ├── components/       # editor/, settings/, ui/, aiWorkspace/, entryList/
│   ├── hooks/            # 核心业务 hook + 抽离的 useTermDetection/useEntrySelection
│   ├── store/            # 4 Zustand stores（原子 selector）
│   ├── services/         # Command modules + apiClient + tauriInvoke
│   ├── theme/            # Catppuccin palette + Antd ThemeConfig
│   ├── i18n/             # locale files + react-i18next 配置
│   ├── styles/           # accessibility.css（WCAG 2.1 AA）
│   ├── types/            # 手动类型 + generated/（ts-rs 生成，禁手编）
│   └── test/             # Vitest + jsdom 设置
├── src-tauri/
│   └── src/
│       ├── commands/     # 9 command modules（35+ Tauri handlers）
│       └── services/     # 业务服务 + AI provider plugins
├── plugins/              # 用户可见的 AI 提供商插件
├── e2e-tests/            # WebDriverIO + MidScene（独立 npm 工程）
├── scripts/              # portable.js、check-unused-i18n.js
└── docs/                 # 当前参考文档 + archive/ 历史归档
```

## 分层与调用

### 前端组件 → 后端命令

```
React Component
   ↓ (推荐) 通过 hook 间接调用
Hook (useTranslationFlow / useConfig / ...)
   ↓
Command module object (aiConfigCommands / configCommands / ...)
   ↓
apiClient.invoke()           ← 错误处理 + 用户 UI 提示
   ↓
tauriInvoke()                ← console 日志 + PII 脱敏
   ↓
@tauri-apps/api.invoke()     ← Tauri IPC
   ↓ serde
Rust #[tauri::command]
   ↓
Backend service
```

详见 `API.md`。

### 后端命令 → 业务服务

```
#[tauri::command] fn xxx() -> Result<T, AppError>
   ↓
ConfigDraft::global() （读写配置）
AITranslator / batch_translator （翻译核心）
PoFileParser （PO 解析）
TranslationMemory / TermLibrary （记忆库/术语库）
```

错误统一类型：`src-tauri/src/error.rs::AppError`，10 种变体（Config/Translation/Io/Network/Serde/Proxy/Parse/Plugin/Validation/Generic），自动 From 常见错误。

### 流式翻译（Channel API）

大批量翻译时，后端通过 `Channel<T>` 向前端推送实时进度与统计，前端 `useChannelTranslation` hook 消费。避免事件风暴。

## 2026-05 前端审查响应（P0 → P2）

### P0（健壮性）

- 修复 `useTranslationFlow` 稳定闭包：解构 `useChannelTranslation` 返回值避免 `cancelTranslation` 每次渲染重建
- 给 `useTranslationMemory` / `useTermLibrary` 异步 `listen()` 加 `isActive` 竞态守卫
- 迁移 60+ 硬编码中文字符串到 i18n，新增 `app` / `messages` / `errors` / `errorBoundary` / `emptyState` / `devTools` 6 个命名空间（总数 8 → 14）

### P1（架构）

| 文件 | 改前 | 改后 |
|---|---:|---:|
| `AIWorkspace.tsx` | 710 | **178**（抽出 9 个子组件到 `aiWorkspace/`） |
| `EntryList.tsx` | 799 | **251**（抽出 `VirtualizedColumn` / `StatusColumns` / `BatchActions` + `useEntrySelection` hook） |
| `EditorPane.tsx` | 331 | **220**（抽出 `useTermDetection` hook） |
| `MenuBar.tsx` props | 14 | **9**（theme → `useTheme`；source/target language → `useTranslationStore`） |

### P2（打磨）

- DevTools UI 标签 i18n（新增 `devTools` 命名空间 17 keys）
- `EmptyState` 配置从常量改为运行时 `t()` 构建
- `useDeferredValue` 优化 MemoryManager 搜索；`startTransition` 优化大文件加载
- Antd Modal 内置焦点陷阱已足够，自定义 `FocusTrap` 类加导引注释防误用

### 视觉 P0 + P1

- 设计 token 冲突解决：`index.css` 成为 SSOT；`App.css` 从 444 → 150 行（-66%）
- 清理重复动画、dead CSS 类、9 处 emoji 注释
- 状态色 `needsReview` 从 Blue 改为 Peach `#fab387`（符合"需关注"语义）
- `unsavedBadge` 从紫色（1.2:1 对比度）改为 Peach + 深文字（~9:1，AAA）
- `StatCard` 支持 `size="large"`；`CumulativeStatsSection` 主指标独占 + 品牌色 + 28px bold
- 新增 `--color-warning` / `--color-error` / `--color-flashGlow` token 家族
- 所有硬编码 `#ff4d4f` / `rgba(22, 119, 255, ...)` 替换为 Catppuccin token

## 性能关键点

- **虚拟化列表**：`@tanstack/react-virtual` 渲染 5000+ 条目不卡顿
- **渐进式上屏**：`useTranslationFlow` 的 `updateQueue` + 自适应间隔（50-300ms）在批量翻译时平滑更新
- **React 19 特性**：`startTransition` 包裹大 `setEntries`；`useDeferredValue` 优化大列表过滤
- **进度节流**：后端 `ProgressThrottler` 100ms 间隔，减少 90% 渲染开销
- **Channel API**：流式进度替代事件轮询，响应 < 30ms
- **原子 selector**：Zustand store 每个订阅只关心一个字段，避免全局重渲染
- **CSS 变量 token**：主题切换零 JS 重算
- **代码分割**：`AIWorkspace`、`MemoryManager`、`SettingsModal`、`DevToolsModal`、`TermLibraryManager` 全部 lazy import

## 无障碍（WCAG 2.1 AA）

- `src/styles/accessibility.css` 105 行：focus-visible 全局主色描边 / skip link / `prefers-reduced-motion` / `prefers-contrast` / `.sr-only` / progressbar 增强
- AppShell 有 `<h1 className="sr-only">`；initError 横幅 `role="alert"`
- 所有 icon-only 按钮有 `aria-label`
- Tab 焦点循环由 Antd Modal 内置提供

## CI 工作流（`.github/workflows/`）

| 工作流 | 触发 | 内容 |
|---|---|---|
| `check.yml` | push / PR | Prettier 检查、Vitest 单测、Cargo test、Cargo clippy |
| `ui-e2e.yml` | push main | WebDriverIO + MidScene 视觉测试（Windows-only） |
| `build.yml` | 手动 | 各平台 Tauri build |
| `release.yml` | tag `v*` | 构建产物 + GitHub Release |

## 参考

- API 契约：`API.md`
- 数据契约：`DataContract.md`
- 主题配置：`THEME.md`、`COLOR_SYSTEM.md`
- 密钥存储：`SECURITY_NOTES.md`
- 错误最佳实践：`ERRORS.md`
- 前端知识库：`../src/AGENTS.md`
- 项目根知识库：`../AGENTS.md`
- **历史演进归档**：`archive/architecture-history.md`
