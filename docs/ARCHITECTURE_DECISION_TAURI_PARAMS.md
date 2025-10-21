# 架构决策：Tauri 参数格式统一（2025-10）

## 背景

Tauri 2.x 改变了前后端参数传递的行为：

- **旧版本**：Rust 的 `snake_case` 直接暴露给前端
- **新版本**：Rust 的 `snake_case` 自动转换为 `camelCase` 暴露给前端

这导致我们之前的 `tauriInvoke.ts` 默认将 camelCase 转换为 snake_case 的逻辑与 Tauri 2.x 产生冲突。

## 问题表现

反复出现参数格式错误：

```
invalid args 'filePath' for command 'parse_po_file':
command parse_po_file missing required key filePath
```

原因：

1. 前端发送 `{ filePath: "xxx" }`
2. `tauriInvoke` 转换为 `{ file_path: "xxx" }`
3. Tauri 2.x 期望接收 `filePath` (camelCase)
4. 参数不匹配，调用失败

## 架构决策

### 1. 统一参数格式：camelCase

**前端**：

- 所有 TypeScript 接口使用 camelCase
- 所有函数参数使用 camelCase
- 不再进行 snake_case 转换

**后端**：

- 所有 Rust 结构体添加 `#[serde(rename_all = "camelCase")]`
- 序列化/反序列化时自动转换为 camelCase
- 保持 Rust 内部代码仍使用 snake_case

### 2. 修改默认行为

**修改前**（`tauriInvoke.ts`）：

```typescript
autoConvertParams = true; // 默认转换为 snake_case
```

**修改后**：

```typescript
autoConvertParams = false; // 默认不转换，保持 camelCase
```

### 3. 清理冗余代码

**修改前**（遍布各处）：

```typescript
invoke(command, params, {
  autoConvertParams: false, // ❌ 手动禁用转换
});
```

**修改后**：

```typescript
invoke(command, params); // ✅ 默认不转换
```

## 实施步骤

### 第一阶段：修改架构层（2025-10-21）

1. ✅ 修改 `tauriInvoke.ts` 默认值为 `false`
2. ✅ 修改 `apiClient.ts` 默认值为 `undefined`（让 tauriInvoke 处理）
3. ✅ 后端所有结构体添加 `#[serde(rename_all = "camelCase")]`：
   - `AIConfig`, `ProxyConfig`
   - `AppConfig`, `ConfigVersionInfo`
   - `TestConnectionRequest`, `TestConnectionResult`
   - `ContextualRefineRequest`

### 第二阶段：清理冗余代码（2025-10-21）

移除所有手动设置的 `autoConvertParams: false`：

- ✅ `src/services/commands.ts` - 13 处
- ✅ `src/services/api.ts` - 1 处
- ✅ `src/hooks/useChannelTranslation.ts` - 1 处
- ✅ `src/services/swr.ts` - 2 处
- ✅ `src/services/configSync.ts` - 1 处

### 第三阶段：文档更新（2025-10-21）

- ✅ `API.md` - 添加架构约定说明
- ✅ `Architecture.md` - 更新数据流说明
- ✅ `DataContract.md` - 明确参数格式规范
- ✅ `ERRORS.md` - 记录此类问题的解决方案
- ✅ 新增本文档 - 记录架构决策

## 影响范围

### 受益

- ✅ **一处修改，全局生效**：不再需要手动设置参数转换
- ✅ **类型安全**：TypeScript 和 Rust 类型完全对应
- ✅ **减少错误**：统一格式，避免反复出现类似问题
- ✅ **代码清晰**：移除了 200+ 行冗余代码和注释

### 潜在风险

- ⚠️ **向后兼容**：保留 `autoConvertParams` 参数以支持特殊情况
- ⚠️ **第三方 API**：如果调用外部 Rust 库，可能需要手动转换

## 验证清单

### 前端验证

- [ ] 所有 Tauri 命令调用正常
- [ ] AI 配置保存/编辑正常
- [ ] PO 文件解析/保存正常
- [ ] 翻译功能正常（单条/批量/精翻）
- [ ] 文件格式检测正常
- [ ] 语言检测正常

### 后端验证

- [ ] `cargo check` 无错误
- [ ] 所有结构体正确序列化
- [ ] 日志中参数格式正确

## 最佳实践

### 新增 Tauri 命令时

**前端**：

```typescript
// ✅ 使用 camelCase
export const newCommands = {
  async doSomething(filePath: string, sourceLang: string) {
    return invoke(COMMANDS.DO_SOMETHING, { filePath, sourceLang });
  },
};
```

**后端**：

```rust
// ✅ 添加 serde 注解
#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")] // 关键！
pub struct RequestData {
    pub file_path: String,
    pub source_lang: String,
}

#[tauri::command]
pub async fn do_something(file_path: String, source_lang: String) -> Result<(), String> {
    // Tauri 2.x 会自动将前端的 camelCase 转为 snake_case 参数
    Ok(())
}
```

### 调试参数问题

1. 查看前端日志：

```
[TauriInvoke] 📤 Tauri调用: parse_po_file {filePath: "..."}
```

2. 查看后端日志（如果启用）：

```
[INFO] Command parse_po_file received: {"filePath": "..."}
```

3. 如果出现 `missing required key` 错误：
   - ✅ 检查前端是否使用 camelCase
   - ✅ 检查后端结构体是否有 `#[serde(rename_all = "camelCase")]`
   - ❌ 不要添加 `autoConvertParams: false`（这已经是默认值）

## 参考

- [Tauri 2.0 Migration Guide](https://tauri.app/v2/migration/guides/)
- `docs/API.md` - API 参考文档
- `docs/Architecture.md` - 架构概览
- `docs/DataContract.md` - 数据契约
- `docs/ERRORS.md` - 常见错误与解决方案

## 变更历史

- **2025-10-21**: 初始版本，记录参数格式统一决策
- **2025-10-21**: 完成第一阶段和第二阶段实施
- **2025-10-21**: 文档更新完成
