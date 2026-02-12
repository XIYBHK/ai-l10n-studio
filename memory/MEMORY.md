# AI 开发经验记录

本文档记录开发过程中遇到的关键问题和解决方案，用于避免重复错误。

---

## 关键经验教训

### 1. CI 配置不能使用 `|| true` 绕过检查

**问题**：CI 工作流中使用 `|| true` 导致 lint 错误被静默通过

```yaml
# 错误示例
- name: Run linters
  run: npm run lint:all || true # 总是返回成功
```

**解决**：移除 `|| true`，让 CI 真实反映代码质量

```yaml
- name: Run linters
  run: npm run lint:all
```

---

### 2. 不要创建第三方库的类型 shim

**问题**：创建 `swr-shim.d.ts` 将所有类型覆盖为 `any`，导致类型安全完全丢失

**解决**：删除 shim 文件，依赖官方类型定义

```bash
rm src/types/swr-shim.d.ts
```

---

### 3. 日志系统需要 WriteMode::BufferAndFlush

**问题**：flexi_logger 默认缓冲模式导致日志不写入磁盘

**解决**：显式设置写入模式并保存 Logger handle

```rust
Logger::with(spec)
    .write_mode(WriteMode::BufferAndFlush)  // 立即写入
    .log_to_file(FileSpec::default())
    .start()?;
```

---

### 4. Vite 需要排除参考项目目录

**问题**：Vite 扫描 `ref/` 目录导致编译错误

**解决**：在 vite.config.ts 中排除

```typescript
server: {
  watch: {
    ignored: ['**/ref/**', '**/src-tauri/**'];
  }
}
```

---

### 5. 统一错误处理使用 AppError

**问题**：分散的 `anyhow::Error` 和 `.map_err()` 重复代码

**解决**：使用 `src-tauri/src/error.rs` 中的 `AppError`

```rust
// 自动转换
let response = reqwest::get(url).await?;  // reqwest::Error -> AppError

// 创建特定错误
return Err(AppError::config("API Key 不能为空"));
return Err(AppError::translation("网络超时", true));  // 可重试
```

---

### 6. Store 状态需要保持唯一性

**问题**：多个 Store 管理相同状态导致数据不一致

**解决**：按职责划分 Store

- `useAppStore` - 应用配置（主题、语言）
- `useTranslationStore` - 翻译状态（条目、导航）
- `useSessionStore` - 会话状态（进度）
- `useStatsStore` - 统计数据

---

### 7. 配置修改使用 Draft 模式

**问题**：直接修改配置可能导致竞态条件

**解决**：使用 `ConfigDraft` 草稿模式

```rust
let mut config = draft.draft();
config.ai_configs.push(new_config);
draft.apply()?;  // 原子更新 + 发射事件
```

---

### 8. 大文件需要分块处理

**问题**：大文件一次性处理导致内存溢出

**解决**：使用 `file_chunker` 自动分块（10MB+ 每批 500 条目）

---

### 9. 快捷键使用原生事件监听器

**问题**：第三方快捷键库增加依赖

**解决**：在 `App.tsx` 中使用原生 `keydown` 事件

```typescript
useEffect(() => {
  const handleKeyDown = (event: KeyboardEvent) => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'o') {
      event.preventDefault();
      openFile();
    }
  };
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [openFile]);
```

---

### 10. 开发规范

来自 `.cursor/rules/xiybhk.mdc`：

- 写代码时要复用，多用函数封装功能
- 不要保留旧代码和旧接口，直接用新的替换
- 错误处理统一封装，在一个地方管日志和提示
- 一个函数干一件事，功能复杂就拆小
- 不要使用 emoji
- 优先检查项目中是否有已实现框架/模块处理该问题
- 利用框架解决通用问题，避免临时补丁

---

## 更多错误解决方案

详细的错误分析和解决方案请参考：`docs/ERRORS.md`

---

## 2026-02-08: CI 自动提交与 Clippy 修复

### 11. CI 自动提交场景验证

**发现**：项目配置了 CI 自动格式化，每次 push 都会创建新提交

