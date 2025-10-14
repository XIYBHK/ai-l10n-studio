# Data Model: BUG修复相关数据结构

**Feature**: 关键用户界面和功能问题修复  
**Date**: 2025-10-14  
**Purpose**: 定义修复涉及的核心数据结构

## 核心实体

### 1. AI配置 (AIConfig)

用于存储AI翻译服务提供商的配置信息。

**字段定义**:

| 字段名 | 类型 | 必需 | 描述 | 验证规则 |
|--------|------|------|------|---------|
| `id` | String | ✅ | 配置唯一标识符 | UUID v4格式 |
| `name` | String | ✅ | 配置显示名称 | 1-50字符 |
| `provider` | ProviderType | ✅ | AI提供商类型 | 枚举值 |
| `api_key` | String | ✅ | API密钥 | 非空字符串，最少8字符 |
| `model` | String | ✅ | 模型名称 | 依赖provider的可用模型列表 |
| `base_url` | String | ❌ | 自定义API端点 | 有效URL格式（可选） |
| `is_active` | Boolean | ✅ | 是否为当前活动配置 | 默认false |
| `created_at` | Timestamp | ✅ | 创建时间 | ISO 8601格式 |
| `updated_at` | Timestamp | ✅ | 最后更新时间 | ISO 8601格式 |

**状态转换**:

```
[新建] --保存--> [已保存]
[已保存] --激活--> [活动中]
[活动中] --停用--> [已保存]
[已保存] --删除--> [已删除]
```

**验证规则**:
- `api_key` 不能为空字符串
- `api_key` 不能仅包含空格
- 同一时间只能有一个配置处于 `is_active = true` 状态
- `provider` + `model` 组合必须有效

**错误场景**:
- 缺少 `api_key` → 错误："API密钥不能为空"
- 无效的 `provider` → 错误："不支持的AI提供商：{provider}"
- 无效的 `model` → 错误："模型 {model} 不适用于 {provider}"

---

### 2. 提供商类型 (ProviderType)

AI服务提供商的枚举类型。

**枚举值**:

| 值 | 显示名称 | 支持的模型示例 |
|----|----------|---------------|
| `Moonshot` | Moonshot AI | `moonshot-v1-8k`, `moonshot-v1-32k` |
| `OpenAI` | OpenAI | `gpt-3.5-turbo`, `gpt-4` |
| `iFlytek` | 讯飞星火 | `spark-v3.0` |
| `Baidu` | 百度文心 | `ernie-bot-4` |
| `Alibaba` | 阿里通义 | `qwen-turbo` |
| `Zhipu` | 智谱AI | `glm-4` |
| `Claude` | Anthropic Claude | `claude-3-opus` |
| `Gemini` | Google Gemini | `gemini-pro` |

---

### 3. 系统提示词 (SystemPrompt)

自定义的AI翻译指导文本。

**字段定义**:

| 字段名 | 类型 | 必需 | 描述 | 验证规则 |
|--------|------|------|------|---------|
| `content` | String | ✅ | 提示词内容 | 0-10000字符 |
| `updated_at` | Timestamp | ✅ | 最后更新时间 | ISO 8601格式 |
| `is_default` | Boolean | ✅ | 是否使用默认提示词 | - |

**默认值**:
```
你是一名专业的翻译专家，请将以下文本翻译成{目标语言}。
要求：
1. 保持原文的语气和风格
2. 确保术语翻译一致
3. 注意上下文相关性
4. 保留特殊格式（如变量占位符）
```

**验证规则**:
- 允许空字符串（使用默认提示词）
- 最大长度10000字符
- 支持多行文本
- 支持特殊字符和Emoji

**错误场景**:
- 超过10000字符 → 错误："提示词长度超过限制（10000字符）"

---

### 4. 主题设置 (ThemeSettings)

应用外观主题配置。

**字段定义**:

| 字段名 | 类型 | 必需 | 描述 | 可选值 |
|--------|------|------|------|--------|
| `theme_mode` | ThemeMode | ✅ | 主题模式 | `light`, `dark`, `system` |
| `actual_theme` | ActualTheme | ✅ | 实际生效的主题 | `light`, `dark` |

**ThemeMode 枚举**:

| 值 | 描述 | 行为 |
|----|------|------|
| `light` | 亮色 | 强制使用亮色主题 |
| `dark` | 暗色 | 强制使用暗色主题 |
| `system` | 跟随系统 | 根据操作系统设置自动切换 |

**状态计算逻辑**:
```
if theme_mode == "system":
    actual_theme = detect_system_theme()  # 'light' or 'dark'
else:
    actual_theme = theme_mode
```

**持久化**:
- 存储在 Tauri Store 中
- Key: `settings.theme`
- 启动时自动加载

