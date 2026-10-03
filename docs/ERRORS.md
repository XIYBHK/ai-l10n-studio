# 错误排查与最佳实践

**Last Updated**: 2026-10-03
**历史问题归档**: `archive/errors-history.md`（2025-10 架构重构编译错误、2025-12 Phase 10 CI 质量、2026-01 日志系统/Rust 错误统一 等已修复问题详细记录）

本文档记录**当前仍有参考价值的最佳实践**和**未来解决新问题时的记录指南**。具体的历史问题解决过程见归档。

---

## 错误记录规约

每次解决一个有教训的新问题时，在本文件添加新条目，并在时间上保持倒序（最新在上）。条目达到 3 个以上时，考虑把最老的归档到 `archive/errors-history.md`。

### 条目模板

```markdown
## YYYY-MM-DD - 简要标题

### 现象

（用户/开发者能观察到的症状）

### 根因

（查证后的真实原因，避免猜测）

### 修复

（代码层面的变更要点，关键文件 + 行号）

### 规避

（如何避免重现；是否已落地到 lint/CI/types）
```

---

## 近期问题（保留作为 recent reference）

### 2026-10-03 - E2E 清理影响被测程序的原配置

启动脚本原先直接在被测 exe 旁建立便携标记，并递归清除其 `com.potranslator.gui` 配置目录；指定已有 release 路径时可能删除用户数据。

现先复制 exe 与插件到 `src-tauri/target/e2e/run-*`，仅在副本旁建立全新便携数据。清理验证目录边界及随机所有权标记，驱动退出后只删除本次副本。两个回归验证原配置字节保留、资源复制以及越界或未持有目录不被删除。

### 2026-10-03 - 配置启动竞态、主题重复监听与缓存零价

UI 原先在偏好初始化完成前挂载，晚到的磁盘状态可能覆盖用户操作；读取模型配置失败又被当成空配置自动打开设置。现等待初始化后挂载，对加载失败显示重试，并保留成功读取空配置时的设置引导。

主题全局副作用收敛到主窗口一个 runtime hook，读取主题的组件不再重复监听和广播；开发工具异步订阅在卸载后完成时立即释放。Channel hook 只维护传输生命周期，UI 状态统一由 session store 持有。

插件价格的缺省值原先与显式 `0` 混合，导致免费缓存写入退回普通输入价。现用 `Option<f64>` 区分缺失与零价；provider 元信息借用现有字符串，移除查询时的永久泄漏。验证见 [ArchitectureReview.md](ArchitectureReview.md)。

### 2026-10-03 - 真实服务空响应漏记 token

授权 DeepSeek 实测时，512 token 上限的一次调用返回空内容。源码复核和本地 HTTP 回归证明：`AITranslator::request` 在内容校验成功后才记录 usage，空响应报错时丢失已报告的 token；命令也在错误返回前漏发最终统计。

现将 usage 记录移到内容校验前，批量与上下文优化失败时先通过 Channel 发送累计 token，再返回错误。不把思考内容当译文，不把失败结果写入记忆。回归先失败（0 输入 token，预期 4），修复后保留 4 输入 + 2 输出 token 和未知价格标记；当次完整 Rust 167 项 lib/bin 测试通过，当前去重后的验证见 [ArchitectureReview.md](ArchitectureReview.md)。

真实 DeepSeek 在 4096 token 上限下通过两次翻译、占位符、复数、术语及确认记忆复用测试；初次错误和后续响应分别留存，不将成功响应 token 当成全部测试账单。详见 [LogicFixes.md](LogicFixes.md)。

### 2026-10-03 - 编辑保存、迟到回写与库并发覆盖

**现象与根因**：编辑草稿只存在组件局部状态，保存读取旧 store，切换文件没有未保存保护；AI 回调只比较文件身份，能够覆盖同文件中的人工修改。输出路径校验错误地要求新文件已经存在。记忆库提前收录未经确认的 AI 结果，管理器整库保存又可能覆盖并发更新；术语缺少语言隔离且未直接注入翻译约束。