```yaml
# .github/workflows/check.yml
- name: Run Prettier (auto-fix)
  run: npm run format
- name: Run cargo fmt (auto-fix)
  run: cargo fmt
- name: Commit and push fixes
  if: steps.changes.outputs.has_changes == 'true'
  run: |
    git commit -m "style: auto-fix formatting"
    git push
```

**时间线示例**：

```
T1: 本地开发基于 commit A
T2: 本地 push → CI 自动格式化 → 创建 commit B (style: auto-fix)
T3: 本地继续开发（仍基于 A）
T4: 尝试 push → ❌ rejected! 需要先拉取 B
```

**解决**：使用 git-commit skill 的方案 A，提交前检查远程状态

```bash
git fetch origin
git log HEAD..@{u} --oneline  # 查看远程新提交
git pull --rebase              # 同步 CI 提交
```

---

### 12. Clippy expect_used 处理方式

**问题**：硬编码字符串使用 `.parse().unwrap()` 被 Clippy 拒绝

```rust
// 错误：unwrap_used 被 -D warnings 视为错误
.add_directive("po_translator_gui=info".parse().unwrap())
```

**解决**：使用 `#[allow(clippy::expect_used)]` + 说明

```rust
#[allow(clippy::expect_used)]
let env_filter = EnvFilter::from_default_env()
    .add_directive("po_translator_gui=info".parse().expect("invalid log filter"))
    // 硬编码的常量字符串，解析不会失败
```

**原因**：

- `unwrap()` 和 `expect()` 在 Cargo.toml 中配置为 `warn`
- CI 运行 `cargo clippy -- -D warnings` 将警告视为错误
- 对于确信不会失败的硬编码字符串，使用 `expect()` + allow 注释

---

### 13. tracing::instrument 导入问题

**问题**：`use tracing::instrument;` 被报告为未使用

```rust
use tracing::instrument;  // ❌ 未使用警告

#[tracing::instrument]  // 使用完整路径，不需要单独导入
pub fn translate_with_ai(...) { ... }
```

**解决**：删除未使用的导入

```rust
// 删除这行
// use tracing::instrument;

// 直接使用完整路径
#[tracing::instrument]
pub fn translate_with_ai(...) { ... }
```

---

### 14. git-commit skill 方案 A 实战验证

**场景**：提交修复时遇到远程 CI 自动提交冲突

```
提交历史（rebase 前）：
7c01ae1 fix(rust): 修复 Clippy 警告        ← 本地新提交
1b2f4c0 docs: 更新项目文档和开发记忆       ← 基于此提交开发
5e6ef44 style: auto-fix formatting        ← 远程 CI 自动提交（冲突！）
```

**完整解决流程**：

```bash
# 1. 尝试推送（失败）
$ git push
# ❌ rejected! 远程有新提交

# 2. 检查远程状态
$ git fetch origin
$ git log HEAD..@{u} --oneline
# 5e6ef44 style: auto-fix formatting

# 3. 同步远程提交
$ git pull --rebase
# ✅ 成功 rebase

# 4. 再次推送
$ git push
# ✅ 成功

# 最终历史：
# 7c01ae1 fix(rust): 修复 Clippy 警告
# 5e6ef44 style: auto-fix formatting
# 1b2f4c0 docs: 更新项目文档和开发记忆
```

**结论**：git-commit skill 的方案 A 功能在实际项目中得到验证，能有效避免 CI 冲突。

---

## 修复文件清单

| 文件                                      | 问题                                | 解决方案                                          |
| ----------------------------------------- | ----------------------------------- | ------------------------------------------------- |
| `src-tauri/src/services/ai_translator.rs` | 未使用的 `tracing::instrument` 导入 | 删除导入                                          |
| `src-tauri/src/utils/logger.rs`           | 4 个 `unwrap()` 警告                | 添加 `#[allow(clippy::expect_used)]` + `expect()` |

---

## 技能文件更新

**更新**：`C:\Users\xiybh\.claude\skills\git-commit\skill.md`

新增功能：

- 步骤 0：检查远程同步状态（方案 A）
- CI 自动提交场景说明
- 检测 CI 提交的命令示例
