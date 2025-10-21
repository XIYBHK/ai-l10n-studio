# Technical Research: BUG修复技术方案

**Feature**: 关键用户界面和功能问题修复  
**Date**: 2025-10-14  
**Status**: Complete

## 研究目标

解决7个BUG的技术实现细节，确认修复方案的可行性和最佳实践。

## 1. AI配置保存失败 (P1)

### 问题根因分析

从日志可见：

```
invalid args `config` for command `add_ai_config`: missing field `api_key`
```

**根本原因**: 前端序列化 `AIConfig` 对象时，缺少 `api_key` 字段或字段命名不匹配。

### 研究发现

#### 检查点1: Rust 后端期望的数据结构

```rust
// src-tauri/src/commands/config.rs (推测)
#[tauri::command]
pub async fn add_ai_config(config: AIConfig) -> Result<(), String> {
    // config 必须包含 api_key 字段
}
```

#### 检查点2: 前端发送的数据

需要检查 `SettingsModal.tsx` 中的数据准备：

- 是否正确收集表单字段
- 是否正确映射字段名（如 `apiKey` vs `api_key`）
- 是否在"测试连接"和"保存"之间丢失数据

### 决策: 参数序列化修正

**方案**:

1. 在 `SettingsModal.tsx` 中确保所有必填字段都被收集
2. 在 `commands.ts` 的 `aiConfigCommands.add()` 中添加字段验证
3. 使用 TypeScript 类型确保字段完整性

**实施步骤**:

```typescript
// 修复前（假设）
const newConfig = {
  provider: selectedProvider,
  model: selectedModel,
  baseUrl: baseUrl,
  // ❌ 缺少 api_key
};

// 修复后
const newConfig: AIConfig = {
  provider: selectedProvider,
  model: selectedModel,
  api_key: apiKey, // ✅ 显式包含
  base_url: baseUrl || undefined,
};
```

**验证方案**:

- 单元测试：验证配置对象结构
- 集成测试：完整的"测试连接→保存"流程
- 边界测试：空字段、特殊字符

### 替代方案（已拒绝）

- **方案A**: 修改后端兼容性（接受可选 api_key）
  - ❌ 拒绝理由：API密钥是必需的，不应降低验证标准
- **方案B**: 在后端填充默认值
  - ❌ 拒绝理由：违反单一职责原则，前端应发送完整数据

---

## 2. 系统提示词保存失败 (P1)

### 问题根因分析

从日志可见：

```
Command set_system_prompt not found
```

**根本原因**: 前端调用了不存在的命令名称。

### 研究发现

#### 检查点1: 后端注册的命令名称

查看 `src-tauri/src/main.rs`：

```rust
.invoke_handler(tauri::generate_handler![
    // ...
    update_system_prompt,  // ✅ 正确的命令名
    // ...
])
```

#### 检查点2: 前端调用的命令名称

查看错误日志和 `api.ts` 或旧代码：

```typescript
// ❌ 错误的调用
invoke('set_system_prompt', { prompt });

// ✅ 正确的调用
invoke('update_system_prompt', { prompt });
```

### 决策: 命令名称对齐

**方案**:

1. 使用 `commands.ts` 中的 `COMMANDS.SYSTEM_PROMPT_SET`常量（值为 `'update_system_prompt'`）
2. 删除 `api.ts` 中可能存在的旧调用
3. 统一通过 `systemPromptCommands.update()` 调用

**实施步骤**:

```typescript
// src/services/commands.ts
export const COMMANDS = {
  SYSTEM_PROMPT_SET: 'update_system_prompt', // ✅ 与后端一致
};

export const systemPromptCommands = {
  async update(prompt: string) {
    return invoke<void>(COMMANDS.SYSTEM_PROMPT_SET, { prompt });
  },
};

// src/components/SettingsModal.tsx
await systemPromptCommands.update(newPrompt); // ✅ 使用统一接口
```

**验证方案**:

- grep 搜索所有 `set_system_prompt` 调用并替换
- 测试保存自定义提示词
- 测试保存空提示词

### 替代方案（已拒绝）

- **方案A**: 在后端添加 `set_system_prompt` 别名
  - ❌ 拒绝理由：增加维护负担，应统一命名

---

## 3. 语言检测失败 (P1)

### 问题根因分析

从日志可见：

```
invalid args `sourceLangCode` for command `get_default_target_lang`:
command get_default_target_lang missing required key sourceLangCode
```

**根本原因**: 前端使用驼峰命名 `sourceLangCode`，后端期望蛇形命名 `source_lang_code`。

### 研究发现

#### 检查点1: Rust 命令定义

```rust
// src-tauri/src/commands/language.rs (推测)
#[tauri::command]
pub async fn get_default_target_lang(source_lang_code: String) -> Result<String, String> {
    // serde 默认期望蛇形命名
}
```

#### 检查点2: 前端调用

