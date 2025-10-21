# 硬编码问题全面修复总结

**日期**: 2025-10-21
**任务**: 检查并修复项目中的硬编码参数转换问题

## 🎯 修复目标

确保前后端数据格式统一，避免参数转换导致的字段名不匹配。

## 📋 发现的问题

### 问题1: `apiClient.ts` 硬编码参数转换

**位置**: `src/services/apiClient.ts:176`

**原代码**:

```typescript
const result = await invoke<T>(command, params, {
  autoConvertParams: true, // ❌ 硬编码
  silent: false,
});
```

**问题**:

- 即使上层设置了 `autoConvertParams: false`，这里仍然强制转换
- 导致 AI 配置参数被重复转换

**修复**:

- 添加 `autoConvertParams` 到 `InvokeOptions` 接口
- 传递该选项到 `executeWithRetry` → `executeWithTimeout` → `tauriInvoke`
- `api.ts` 转换后传递 `autoConvertParams: false` 避免重复转换

---

### 问题2: `TestConnectionRequest` 字段不匹配

**位置**: `src-tauri/src/commands/ai_config.rs:154`

**原代码**:

```rust
#[derive(Debug, Serialize, Deserialize)]
pub struct TestConnectionRequest {
    pub api_key: String,      // snake_case
    pub base_url: Option<String>,
}
```

**前端代码** (`src/services/commands.ts:213`):

```typescript
const request = { apiKey, baseUrl };  // camelCase
invoke(..., { request }, { autoConvertParams: false });  // ❌ 禁用转换
```

**问题**:

- 前端发送 camelCase，禁用转换
- 后端期望 snake_case
- 反序列化失败

**修复**:

```rust
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")] // ✅ 统一 camelCase
pub struct TestConnectionRequest {
    pub api_key: String,
    pub base_url: Option<String>,
}
```

---

### 问题3: `TestConnectionResult` 字段不匹配

**位置**: `src-tauri/src/commands/ai_config.rs:163`

**修复**: 添加 `#[serde(rename_all = "camelCase")]`

---

### 问题4: `ContextualRefineRequest` 字段不匹配

**位置**: `src-tauri/src/commands/translator.rs:59`

**原代码**:

```rust
pub struct ContextualRefineRequest {
    pub previous_entry: Option<String>,  // snake_case
    pub next_entry: Option<String>,
}
```

**前端代码** (`src/App.tsx:636`):

```typescript
{
  (previous_entry, next_entry);
} // snake_case
// autoConvertParams: true (默认)
// 转换后: previous__entry (双下划线！)
```

**修复**:

1. **后端**: 添加 `#[serde(rename_all = "camelCase")]`
2. **前端类型** (`src/types/tauri.ts`):
   ```typescript
   export interface ContextualRefineRequest {
     previousEntry?: string; // ✅ camelCase
     nextEntry?: string;
   }
   ```
3. **前端使用** (`src/App.tsx`):
   ```typescript
   {
     (previousEntry, nextEntry);
   } // ✅ camelCase
   ```
4. **前端调用** (`src/services/commands.ts`):
   ```typescript
   invoke(..., { requests, targetLanguage }, {
     autoConvertParams: false  // ✅ 禁用转换
   });
   ```

---

## ✅ 修改文件列表

### 后端 (Rust)

1. **`src-tauri/src/commands/ai_config.rs`**
   - `TestConnectionRequest` 添加 `#[serde(rename_all = "camelCase")]`
   - `TestConnectionResult` 添加 `#[serde(rename_all = "camelCase")]`

2. **`src-tauri/src/commands/translator.rs`**
   - `ContextualRefineRequest` 添加 `#[serde(rename_all = "camelCase")]`

3. **其他Tauri命令**（已正确，不需修改）
   - `parse_po_file(file_path)` - Tauri自动转换为 `filePath`
   - `save_po_file(file_path, entries)` - Tauri自动转换为 `filePath`
   - `detect_file_format(file_path)` - Tauri自动转换为 `filePath`
   - `get_file_metadata(file_path)` - Tauri自动转换为 `filePath`
   - `get_default_target_lang(source_lang_code)` - Tauri自动转换为 `sourceLangCode`

### 前端 (TypeScript)

3. **`src/services/apiClient.ts`**
   - 添加 `autoConvertParams?: boolean` 到 `InvokeOptions`
   - 传递该选项到所有内部方法

4. **`src/services/api.ts`**
   - 传递 `autoConvertParams: false` 给 `apiClient` 避免重复转换