**修复**：草稿进入文档 store，保存合并后取快照，条目版本保护迟到结果，离开文档提供保存、放弃、取消；新目标语言创建独立文档并更新 PO 头和复数规则。输出路径校验改为检查已有父目录。明确确认的译文经独立命令入库，库读写共用短时事务锁、revision 比较和原子替换；管理器保留编辑基线。术语以原文、上下文、语言定位，并注入匹配规则。

**关联修复**：插件使用显式 API 协议与不包含操作端点的 Base URL；价格契约统一 USD/百万 token，未知价格请求独立计数。偏好写入使用 Tauri 2 运行时判断和串行存储，完成/错误通知接入实际翻译流程。移除目录翻译 IPC；XLIFF/YAML 元数据未支持时返回错误。

**规避与边界**：前端生命周期测试覆盖真实编辑器、保存、文档切换、复数与同文件人工修改；库测试覆盖冲突拒绝、并发更新、语言和上下文；通知和偏好验证使用 mock。旧库格式不迁移，版本冲突不得强制覆盖。原生窗口关闭/通知仍需桌面专项实测；授权后的真实 DeepSeek 验证见 [LogicFixes.md](LogicFixes.md)。

### 2026-10-03 - 供应商和模型配置契约重构

旧配置以数组索引表示活动配置，每条配置绑定一个模型，难以管理同供应商的多个模型及独立默认选择。现改为稳定供应商 ID、模型目录和 `defaultModel`，凭据在 `config.secrets.json` 按 ID 保存；查询和生成类型不包含密钥。

`ConfigDraft.transaction` 在同一写锁内完成更新、校验、持久化和发布，写入失败不改变当前运行配置。读取配置不改写文件；旧未发布配置首次替换前保留备份，不运行兼容迁移。测试覆盖凭据重排、默认模型失效、写入回滚、三种 API 协议和模型发现分页。

配置请求使用专门的保存/测试/发现命令；通用设置更新不得序列化覆盖凭据。未知模型可正常请求，但无价格目录时只记录 token 并标明未计价请求。术语与记忆业务逻辑的原始发现见 [核查报告](archive/2026-10-03/TermMemoryAudit.md)，修复状态见 [LogicFixes.md](LogicFixes.md)。

### 2026-10-02 - PO 保存、翻译结果和发布资源审计修复

**现象与根因**：旧逐行 PO 解析丢失多行字符串、复数和文档元数据，写出缺少转义；替换解析库后，回归测试进一步发现库的 formatter 会裁掉译文末尾空格。旧 Channel 前后端字段不一致，且节流会丢掉逐条结果；仅修字段无法保证完整性。TM 的目标语言别名和上下文键不一致，使命中失效或串用译文。

**修复**：`po_parser.rs` 使用完整文档模型、专用解析库和不裁剪字段的本地 writer，通过同目录临时文件原子替换。单 Channel 传递整批结果与累计统计，最终返回补齐结果；文档 revision 隔离切换文件后的异步回调。TM 使用 `[source, context, canonicalTargetLanguage]` 键，拒绝旧键而不自动覆盖旧文件。取消通过 `tokio::select!` 终止等待中的请求和重试。

**发布与配置**：release 从 `resource_dir/_up_/plugins` 加载插件；便携包仅包含可执行文件、插件和新建的 `PORTABLE` 标记，禁止复制开发机 `.config`。提示词响应按 UUID 关联，配置版本持久化递增，HTTP 请求使用配置超时；日志级别立即应用，保留和轮转策略重启生效。i18n 清理扫描叶子键，对动态键保守保留；CI 仅格式检查仍存在的变更文件。

**回归证据**：PO 多行/转义/末尾空格/复数/旧文本/废弃条目往返测试；本地 HTTP 上下文去重与取消测试；前端最终结果补齐、提前取消、文件切换和复数编辑测试；日志交错关联和便携包白名单测试。真实 AI 服务与原生 GUI E2E 不在这些测试覆盖范围内。

---

## 最佳实践（通用，跨项目阶段适用）

### 重构流程

1. **计划阶段**
   - 列出所有需要修改的 API / 接口
   - 全局搜索找出调用点（`grep` / `ast-grep`）
   - 评估影响面与工作量
2. **实现阶段**
   - 自底向上：utils / services → hooks / commands → components
   - 每个阶段完成后跑 `npx tsc --noEmit` / `cargo check`