```typescript
// src/App.tsx (错误的调用)
const targetLang = await invoke('get_default_target_lang', {
  sourceLangCode: detectedLang.code, // ❌ 驼峰
});
```

### 决策: 参数命名标准化

**方案**:

1. 统一使用蛇形命名传递参数到 Rust（符合 Rust 约定）
2. 在 `commands.ts` 中封装转换逻辑
3. TypeScript 接口保持驼峰，内部转换为蛇形

**实施步骤**:

```typescript
// src/services/commands.ts
export const languageCommands = {
  async getDefaultTarget(sourceLangCode: string) {
    // 转换参数命名
    return invoke<string>(COMMANDS.LANGUAGE_GET_DEFAULT_TARGET, {
      source_lang_code: sourceLangCode, // ✅ 蛇形命名
    });
  },
};

// src/App.tsx
const targetLang = await languageCommands.getDefaultTarget(detectedLang.code);
```

**验证方案**:

- 测试英语→中文检测
- 测试中文→英语检测
- 测试未知语言处理

### 替代方案（已拒绝）

- **方案A**: 在 Rust 中使用 `#[serde(rename = "sourceLangCode")]`
  - ❌ 拒绝理由：破坏 Rust 命名约定，增加维护复杂度
- **方案B**: 全部使用驼峰命名
  - ❌ 拒绝理由：Rust生态标准是蛇形命名

---

## 4. 主题切换需要点击两次 (P2)

### 问题根因分析

**可能原因**:

1. 状态更新和UI渲染不同步
2. 双重状态管理（Zustand + React state）
3. 事件处理函数中状态读取了旧值

### 研究发现

#### 检查点1: Zustand 状态更新

```typescript
// useAppStore.ts
setTheme: (theme) => set({ theme }),
```

#### 检查点2: 组件状态同步

```typescript
// ThemeModeSwitch.tsx
const handleToggle = () => {
  const newTheme = theme === 'light' ? 'dark' : 'light';
  setTheme(newTheme); // Zustand
  // 可能还有 React.useState 的 setLocalTheme?
};
```

### 决策: 单一状态源

**方案**:

1. 移除组件内部的 React state（如果有）
2. 直接从 Zustand 读取和更新状态
3. 确保 `setTheme` 立即生效（同步操作）
4. 使用 `useEffect` 监听 Zustand 状态变化

**实施步骤**:

```typescript
// ThemeModeSwitch.tsx (修复后)
const theme = useAppStore((state) => state.theme);
const setTheme = useAppStore((state) => state.setTheme);

const handleToggle = () => {
  const newTheme = theme === 'light' ? 'dark' : 'light';
  setTheme(newTheme); // ✅ 直接更新 Zustand，无中间状态
};

// 应用主题
useEffect(() => {
  document.documentElement.setAttribute('data-theme', theme);
}, [theme]);
```

**验证方案**:

- 测试快速连续点击3次
- 测试在不同主题间切换
- 验证持久化（重启后保持）

### 替代方案（已拒绝）

- **方案A**: 使用防抖延迟更新
  - ❌ 拒绝理由：增加延迟，用户体验差
- **方案B**: 强制组件重新渲染
  - ❌ 拒绝理由：不解决根本问题

---

## 5. "跟随系统"主题功能 (P2)

### 研究发现

#### 平台API支持

| 平台        | API                                                 | 可用性          |
| ----------- | --------------------------------------------------- | --------------- |
| **Tauri**   | `window.matchMedia('(prefers-color-scheme: dark)')` | ✅ 支持         |
| **Windows** | 通过 `matchMedia` 检测注册表                        | ✅ Windows 10+  |
| **macOS**   | 原生支持，实时更新                                  | ✅ macOS 10.14+ |
| **Linux**   | 取决于桌面环境（GNOME/KDE）                         | ⚠️ 部分支持     |

### 决策: 使用 matchMedia + 监听器

**方案**:

```typescript
// src/hooks/useTheme.ts
useEffect(() => {
  if (theme !== 'system') return;

  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

  const updateTheme = (e: MediaQueryListEvent | MediaQueryList) => {
    const systemTheme = e.matches ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', systemTheme);
  };

  // 初始化
  updateTheme(mediaQuery);

  // 监听变化
  mediaQuery.addEventListener('change', updateTheme);

  return () => mediaQuery.removeEventListener('change', updateTheme);
}, [theme]);
```

**验证方案**:

- Windows: 设置 → 个性化 → 颜色 切换主题
- macOS: 系统偏好设置 → 通用 → 外观
- 测试应用启动时自动检测

### 替代方案（已拒绝）

- **方案A**: 轮询注册表/配置文件
  - ❌ 拒绝理由：性能差，不实时
- **方案B**: 仅在启动时检测
  - ❌ 拒绝理由：用户切换系统主题后不同步

---

## 6. 语言切换无效 (P2)

### 问题根因分析

**可能原因**:

