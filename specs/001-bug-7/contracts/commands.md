# Tauri Commands API Contract

**Feature**: BUG修复相关命令接口  
**Date**: 2025-10-14  
**Protocol**: Tauri IPC (JSON-RPC style)

## 命令清单

本次修复涉及的 Tauri 命令接口定义。

---

## 1. AI配置管理

### 1.1 添加AI配置

**命令名**: `add_ai_config`

**参数**:

| 参数名   | 类型     | 必需 | 描述             |
| -------- | -------- | ---- | ---------------- |
| `config` | AIConfig | ✅   | 完整的AI配置对象 |

**AIConfig 结构**:

```typescript
{
  id: string;           // UUID v4
  name: string;         // 配置名称
  provider: ProviderType;  // AI提供商
  api_key: string;      // API密钥（必需）
  model: string;        // 模型名称
  base_url?: string;    // 可选的自定义端点
  is_active: boolean;   // 是否激活
}
```

**返回值**:

```typescript
Result<void, string>; // 成功返回空，失败返回错误消息
```

**错误码**:

| 错误消息                                                                     | 原因              | HTTP等价           |
| ---------------------------------------------------------------------------- | ----------------- | ------------------ |
| "invalid args `config` for command `add_ai_config`: missing field `api_key`" | 缺少api_key字段   | 400 Bad Request    |
| "API密钥不能为空"                                                            | api_key为空字符串 | 400 Bad Request    |
| "不支持的AI提供商：{provider}"                                               | 无效的provider    | 400 Bad Request    |
| "配置保存失败"                                                               | 文件系统错误      | 500 Internal Error |

**前端调用示例**:

```typescript
import { aiConfigCommands } from '@/services/commands';

const newConfig: AIConfig = {
  id: nanoid(),
  name: 'My Moonshot Config',
  provider: 'Moonshot',
  api_key: 'sk-xxx...', // ✅ 必须包含
  model: 'moonshot-v1-8k',
  is_active: false,
};

await aiConfigCommands.add(newConfig);
```

**🐛 BUG修复点**:

- ✅ 确保前端传递完整的 `config` 对象，包括 `api_key` 字段
- ✅ 字段命名使用蛇形（Rust约定）：`api_key` 而非 `apiKey`

---

### 1.2 测试AI连接

**命令名**: `test_ai_connection`

**参数**:

| 参数名   | 类型     | 必需 | 描述         |
| -------- | -------- | ---- | ------------ |
| `config` | AIConfig | ✅   | 要测试的配置 |

**返回值**:

```typescript
Result<TestConnectionResult, string>;

interface TestConnectionResult {
  success: boolean;
  message: string;
  latency_ms?: number;
}
```

**说明**: 此命令当前工作正常，无需修复。

---

## 2. 系统提示词管理

### 2.1 获取系统提示词

**命令名**: `get_system_prompt`

**参数**: 无

**返回值**:

```typescript
Result<string, string>; // 返回提示词内容
```

---

### 2.2 更新系统提示词

**命令名**: `update_system_prompt` ⚠️ **注意命名**

**参数**:

| 参数名   | 类型   | 必需 | 描述           |
| -------- | ------ | ---- | -------------- |
| `prompt` | string | ✅   | 新的提示词内容 |

**返回值**:

```typescript
Result<void, string>;
```

**错误码**:

| 错误消息                              | 原因                  |
| ------------------------------------- | --------------------- |
| "Command set_system_prompt not found" | ❌ 使用了错误的命令名 |
| "提示词长度超过限制（10000字符）"     | prompt 过长           |
| "保存系统提示词失败"                  | 文件系统错误          |

**前端调用示例**:

```typescript
import { systemPromptCommands } from '@/services/commands';

// ❌ 错误的调用（导致BUG）
await invoke('set_system_prompt', { prompt: newPrompt });

// ✅ 正确的调用（修复后）
await systemPromptCommands.update(newPrompt);
```

**命令层封装**:

```typescript
// src/services/commands.ts
export const COMMANDS = {
  SYSTEM_PROMPT_SET: 'update_system_prompt', // ✅ 正确的命令名
};

export const systemPromptCommands = {
  async update(prompt: string) {
    return invoke<void>(COMMANDS.SYSTEM_PROMPT_SET, { prompt });
  },
};
```

