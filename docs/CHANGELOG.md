# 更新日志

## [Unreleased]

### Fixed

- 日志系统：WriteMode 配置、超时保护、Handle 管理
- 批量翻译：Token 统计显示为 0
- Channel 翻译：返回类型不一致
- 记忆库：错误被忽略

### Added

- 词条列表：待确认/已翻译列增加移除按钮
- 记忆库：清空时重置 tm_learned 统计
- **前端架构**：useTranslationFlow Hook（翻译流程逻辑封装）
- **前端架构**：TranslationWorkspace 组件（工作区布局封装）
- **前端架构**：useTranslationStore（翻译状态管理）
- **后端架构**：error.rs 统一错误类型
- **后端架构**：prompt_builder.rs（提示词构建器模块）
- **后端架构**：translation_stats.rs（翻译统计模块）

### Changed

- UI/UX：主题系统、MenuBar、EntryList、EditorPane、AIWorkspace 升级
- **重构**：App.tsx 从 640 行拆分为 168 行（-73.7%）
- **重构**：ai_translator.rs 拆分为 3 个模块
- **重构**：Zustand Store 职责重新划分（新增 useTranslationStore）
- **重构**：Rust 错误处理统一化（135 处重复代码消除）
- **依赖升级**：React 19, Ant Design 6, TypeScript 5.9, Zustand 5

### Removed

- 过时内联样式和简单状态文本

---

## 2026-01-26 - 架构优化（代码质量提升）

### Refactor

**前端架构优化**：

- 拆分 App.tsx：640 行 → 168 行（-73.7%）
  - 提取 useTranslationFlow Hook（370 行）
  - 提取 TranslationWorkspace 组件（172 行）
- 重构 Zustand Store：
  - 新增 useTranslationStore（翻译状态管理）
  - 精简 useAppStore（-90 行）
  - 精简 useSessionStore（-89 行）

**后端架构优化**：

- 拆分 ai_translator.rs：1196 行 → 模块化结构
  - 新增 prompt_builder.rs（106 行）
  - 新增 translation_stats.rs（231 行）
- 统一错误处理：
  - 新增 error.rs（317 行，AppError 统一类型）
  - 更新 3 个核心服务使用 AppError
  - 减少 135 处重复错误处理代码

**质量提升**：

- 消除所有超大文件（最大文件从 1196 行降至 370 行）
- Store 职责清晰化（消除重复状态管理）
- 错误处理统一化（支持智能重试）
- 类型安全完整保持（TypeScript + Rust）

---

## 2025-12-16 - Phase 10: 虚拟滚动与事件节流优化

### Changed

- 虚拟滚动：react-window → @tanstack/react-virtual
- 事件节流：添加 ProgressThrottler，减少 90% UI 更新
- CI 质量：移除 `|| true` 强制通过
- 类型安全：删除 swr-shim.d.ts，恢复完整类型推断

---

## 2025-11-23 - 第三轮架构优化（深度简化）

### Removed

- 未使用文件 5 个（687 行）
- 未使用函数 1 个（60 行）
- API 中间层：api.ts, swr.ts（~240 行）
- 空目录：src/components/app/

### Changed

- API 架构：三层 → 两层（简化调用链）
- SWR 配置：内联 fetcher，删除默认配置

---

## 2025-12-18 - 代码质量与性能优化

### Fixed

- Rust：21 个文件使用 parking_lot 替代 std::sync，移除 81 处 unwrap
- React：添加 React.memo 到 4 个组件

---

## 2025-10-21 - 修复配置持久化问题（critical）

### Fixed

- 配置 fallback 路径：临时目录 → 正常路径
- 损坏配置：自动备份（带时间戳）

---

## 2025-10-21 - 清理旧日志系统（新旧共存问题）

### Removed

- 旧日志系统 460 行代码
- frontendLogger.ts、useLogs.ts

---

## 2025-10-21 - 日志系统架构重构

### Changed

- 日志服务：SWR → Zustand Store
- 前端日志：文件系统 → 内存模式
- DevTools：移除实时模式，改为 Pause/Resume

---

## 2025-10-21 - 简化日志系统（移除实时模式）

### Changed

- 日志控制：实时模式 → Pause/Resume + Clear
- 轮询策略：按需启用 → 固定 2 秒

---

## 2025-10-21 - 修复实时日志模式 + 清理控制台污染

### Fixed

- 实时模式清空：添加强制刷新
- 控制台污染：默认 silent = true

---

## 2025-10-21 - 添加实时日志模式

### Added

- 实时日志模式开关：自动清空历史、2 秒轮询

---

## 2025-10-21 - 优化日志轮询

### Changed

- 前端日志：自动轮询 5 秒 → 手动刷新
- 添加请求去重：2-5 秒间隔

---

## 2025-10-21 - 修复 AI 模型命令参数名不匹配

### Fixed

- 命令参数：provider → providerId（Tauri 自动转换）

---

## 2025-10-21 - 修复供应商注册重复错误

### Fixed

- 命令：移除冗余 register_all_providers 调用

