# Bug修复：AI配置编辑时字段显示为空

**日期**：2025-10-21  
**问题ID**：编辑已保存的AI配置时，API密钥和URL字段显示为空  
**优先级**：P1（关键）

## 问题描述

用户在设置页面编辑已保存的AI配置时，表单中的API密钥和URL字段显示为空，但实际上这些数据在后端是存在的。

### 复现步骤

1. 添加一个AI配置并保存（包含API密钥和自定义URL）
2. 关闭设置窗口
3. 重新打开设置窗口
4. 点击"编辑"按钮编辑该配置
5. 观察：API密钥和URL字段显示为空

### 预期行为

编辑配置时，应该显示已保存的API密钥和URL值。

## 根本原因

**命名不一致问题**：

- **后端 Rust**：使用 snake_case 命名（`api_key`, `base_url`）
- **前端 TypeScript**：期望 camelCase 命名（`apiKey`, `baseUrl`）
- **问题**：后端返回的JSON包含 `api_key` 字段，但前端尝试访问 `config.apiKey` 时得到 `undefined`

### 日志证据

```typescript
// 从日志可见
hasApiKey: true,      // config.apiKey 存在
apiKeyLength: 0,      // 但长度为0（因为字段名不匹配）
```

实际上，数据在 `config.api_key` 中，而不是 `config.apiKey`。

## 解决方案

### 修改的文件

1. **src-tauri/src/services/ai_translator.rs**
   - `AIConfig` 结构体：添加 `#[serde(rename_all = "camelCase")]`
   - `ProxyConfig` 结构体：添加 `#[serde(rename_all = "camelCase")]`

2. **src-tauri/src/services/config_manager.rs**
   - `AppConfig` 结构体：添加 `#[serde(rename_all = "camelCase")]`
   - `ConfigVersionInfo` 结构体：添加 `#[serde(rename_all = "camelCase")]`

3. **src/services/commands.ts**
   - `aiConfigCommands.add()`: 添加 `autoConvertParams: false`
   - `aiConfigCommands.update()`: 添加 `autoConvertParams: false`
   - `aiConfigCommands.testConnection()`:
     - 修改 `request` 对象使用 camelCase（`apiKey`, `baseUrl`）
     - 添加 `autoConvertParams: false`

### 技术细节

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")] // 🔧 关键修复
pub struct AIConfig {
    pub provider: ProviderType,
    pub api_key: String,       // 序列化为 "apiKey"
    pub base_url: Option<String>, // 序列化为 "baseUrl"
    pub model: Option<String>,
    pub proxy: Option<ProxyConfig>,
}
```

### 工作原理

**后端（Rust）**：

```rust
#[serde(rename_all = "camelCase")]
pub struct AIConfig {
    pub api_key: String,  // 序列化为 "apiKey"
    pub base_url: Option<String>, // 序列化为 "baseUrl"
}
```

**前端（TypeScript）**：

```typescript
// 禁用自动参数转换，保持 camelCase
aiConfigCommands.add(config: AIConfig) {
  return invoke(COMMANDS.AI_CONFIG_ADD, { config }, {
    autoConvertParams: false, // 关键：禁用 snake_case 转换
  });
}
```

**数据流**：

- **序列化**（后端→前端）：`api_key` → `apiKey`（Serde自动转换）
- **反序列化**（前端→后端）：`apiKey` → `apiKey`（不转换，因为禁用了 autoConvertParams）
- **结果**：前后端完全对齐，都使用 camelCase

## 影响范围

### 正向影响

- ✅ 修复编辑AI配置时字段显示为空的问题
- ✅ 统一前后端数据格式（camelCase）
- ✅ 提升代码一致性和可维护性

### 潜在影响

- ⚠️ 所有AI配置的JSON格式变化（从 snake_case 到 camelCase）
- ⚠️ 现有配置文件需要重新保存一次以更新格式
- ⚠️ 需要重新编译后端才能生效

### 向后兼容性

**Serde 的 `rename_all`** 只影响序列化输出格式，但在反序列化时仍然可以**同时接受**两种格式（通过 `#[serde(alias)]` 或 Serde 的灵活解析）。

不过，为了安全起见，建议：

1. 备份现有配置文件
2. 重新测试所有AI配置功能

## 测试验证

### 测试步骤

1. **清理并重新编译**

   ```bash
   cd src-tauri
   cargo clean
   cargo build
   cd ..
   npm run tauri:dev
   ```

2. **添加新配置测试**
   - 打开设置 → AI配置
   - 添加新配置（填写所有字段）
   - 保存并关闭
   - 重新打开设置，点击"编辑"
   - ✅ 验证：所有字段正确显示

3. **编辑现有配置测试**
   - 编辑任意已保存的配置
   - ✅ 验证：API密钥和URL字段正确显示
   - 修改某些字段并保存
   - ✅ 验证：修改成功保存

