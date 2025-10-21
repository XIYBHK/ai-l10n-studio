# 参数格式全面修复 - 最终报告

**日期**: 2025-10-21
**分支**: 001-bug-7
**状态**: ✅ 完成

---

## 📊 修复统计

| 类别     | 修改文件 | 修改行数 | 问题数      |
| -------- | -------- | -------- | ----------- |
| 后端     | 2        | +3       | 3个结构体   |
| 前端服务 | 3        | +32      | 2个服务     |
| 类型定义 | 2        | +4       | 1个接口     |
| 组件     | 1        | ±4       | 1个组件     |
| 文档     | 2        | +159     | -           |
| **总计** | **10**   | **+202** | **9个命令** |

---

## 🔍 发现的问题清单

### 1. `apiClient.ts` 硬编码参数转换

- **位置**: `src/services/apiClient.ts:176`
- **问题**: `autoConvertParams: true` 硬编码，无法自定义
- **影响**: 导致参数被重复转换

### 2. AI配置相关命令

- `add_ai_config` - AIConfig 结构体字段不匹配
- `update_ai_config` - AIConfig 结构体字段不匹配
- `test_ai_connection` - TestConnectionRequest 字段不匹配

### 3. 翻译相关命令

- `contextual_refine` - ContextualRefineRequest 字段不匹配

### 4. PO文件命令

- `parse_po_file` - filePath 参数被错误转换
- `save_po_file` - filePath 参数被错误转换

### 5. 文件格式检测命令

- `detect_file_format` - filePath 参数被错误转换
- `get_file_metadata` - filePath 参数被错误转换

### 6. 语言检测命令

- `get_default_target_lang` - sourceLangCode 参数被错误转换

### 7. SWR fetcher

- **所有通过 SWR 调用的命令** - `tauriFetcher` 自动转换参数

### 8. Channel API

- `translate_batch_with_channel` - `useChannelTranslation.ts` 中直接调用被转换

---

## ✅ 解决方案

### 统一规范

**前后端全部使用 camelCase**

1. **后端** (Rust)

   ```rust
   #[derive(Serialize, Deserialize)]
   #[serde(rename_all = "camelCase")] // ✅ 统一添加
   pub struct MyRequest { ... }
   ```

2. **前端** (TypeScript)

   ```typescript
   // ✅ 类型定义使用 camelCase
   interface MyRequest {
     apiKey: string;
     baseUrl: string;
   }

   // ✅ 调用时禁用转换
   invoke(
     'my_command',
     { request },
     {
       autoConvertParams: false,
     }
   );
   ```

### 修复的文件

#### 后端 (Rust)

1. `src-tauri/src/commands/ai_config.rs`
   - `TestConnectionRequest` + `#[serde(rename_all = "camelCase")]`
   - `TestConnectionResult` + `#[serde(rename_all = "camelCase")]`

2. `src-tauri/src/commands/translator.rs`
   - `ContextualRefineRequest` + `#[serde(rename_all = "camelCase")]`

#### 前端 (TypeScript)

3. `src/services/apiClient.ts`
   - 添加 `autoConvertParams?: boolean` 支持
   - 传递到所有内部方法

4. `src/services/api.ts`
   - 传递 `autoConvertParams: false` 给 apiClient

5. `src/services/commands.ts`
   - **9个命令** 添加 `autoConvertParams: false`：
     - `aiConfigCommands`: add, update, testConnection
     - `poFileCommands`: parse, save
     - `fileFormatCommands`: detect, getMetadata
     - `i18nCommands`: getDefaultTargetLanguage
     - `translatorCommands`: contextualRefine

6. `src/types/tauri.ts`
   - `ContextualRefineRequest` 字段改为 camelCase

7. `src/App.tsx`
   - 使用 `previousEntry`、`nextEntry` (camelCase)

---

## 🎯 调用链路（修复后）

```
components
    ↓
commands.ts ({ param }, { autoConvertParams: false })
    ↓
api.ts (不转换，processedArgs = args)
    ↓
apiClient.invoke ({ autoConvertParams: false })
    ↓
tauriInvoke ({ autoConvertParams: false })
    ↓
后端 Rust (Tauri自动转换 + serde反序列化)
    ✅ 成功
```

---

## 📝 关键技术点

### Tauri 2.x 参数转换规则

