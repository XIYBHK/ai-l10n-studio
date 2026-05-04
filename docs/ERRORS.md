# 错误排查与最佳实践

**Last Updated**: 2026-05-04
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

尚未有需要记录的近期问题。如果遇到值得记录的 bug / 陷阱，按上面模板追加在本 section。

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

- **Tauri listen**：所有订阅必须加 `isActive` 竞态守卫，见 `src/hooks/useTranslationFlow.ts` 第 173-200 行
- **useCallback 依赖**：如果依赖一个 hook 返回的对象，**解构出稳定函数**而不是依赖整个对象（避免每次渲染重建）
- **Queue timer**：如果 hook 内管理 setTimeout/setInterval，cleanup 必须清除

### 视觉一致性

- 设计 token 单一真相源：`src/index.css`（不在 `App.css` 或组件 CSS 模块重复定义同名 token）
- 颜色硬编码禁区：所有色值走 `CSS_COLORS.xxx` 或 `var(--color-xxx)`；禁止 `#ff4d4f` / `rgba(...)` 形式
- `message.*()` 调用的文案必须 i18n，禁止硬编码中文
- icon-only 按钮必须有 `aria-label`

### 配置写入

- 运行时配置使用 `ConfigDraft::global()`（全局单例）
- 读锁/写锁不得跨 `await` 点（编译错：Send bound not satisfied）
- `apply()` 自动保存磁盘并发 `config:updated` 事件

---

## 工具推荐

| 工具 | 用途 |
|---|---|
| `npx tsc --noEmit` | 全项目 TypeScript 类型检查（比 `npm run build` 快，不打包） |
| `cargo clippy --manifest-path src-tauri/Cargo.toml` | Rust lint |
| `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` | Rust 格式检查 |
| `npm run i18n:check` | 发现未使用的 i18n key |
| `npm run lint:all` | Prettier + Cargo fmt 双检查 |
| Git pre-commit hook | 建议：提交前自动运行上述检查 |

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