5. **`src/services/commands.ts`**
   - **AI配置相关**：`add`、`update`、`testConnection` 添加 `autoConvertParams: false`
   - **翻译相关**：`contextualRefine` 添加 `autoConvertParams: false`
   - **PO文件相关**：`parse`、`save` 添加 `autoConvertParams: false`
   - **文件格式相关**：`detect`、`getMetadata` 添加 `autoConvertParams: false`
   - **语言相关**：`getDefaultTargetLanguage` 添加 `autoConvertParams: false`

6. **`src/types/tauri.ts`**
   - `ContextualRefineRequest` 字段改为 camelCase

7. **`src/App.tsx`**
   - 使用 `previousEntry`、`nextEntry` 代替 `previous_entry`、`next_entry`

### 文档

8. **`docs/CHANGELOG.md`**
   - 添加问题3的详细说明

9. **`specs/001-bug-7/BUGFIX-AI-CONFIG-EDIT.md`**
   - 添加全面检查章节

---

## 🔧 统一规范

### 前后端数据格式规范

**原则**: **前后端统一使用 camelCase**

1. **后端 (Rust)**:
   - 所有 `Serialize`/`Deserialize` 结构体添加 `#[serde(rename_all = "camelCase")]`
   - 字段名内部仍使用 `snake_case`（Rust 惯例）

2. **前端 (TypeScript)**:
   - 所有类型定义使用 camelCase
   - 调用后端时设置 `autoConvertParams: false`

3. **参数转换链路**:
   ```
   commands.ts (autoConvertParams: false)
       ↓
   api.ts (不转换，processedArgs = args)
       ↓
   apiClient.invoke (autoConvertParams: false)
       ↓
   tauriInvoke (autoConvertParams: false)
       ↓
   后端 (期望 camelCase，serde 自动处理)
   ```

---

## 📊 影响范围

### 受影响的 Tauri 命令

**需要 `autoConvertParams: false` 的命令**：

1. ✅ `add_ai_config` - AIConfig 结构体 (camelCase)
2. ✅ `update_ai_config` - AIConfig 结构体 (camelCase)
3. ✅ `test_ai_connection` - TestConnectionRequest 结构体 (camelCase)
4. ✅ `contextual_refine` - ContextualRefineRequest 结构体 (camelCase)
5. ✅ `parse_po_file` - filePath 参数 (Tauri自动转换)
6. ✅ `save_po_file` - filePath 参数 (Tauri自动转换)
7. ✅ `detect_file_format` - filePath 参数 (Tauri自动转换)
8. ✅ `get_file_metadata` - filePath 参数 (Tauri自动转换)
9. ✅ `get_default_target_lang` - sourceLangCode 参数 (Tauri自动转换)

**不需要修改的命令**：

- `translate_batch_with_channel` - 简单参数，自动转换正确 ✅
- `get_system_locale` - 无参数 ✅
- `get_all_ai_configs` - 无参数 ✅
- `translate_entry` - 简单参数（text、targetLanguage）✅

---

## 🧪 验证清单

- [ ] 重新编译前后端
- [ ] 测试 AI 配置保存（add_ai_config）
- [ ] 测试 AI 配置编辑（update_ai_config）
- [ ] 测试连接测试（test_ai_connection）
- [ ] 测试上下文精翻（contextual_refine）
- [ ] 检查所有功能正常工作

---

## 🎓 经验总结

### 根本原因

1. **前后端约定不统一**: 部分结构体使用 snake_case，部分期望 camelCase
2. **硬编码参数转换**: `apiClient.ts` 强制转换，无法自定义
3. **缺乏类型安全检查**: TypeScript 类型与实际数据格式不匹配

### 预防措施

1. **统一规范**:
   - 所有 Rust 结构体添加 `#[serde(rename_all = "camelCase")]`
   - 所有 TypeScript 接口使用 camelCase

2. **代码规范**:
   - 调用后端时明确设置 `autoConvertParams`
   - 不要硬编码转换选项

3. **类型生成**:
   - 考虑使用 `ts-rs` 自动生成 TypeScript 类型
   - 确保前后端类型完全一致

4. **测试覆盖**:
   - 集成测试覆盖所有 Tauri 命令
   - 验证参数序列化/反序列化

---

## 📝 备注

- 本次修复确保了前后端数据格式的完全一致
- 参数转换逻辑更加清晰和可控
- 减少了因字段名不匹配导致的运行时错误
- 提高了代码的可维护性和可读性