---

### 5. 语言偏好 (LanguagePreference)

用户界面语言设置。

**字段定义**:

| 字段名 | 类型 | 必需 | 描述 | 可选值 |
|--------|------|------|------|--------|
| `language` | LanguageCode | ✅ | 界面语言代码 | `zh-CN`, `en-US` |

**LanguageCode 枚举**:

| 值 | 语言 | 翻译文件 |
|----|------|---------|
| `zh-CN` | 简体中文 | `src/i18n/locales/zh-CN.json` |
| `en-US` | English | `src/i18n/locales/en-US.json` |

**持久化**:
- 存储在 Tauri Store 中
- Key: `settings.language`
- 启动时自动加载并应用

**回退机制**:
- 如果翻译缺失，回退到 `zh-CN`（默认语言）
- 记录警告日志但不阻塞应用

---

### 6. 语言检测结果 (LanguageDetection)

文件源语言检测的结果。

**字段定义**:

| 字段名 | 类型 | 必需 | 描述 |
|--------|------|------|------|
| `code` | String | ✅ | 语言代码（ISO 639-1） |
| `name` | String | ✅ | 语言显示名称 |
| `confidence` | Float | ✅ | 检测置信度（0.0-1.0） |

**示例**:
```json
{
  "code": "en",
  "name": "English",
  "confidence": 0.98
}
```

**关系**:
- 用于确定默认目标语言
- 调用 `get_default_target_lang(source_lang_code)` 获取推荐的目标语言

---

### 7. 日志配置 (LogConfiguration)

日志系统的配置信息。

**字段定义**:

| 字段名 | 类型 | 必需 | 描述 |
|--------|------|------|------|
| `log_level` | LogLevel | ✅ | 日志级别 |
| `log_directory` | PathBuf | ✅ | 日志文件目录 |
| `max_file_size` | u64 | ✅ | 单个日志文件最大大小（字节） |
| `max_files` | u32 | ✅ | 保留的日志文件数量 |
| `retention_days` | u32 | ✅ | 日志文件保留天数 |

**LogLevel 枚举**:
- `trace`, `debug`, `info`, `warn`, `error`

**默认值**:
- `log_level`: `info`
- `log_directory`: `{app_data}/logs/`
- `max_file_size`: 128KB (131072 bytes)
- `max_files`: 8
- `retention_days`: 30

---

## 数据关系图

```
AppConfig (根配置)
├── ai_configs: Vec<AIConfig>          # AI配置列表
├── active_ai_config_id: Option<String>  # 当前活动配置ID
├── system_prompt: SystemPrompt        # 系统提示词
└── (其他全局配置...)

UserPreferences (用户偏好 - Tauri Store)
├── theme_mode: ThemeMode              # 主题模式
├── language: LanguageCode             # 界面语言
└── (其他偏好设置...)

RuntimeState (运行时状态 - 不持久化)
├── detected_language: Option<LanguageDetection>  # 检测的源语言
├── selected_target_lang: Option<String>          # 选择的目标语言
└── actual_theme: ActualTheme                     # 实际生效的主题
```

---

## 数据验证清单

### AI配置保存前验证

- [ ] `api_key` 字段存在且非空
- [ ] `provider` 是有效的枚举值
- [ ] `model` 适用于选定的 `provider`
- [ ] `base_url`（如果提供）是有效的 URL
- [ ] `name` 长度在 1-50 字符之间

### 系统提示词保存前验证

- [ ] `content` 长度 ≤ 10000 字符
- [ ] 字符串编码有效（UTF-8）

### 主题切换验证

- [ ] `theme_mode` 是有效的枚举值
- [ ] 如果是 `system`，能够检测操作系统主题

### 语言切换验证

- [ ] `language` 是支持的语言代码
- [ ] 对应的翻译文件存在
- [ ] i18next 已初始化

---

## 迁移策略

本次修复不涉及数据结构变更，无需迁移脚本。

**向后兼容性**:
- ✅ 所有修复保持现有数据结构
- ✅ 新增字段（如有）使用可选类型或默认值
- ✅ 不删除或重命名现有字段

---

## 测试数据示例

### 有效的AI配置
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Moonshot Default",
  "provider": "Moonshot",
  "api_key": "sk-aBcDeFgHiJkLmNoPqRsTuVwXyZ123456",
  "model": "moonshot-v1-8k",
  "base_url": null,
  "is_active": true,
  "created_at": "2025-10-14T07:29:00Z",
  "updated_at": "2025-10-14T07:29:00Z"
}
```

### 无效的AI配置（缺少api_key）
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Invalid Config",
  "provider": "OpenAI",
  "model": "gpt-4"
  // ❌ 缺少 api_key
}
```
**预期错误**: "API密钥不能为空"