---

## 2025-10-21 - Phase 6: 前后端类型统一迁移完成

### Removed

- ProviderType 枚举、ProviderInfo 接口
- providerMapping.ts、转换函数（~200 行）

### Changed

- AI 配置：provider → providerId
- 命令层：移除转换逻辑，直接传递

---

## 2025-10-21 - Phase 5: 新旧实现冲突解决

### Changed

- ProviderType 枚举：标记为 @deprecated
- 指向新插件化系统 API

---

## 2025-10-21 - Phase 4: 常用 AI 供应商扩展

### Added

- 5 个国内供应商：百度文心、阿里通义、智谱、讯飞星火、字节豆包
- 5 个海外供应商：Claude、Gemini
- 插件化供应商：9 个完整插件，70+ 模型

---

## 2025-10-21 - 插件化架构重构 + 模型更新 + 前后端同步

### Added

- AIProvider trait 统一接口
- 线程安全全局供应商注册表
- 动态供应商 API：getAll、getAllModels、findProviderForModel
- 自动注册系统、插件自动发现机制

### Changed

- DeepSeek、Moonshot：3-5 个模型配置
- SettingsModal：动态供应商加载

---

## 2025-10-21 - 移除测试系统 + 修复 AI 配置编辑问题

### Removed

- 测试系统 462 行代码

### Fixed

- AI 配置编辑：正确更新配置项

---

## 2025-10-21 - 安全修复和翻译记忆库逻辑优化

### Fixed

- 路径遍历漏洞：dunce 规范化
- 翻译记忆库：模糊匹配算法

---

## 2025-10-15 - 代码清理和系统主题检测优化

### Removed

- 未使用代码 200+ 行

### Changed

- 主题检测：使用 matchMedia，移除 @tauri-theme-api

---

## 2025-10-14 - 7 个关键 Bug 修复

### Fixed

- 事件系统：useEffect 依赖数组、事件监听清理
- API 调用：返回值类型、参数类型
- 路径处理：便携模式路径
- AI 配置：保存后不刷新
- 类型定义：POEntry、AIConfig 字段

---

## 2025-10-13 - 架构重构（统一命令层 + Draft 模式）

### Removed

- 分散的 API 调用、事件溯源系统（259 行）

### Added

- commands.ts 统一命令层
- ConfigDraft 草稿模式
- AppDataProvider 上下文
- Draft 模式全局变量

---

## 2025-10-11 - Phase 3: UI 现代化与用户体验提升

### Changed

- UI 框架：antd 4 → 5
- EntryList：虚拟滚动、Badge 状态
- EditorPane：沉浸式双栏、等宽字体
- MenuBar：胶囊式语言选择器
- AIWorkspace：去除卡片边框
- 主题系统：现代蓝色调色板

---

## 2025-10-10 - 重构统计引擎（删除事件溯源）

### Removed

- 事件溯源系统（259 行）

### Added

- Channel API：进度和统计事件通道
- useChannelTranslation Hook
- ProgressThrottler 工具类

---

## 2025-10-09 - 配置持久化（JSON）+ 统计数据持久化

### Changed

- 配置存储：Tauri Store → JSON
- 新增：统计数据 JSON 持久化

---

## 2025-10-08 - 重构命令层

### Removed

- API 层中间封装

### Changed

- 命令调用：直接 apiClient.invoke

---

## 2025-10-07 - 重构事件系统

### Changed

- 事件系统：事件溯源 → Channel API
- 删除：事件监听器、EventDispatcher

---

## 2025-10-06 - 测试覆盖率提升

### Changed

- 测试：50 个单元测试，覆盖率 75%
- 新增：CI 集成测试

---

## 2025-10-05 - 路径规范化 + 日志系统升级

### Changed

- 路径处理：dunce 规范化
- 日志系统：flexi_logger、结构化日志宏

---

## 2025-10-04 - Rust 错误处理改进

### Changed

- 错误类型：anyhow、thiserror
- Result 替换 unwrap/expect

---

## 2025-10-03 - 简化 PO 解析器

### Changed

- PO 解析器：nom（100 行）
- 删除：正则表达式版本

---

## 2025-10-02 - 多 AI 供应商架构

### Added

- 9 个 AI 供应商（OpenAI、DeepSeek、Moonshot、Claude、Gemini 等）
- 供应商管理、模型选择
- 动态配置加载

---

## 2025-10-01 - 翻译记忆库 + 术语库

### Added

- 翻译记忆库：模糊匹配、学习功能
- 术语库：术语优先翻译、批量管理

---

## 2025-09-30 - 工程化增强

### Added

- once_cell：便携模式标志
- parking_lot：RwLock、Mutex
- dunce：路径规范化
- chrono：时间处理

---

## 2025-09-29 - 国际化 + 主题系统

### Added

- i18next：中英文切换
- 主题切换：亮色/暗色模式

---

## 2025-09-28 - 初始化项目

### Added

- Tauri 2.x + React 18 + Ant Design 5
- PO 文件解析
- AI 翻译功能