1. i18next 语言切换后未强制重新渲染
2. 翻译文件未加载
3. 持久化未生效

### 研究发现

#### 检查点1: i18next 配置

```typescript
// src/i18n/config.ts
await i18n.changeLanguage(lng);
```

#### 检查点2: React 集成

需要确保使用 `react-i18next` 的 `useTranslation` hook。

### 决策: 强制刷新 + 持久化

**方案**:

```typescript
// src/components/SettingsModal.tsx
const handleLanguageChange = async (lng: string) => {
  // 1. 更新 i18next
  await i18n.changeLanguage(lng);

  // 2. 持久化到 Tauri Store
  await useSettingsStore.getState().setLanguage(lng);

  // 3. 通知所有组件（通过 SWR 或事件）
  mutate('app-language', lng);

  // 4. 显示成功提示
  message.success(t('settings.languageChanged'));
};
```

**验证方案**:

- 测试所有界面文本是否切换
- 测试重启后语言保持
- 测试翻译缺失的回退行为

### 替代方案（已拒绝）

- **方案A**: 强制刷新整个应用
  - ❌ 拒绝理由：丢失用户操作状态
- **方案B**: 延迟生效（下次启动）
  - ❌ 拒绝理由：用户体验差

---

## 7. 日志目录按钮 (P3)

### 研究发现

#### Tauri Shell Plugin

```rust
use tauri_plugin_shell::ShellExt;

#[tauri::command]
pub async fn open_log_directory(app: tauri::AppHandle) -> Result<(), String> {
    let log_dir = utils::paths::app_log_dir()?;

    // 跨平台打开文件管理器
    #[cfg(target_os = "windows")]
    app.shell().command("explorer")
        .args([log_dir.to_string_lossy().to_string()])
        .spawn()?;

    #[cfg(target_os = "macos")]
    app.shell().command("open")
        .args([log_dir.to_string_lossy().to_string()])
        .spawn()?;

    #[cfg(target_os = "linux")]
    app.shell().command("xdg-open")
        .args([log_dir.to_string_lossy().to_string()])
        .spawn()?;

    Ok(())
}
```

### 决策: 使用 Shell Plugin

**方案**:

1. 在 `src-tauri/src/commands/system.rs` 新增命令
2. 注册到 `main.rs`
3. 前端调用 `systemCommands.openLogDirectory()`

**UI改进**:

```tsx
<Space direction="vertical" size="small">
  <Text>日志级别：{logLevel}</Text>
  <Button icon={<FolderOpenOutlined />} onClick={handleOpenLogDir}>
    打开日志目录
  </Button>
</Space>
```

**验证方案**:

- Windows: 验证打开 Explorer
- macOS: 验证打开 Finder
- Linux: 验证打开文件管理器（Nautilus/Dolphin等）

### 替代方案（已拒绝）

- **方案A**: 复制路径到剪贴板
  - ❌ 拒绝理由：不如直接打开方便
- **方案B**: 在应用内显示日志
  - ❌ 拒绝理由：超出本次修复范围

---

## 技术债务识别

### 需要后续改进的项

1. **统一参数命名约定**:
   - 前端 TypeScript 驼峰 → 后端 Rust 蛇形的转换应在 `commands.ts` 层统一处理
   - 考虑使用 `ts-rs` 自动生成类型避免不一致

2. **错误消息本地化**:
   - 后端错误消息目前是英文，应支持i18n

3. **配置验证**:
   - 前端应在保存前进行完整的字段验证
   - 使用 Zod 或 Yup 统一验证逻辑

4. **主题系统重构** (未来考虑):
   - 支持自定义主题色
   - 支持平滑过渡动画

### 不在本次修复范围

- ❌ 添加新的日志查看界面
- ❌ AI配置的高级选项（代理、超时等）
- ❌ 语言包的动态加载
- ❌ 系统提示词的模板管理

---

## 研究结论

### ✅ 所有7个BUG的修复方案已确定

| 问题       | 根因           | 方案                    | 风险              |
| ---------- | -------------- | ----------------------- | ----------------- |
| AI配置保存 | 字段缺失       | 参数序列化修正          | 低                |
| 系统提示词 | 命令名错误     | 使用正确命令名          | 低                |
| 语言检测   | 参数命名不一致 | 统一蛇形命名            | 低                |
| 主题切换   | 状态不同步     | 单一状态源              | 低                |
| 跟随系统   | 未监听系统事件 | matchMedia监听          | 中（Linux兼容性） |
| 语言切换   | 未强制刷新     | changeLanguage + mutate | 低                |
| 日志目录   | 功能缺失       | 新增Shell命令           | 低                |

### 技术可行性

- ✅ 所有修复方案均基于现有技术栈
- ✅ 无需引入新依赖
- ✅ 符合 Constitution 的所有原则
- ✅ 向后兼容，不破坏现有功能

### 下一步

进入 **Phase 1**: 生成数据模型和API契约