4. **检查配置文件**

   ```bash
   # Windows
   cat %APPDATA%\ai-l10n-studio\config.json

   # macOS/Linux
   cat ~/.config/ai-l10n-studio/config.json
   ```

   ✅ 验证：`aiConfigs` 数组中的对象使用 camelCase 字段名

### 预期结果

所有测试应该通过，配置编辑功能完全正常。

## 5. 补充修复（2025-10-21 19:48）

### 问题：保存配置时报错

**报错信息**：

```
invalid args `config` for command `add_ai_config`: missing field `apiKey`
```

**日志分析**：

```javascript
[19:48:47.923] [DEBUG] [TauriInvoke] 🔄 参数转换: add_ai_config
args: config: {provider: 'Moonshot', api_key: 'sk-***', base_url: '...'} // 转成了 snake_case!
```

**根本原因**：

- `commands.ts` 虽然设置了 `autoConvertParams: false`
- 但 `apiClient.ts` 的 `executeWithTimeout` **硬编码了** `autoConvertParams: true`
- 导致参数被强制转换为 `snake_case`
- 而后端期望 `camelCase`（已添加 `#[serde(rename_all = "camelCase")]`）

**修复方案**：

1. **`apiClient.ts`**：支持传递 `autoConvertParams` 选项
   - 添加 `autoConvertParams?: boolean` 到 `InvokeOptions`
   - 传递参数到 `executeWithRetry` → `executeWithTimeout` → `tauriInvoke`
   - 不再硬编码 `autoConvertParams: true`

2. **`api.ts`**：避免重复转换
   - 已在 `api.ts` 中转换过参数（如果 `autoConvertParams = true`）
   - 传递 `autoConvertParams: false` 给 `apiClient` 避免重复转换

**调用链路**：

```
commands.ts (autoConvertParams: false)
    ↓
api.ts (不转换，processedArgs = args)
    ↓
apiClient.invoke (autoConvertParams: false)
    ↓
tauriInvoke (autoConvertParams: false)
    ↓
后端 (期望 camelCase)
```

## 6. 全面检查：更多硬编码问题（2025-10-21 20:00）

在修复参数转换链路后，全面检查发现**更多结构体**也存在类似问题：

### 问题列表

1. **`TestConnectionRequest`** (`src-tauri/src/commands/ai_config.rs`)
   - ❌ **原状态**：后端字段 `api_key`、`base_url`（snake_case）
   - ❌ **前端行为**：发送 `{ apiKey, baseUrl }`（camelCase） + `autoConvertParams: false`
   - ❌ **结果**：后端无法反序列化（期望 `api_key` 但收到 `apiKey`）

2. **`TestConnectionResult`** (`src-tauri/src/commands/ai_config.rs`)
   - ❌ **原状态**：后端字段 `response_time_ms`（snake_case）
   - ❌ **前端期望**：`responseTimeMs`（camelCase）

3. **`ContextualRefineRequest`** (`src-tauri/src/commands/translator.rs`)
   - ❌ **原状态**：后端字段 `previous_entry`、`next_entry`（snake_case）
   - ❌ **前端行为**：发送 `{ previous_entry, next_entry }`（snake_case） + `autoConvertParams: true`
   - ❌ **结果**：字段名被转换为 `previous__entry`（双下划线！）

### 统一修复方案

**原则**：**前后端统一使用 camelCase**

1. **后端**：所有请求/响应结构体添加 `#[serde(rename_all = "camelCase")]`
2. **前端**：类型定义使用 camelCase，调用时设置 `autoConvertParams: false`

**修改文件**：

- `src-tauri/src/commands/ai_config.rs`:
  - `TestConnectionRequest` ✅
  - `TestConnectionResult` ✅
- `src-tauri/src/commands/translator.rs`:
  - `ContextualRefineRequest` ✅
- `src/types/tauri.ts`:
  - `ContextualRefineRequest` 类型定义改为 camelCase ✅
- `src/App.tsx`:
  - 使用 `previousEntry`、`nextEntry` ✅
- `src/services/commands.ts`:
  - `contextualRefine` 添加 `autoConvertParams: false` ✅

## 7. 回滚方案

如果修复导致问题：

1. **代码回滚**

   ```bash
   git diff HEAD src-tauri/src/services/ai_translator.rs
   git diff HEAD src-tauri/src/services/config_manager.rs
   # 手动移除 #[serde(rename_all = "camelCase")]
   ```

2. **配置迁移**
   - 如果配置文件格式已更新，需要手动将 camelCase 改回 snake_case
   - 或删除配置文件重新配置

## 相关问题

- **001-bug-7 US1**：AI配置保存失败（已修复，参数转换问题）
- **此问题**：AI配置编辑时显示为空（字段命名不一致）

两者都是前后端数据格式不匹配问题，但表现不同：

- US1：保存时参数传递错误
- 此问题：读取时字段名不匹配

## 备注

- 修复后，所有后端返回的配置数据都将使用 camelCase
- 前端的 tauriInvoke.ts 参数转换系统仍然有效（用于顶层参数）
- TypeScript 接口定义现在与实际数据格式完全匹配