3. **验证阶段**
   - 前端：`npm run build` + `npm run test:run`
   - 后端：`cargo test --quiet --manifest-path ./src-tauri/Cargo.toml`
   - 手动测试关键功能路径
4. **清理阶段**
   - 删除废弃代码（不保留 legacy wrapper）
   - 同步文档（AGENTS.md、相关 docs）

### 类型安全

**前端**:

- 启用 `strictNullChecks` / `strictFunctionTypes`
- 任何第三方库必须使用官方类型；禁止编写 `*.d.ts` 类型桩（会破坏类型推断）
- `useSWR` 必须提供 fetcher 函数而非魔法 key
- 可选字段用 `?.` / `??`

**后端**:

- 使用 `Result<T, AppError>` 统一错误处理
- 避免 `unwrap()` / `expect()`（Clippy warn）；用 `?` 传播
- 公共 API 变更时同步前端类型；优先用 `ts-rs` 生成
- 并发原语使用 `parking_lot::RwLock`（禁用 `std::sync::RwLock`）

**测试**:

- 使用工厂函数生成测试数据，避免散落定义
- 用 `userEvent.setup()`（禁用 `fireEvent`）

### 异步与事件

- **Tauri listen**：异步订阅使用活动标记；卸载前取得的监听函数在 cleanup 释放，卸载后才返回的监听函数立即释放。
- **useCallback 依赖**：如果依赖一个 hook 返回的对象，**解构出稳定函数**而不是依赖整个对象（避免每次渲染重建）
- **Queue timer**：如果 hook 内管理 setTimeout/setInterval，cleanup 必须清除

### 视觉一致性

- 首屏出现 `app.title` 等原始翻译键：仅定义初始化函数或在初始化前添加资源不足以让 React 取得字典。`src/i18n/config.ts` 直接同步初始化随包字典，启动入口在 UI 挂载前应用持久化语言；回归检查见 `src/__tests__/i18n.test.ts`。
- 辅助标题占据页面空间：使用 `sr-only` 前必须加载 `src/styles/accessibility.css`，由 `AppShell` 统一引入。
- 设计 token 单一真相源：`src/index.css`（不在 `App.css` 或组件 CSS 模块重复定义同名 token）
- 颜色硬编码禁区：所有色值走 `CSS_COLORS.xxx` 或 `var(--color-xxx)`；禁止 `#ff4d4f` / `rgba(...)` 形式
- `message.*()` 调用的文案必须 i18n，禁止硬编码中文
- i18n 清理必须使用递归叶子键扫描；动态 key 无法静态判断时应保守保留，避免误删活跃命名空间
- icon-only 按钮必须有 `aria-label`

### 配置写入

- 运行时配置使用 `ConfigDraft::global()`（全局单例）
- 读锁/写锁不得跨 `await` 点（编译错：Send bound not satisfied）
- `transaction()` 在同一写锁内完成克隆、修改、校验、持久化和发布；失败时保留原运行配置。`draft/apply/update` 旧入口已移除。

---

## 工具推荐

| 工具                                                        | 用途                                                        |
| ----------------------------------------------------------- | ----------------------------------------------------------- |
| `npx tsc --noEmit`                                          | 全项目 TypeScript 类型检查（比 `npm run build` 快，不打包） |
| `cargo clippy --manifest-path src-tauri/Cargo.toml`         | Rust lint                                                   |
| `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` | Rust 格式检查                                               |
| `npm run i18n:check`                                        | 发现未使用的 i18n key                                       |
| `npm run lint:all`                                          | Prettier + Cargo fmt 双检查                                 |
| Git pre-commit hook                                         | 建议：提交前自动运行上述检查                                |

---

## 参考文档

- 架构总览：`Architecture.md`
- API 契约：`API.md`
- 数据契约：`DataContract.md`
- 主题与色彩：`THEME.md`、`COLOR_SYSTEM.md`
- 密钥存储：`SECURITY_NOTES.md`
- 前端知识库：`../src/AGENTS.md`
- 项目根知识库：`../AGENTS.md`
- 变更历史：`../CHANGELOG.md`
- **历史问题归档**：`archive/errors-history.md`