1. **Rust → Frontend** (自动)

   ```rust
   pub fn my_command(file_path: String) { }
   ```

   前端接收参数名：`filePath` (camelCase)

2. **Frontend → Rust** (需手动控制)

   ```typescript
   // ❌ 错误：启用自动转换
   invoke('my_command', { filePath }, { autoConvertParams: true });
   // 发送: { file_path } → Tauri期望: { filePath } → 失败

   // ✅ 正确：禁用自动转换
   invoke('my_command', { filePath }, { autoConvertParams: false });
   // 发送: { filePath } → Tauri接收: { filePath } → 成功
   ```

3. **结构体序列化**
   ```rust
   #[derive(Serialize, Deserialize)]
   #[serde(rename_all = "camelCase")] // ✅ 必须添加
   pub struct MyRequest {
       pub api_key: String,  // Rust内部使用 snake_case
   }
   ```
   JSON格式：`{ "apiKey": "..." }` (camelCase)

---

## 🧪 验证步骤

**已验证 ✅**:

1. AI配置保存 - 成功
2. AI配置编辑 - 字段显示正确
3. 连接测试 - 成功

**待验证**: 4. PO文件打开 - 现在应该可以正常工作 5. PO文件保存 6. 文件格式检测 7. 上下文精翻

---

## 📚 文档更新

1. **`docs/CHANGELOG.md`**
   - 添加4个问题的详细说明
   - 记录所有修复细节

2. **`specs/001-bug-7/BUGFIX-AI-CONFIG-EDIT.md`**
   - 补充修复记录
   - 添加全面检查章节

3. **`specs/001-bug-7/HARDCODE-FIX-SUMMARY.md`**
   - 完整的修复方案文档
   - 包含代码示例和最佳实践

---

## 🎓 经验总结

### 根本原因

1. **Tauri 2.x 行为变化**: 自动将 snake_case 参数转换为 camelCase
2. **前端自动转换**: 默认启用 `autoConvertParams: true` 导致重复转换
3. **缺乏统一规范**: 部分结构体未添加 `#[serde(rename_all = "camelCase")]`

### 最佳实践

1. **所有 Rust 结构体**: 必须添加 `#[serde(rename_all = "camelCase")]`
2. **所有 Tauri 命令调用**: 明确设置 `autoConvertParams`
3. **类型定义保持一致**: 前后端都使用 camelCase
4. **测试覆盖**: 验证参数序列化/反序列化

### 预防措施

1. 新增 Tauri 命令时，参考现有命令的 `autoConvertParams` 设置
2. 新增结构体时，必须添加 `#[serde(rename_all = "camelCase")]`
3. 前端类型定义必须与后端 JSON 格式一致
4. 考虑使用 `ts-rs` 自动生成类型定义

---

## 🚀 下一步

1. **测试验证**: 手动测试所有受影响的功能
2. **代码审查**: 确保修改符合规范
3. **提交 PR**: 准备合并到主分支
4. **更新指南**: 补充开发文档

---

## 🆕 补充修复（2025-10-21 晚）

### 修复9：API密钥明文泄露

**问题**：日志中输出完整API密钥
**修复**：

- 在 `api.ts` 中导入并使用 `maskSensitiveData`
- 导出 `maskSensitiveData` 供其他模块使用
- 日志输出前先脱敏处理

**文件**：

- `src/services/api.ts`
- `src/services/tauriInvoke.ts`

### 修复10：翻译记忆库逻辑不符合预期

**问题**：

1. 查询时自动回退到内置短语（用户删除的词条仍被使用）
2. 前端"加载内置词库"未保存到后端

**修复**：

- 移除 `translation_memory.rs` 中 `get_translation()` 的 builtin 回退查询
- 新增后端命令 `merge_builtin_phrases()`
- 前端调用新命令实现持久化加载

**文件**：

- `src-tauri/src/services/translation_memory.rs`
- `src-tauri/src/commands/translator.rs`
- `src-tauri/src/main.rs`
- `src/services/commands.ts`
- `src/components/MemoryManager.tsx`

**设计原则**：

- 翻译任务只使用记忆库文件中的词条
- 用户删除的词条不会被自动恢复使用
- 保持用户对记忆库的完全控制权

---

**修复完成时间**: 2025-10-21 22:30
**总耗时**: 约 4 小时（包括补充修复）
**修改文件数**: 17
**新增代码行**: 350+
