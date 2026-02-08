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