**🐛 BUG修复点**:

- ✅ 使用正确的命令名: `update_system_prompt`（而非 `set_system_prompt`）
- ✅ 通过 `commands.ts` 统一调用，避免硬编码命令名

---

### 2.3 重置系统提示词

**命令名**: `reset_system_prompt`

**参数**: 无

**返回值**:

```typescript
Result<void, string>;
```

**说明**: 恢复到默认提示词。

---

## 3. 语言检测与推荐

### 3.1 检测文本语言

**命令名**: `detect_text_language`

**参数**:

| 参数名 | 类型   | 必需 | 描述             |
| ------ | ------ | ---- | ---------------- |
| `text` | string | ✅   | 要检测的文本样本 |

**返回值**:

```typescript
Result<LanguageDetection, string>;

interface LanguageDetection {
  code: string; // ISO 639-1语言代码
  name: string; // 语言显示名称
  confidence: number; // 置信度 0.0-1.0
}
```

---

### 3.2 获取默认目标语言

**命令名**: `get_default_target_lang`

**参数**:

| 参数名             | 类型   | 必需 | 描述       |
| ------------------ | ------ | ---- | ---------- |
| `source_lang_code` | string | ✅   | 源语言代码 |

⚠️ **参数命名**: 必须使用 `source_lang_code`（蛇形命名），而非 `sourceLangCode`

**返回值**:

```typescript
Result<string, string>; // 返回推荐的目标语言代码
```

**错误码**:

| 错误消息                                                                                                                                   | 原因                 |
| ------------------------------------------------------------------------------------------------------------------------------------------ | -------------------- |
| "invalid args `sourceLangCode` for command `get_default_target_lang`: command get_default_target_lang missing required key sourceLangCode" | ❌ 使用了驼峰命名    |
| "获取默认目标语言失败"                                                                                                                     | 通用错误（前端显示） |

**前端调用示例**:

```typescript
import { languageCommands } from '@/services/commands';

// ❌ 错误的调用（导致BUG）
const targetLang = await invoke('get_default_target_lang', {
  sourceLangCode: 'en', // ❌ 驼峰命名
});

// ✅ 正确的调用（修复后）
const targetLang = await languageCommands.getDefaultTarget('en');
```

**命令层封装**:

```typescript
// src/services/commands.ts
export const languageCommands = {
  async getDefaultTarget(sourceLangCode: string) {
    return invoke<string>(COMMANDS.LANGUAGE_GET_DEFAULT_TARGET, {
      source_lang_code: sourceLangCode, // ✅ 转换为蛇形命名
    });
  },
};
```

**🐛 BUG修复点**:

- ✅ 参数名使用蛇形: `source_lang_code`（Rust约定）
- ✅ 在 `commands.ts` 层统一处理命名转换
- ✅ TypeScript 接口保持驼峰，内部转换为蛇形

---

## 4. 系统集成命令

### 4.1 打开日志目录

**命令名**: `open_log_directory` 🆕

**参数**: 无

**返回值**:

```typescript
Result<void, string>;
```

**平台行为**:

| 平台    | 行为                         | 使用命令             |
| ------- | ---------------------------- | -------------------- |
| Windows | 打开 Explorer 定位到日志目录 | `explorer {log_dir}` |
| macOS   | 打开 Finder 定位到日志目录   | `open {log_dir}`     |
| Linux   | 打开默认文件管理器           | `xdg-open {log_dir}` |

**错误码**:

| 错误消息               | 原因               |
| ---------------------- | ------------------ |
| "日志目录不存在"       | 目录未创建         |
| "无法打开文件管理器"   | shell 命令执行失败 |
| "没有权限访问日志目录" | 权限问题           |

**前端调用示例**:

```typescript
import { systemCommands } from '@/services/commands';

const handleOpenLogDir = async () => {
  try {
    await systemCommands.openLogDirectory();
    message.success('已打开日志目录');
  } catch (error) {
    message.error(`打开失败: ${error}`);
  }
};
```

**后端实现示例**:

```rust
#[tauri::command]
pub async fn open_log_directory(app: tauri::AppHandle) -> Result<(), String> {
    let log_dir = utils::paths::app_log_dir()
        .map_err(|e| format!("获取日志目录失败: {}", e))?;

    if !log_dir.exists() {
        return Err("日志目录不存在".to_string());
    }

    #[cfg(target_os = "windows")]
    app.shell()
        .command("explorer")
        .args([log_dir.to_string_lossy().to_string()])
        .spawn()
        .map_err(|e| format!("无法打开文件管理器: {}", e))?;

    #[cfg(target_os = "macos")]
    app.shell()
        .command("open")
        .args([log_dir.to_string_lossy().to_string()])
        .spawn()
        .map_err(|e| format!("无法打开文件管理器: {}", e))?;

    #[cfg(target_os = "linux")]
    app.shell()
        .command("xdg-open")
        .args([log_dir.to_string_lossy().to_string()])
        .spawn()
        .map_err(|e| format!("无法打开文件管理器: {}", e))?;

    Ok(())
}
```

**🆕 新增功能**:

- 需要在 `main.rs` 中注册此命令
- 需要在 `commands.ts` 中添加对应接口

---

## 5. 配置管理

### 5.1 获取应用配置

**命令名**: `get_app_config`

**参数**: 无

**返回值**:

```typescript
Result<AppConfig, string>;
```

**说明**: 当前工作正常，无需修复。

---

### 5.2 更新应用配置

**命令名**: `update_app_config`

**参数**:

| 参数名   | 类型      | 必需 | 描述           |
| -------- | --------- | ---- | -------------- |
| `config` | AppConfig | ✅   | 完整的应用配置 |

**返回值**:

```typescript
Result<void, string>;
```

**说明**: 当前工作正常，无需修复。

---

## 命令注册检查清单

确保以下命令已在 `src-tauri/src/main.rs` 中注册：

```rust
tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![
        // ... 现有命令 ...

        // ✅ AI配置
        add_ai_config,
        test_ai_connection,

        // ✅ 系统提示词
        get_system_prompt,
        update_system_prompt,   // ⚠️ 确保命令名正确
        reset_system_prompt,

        // ✅ 语言检测
        detect_text_language,
        get_default_target_lang,

        // 🆕 系统集成
        open_log_directory,     // 需要新增
    ])
```

---

## 错误处理约定

### 后端（Rust）

所有命令使用 `Result<T, String>` 返回类型：

```rust
#[tauri::command]
pub async fn some_command(param: Type) -> Result<ReturnType, String> {
    // 业务逻辑
    operation().map_err(|e| format!("具体错误原因: {}", e))?;
    Ok(result)
}
```

**错误消息格式**:

- ✅ "具体错误原因和上下文"
- ❌ "操作失败"（过于通用）

### 前端（TypeScript）

通过 `commands.ts` 统一处理：

```typescript
async function invoke<T>(
  command: string,
  args?: Record<string, unknown>,
  options?: InvokeOptions
): Promise<T> {
  try {
    return await tauriInvoke<T>(command, args);
  } catch (error) {
    const errorMessage = options?.errorMessage || `${command} 执行失败`;
    log.error(`[API] API调用失败: ${command}: ${errorMessage}`, { error });
    throw new Error(errorMessage);
  }
}
```

---

## 参数命名约定

### 前后端命名转换规则

| 层次            | 命名风格 | 示例               |
| --------------- | -------- | ------------------ |
| TypeScript 接口 | 驼峰命名 | `sourceLangCode`   |
| Tauri IPC 参数  | 蛇形命名 | `source_lang_code` |
| Rust 函数参数   | 蛇形命名 | `source_lang_code` |

**转换位置**: 在 `commands.ts` 层统一处理

```typescript
// 用户调用（驼峰）
languageCommands.getDefaultTarget(sourceLangCode);

// 内部转换（蛇形）
invoke('get_default_target_lang', { source_lang_code: sourceLangCode });
```

---

## 测试覆盖

每个命令应有以下测试：

### 单元测试（Rust）

- ✅ 正常参数测试
- ✅ 缺少必需参数测试
- ✅ 无效参数类型测试
- ✅ 边界条件测试

### 集成测试（TypeScript）

- ✅ 完整调用流程测试
- ✅ 错误处理测试
- ✅ 并发调用测试

---

## 版本兼容性

本次修复保持 API 向后兼容：

- ✅ 不删除现有命令
- ✅ 不更改现有命令的参数结构
- ✅ 仅修正命令名称和参数命名（从错误修正为正确）

**破坏性变更**: 无
