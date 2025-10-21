# 🔌 AI L10n Studio 插件示例

这个目录包含了 **Phase 3: 完全插件化架构** 的示例插件，展示如何创建自定义 AI 供应商插件。

## 🎯 插件化架构的威力

**添加新供应商的步骤**：

1. 创建插件目录（如 `plugins/my-provider/`）
2. 添加 `plugin.toml` 配置文件
3. 实现 `provider.rs` 文件
4. **🎉 自动生效！无需修改任何现有代码**

## 📁 示例插件

### 1. Claude AI (`claude-ai/`)

- **功能**: Anthropic Claude 系列模型
- **特色**: 多模型支持、图像理解、详细配置
- **文件**:
  - `plugin.toml` - 插件配置和元数据
  - `provider.rs` - 供应商实现
  - `models.rs` - 详细的模型定义和工具

### 2. Google Gemini (`gemini-ai/`)

- **功能**: Google Gemini 多模态模型
- **特色**: 超长上下文、缓存支持、多模态能力
- **亮点**: 展示缓存定价和多模态配置

### 3. 自定义 LLM (`custom-llm/`)

- **功能**: 本地或私有 LLM 服务
- **特色**: OpenAI 兼容 API、多种认证方式、提示词格式
- **支持**: Ollama、LocalAI、vLLM、LM Studio

## 🚀 如何使用这些插件

### 方法 1: 复制到应用插件目录

```bash
# 将示例插件复制到应用的插件目录
cp -r example-plugins/* ~/.config/ai-l10n-studio/plugins/
# 或者 Windows:
# copy example-plugins\* "%APPDATA%\ai-l10n-studio\plugins\"
```

### 方法 2: 在开发工具中测试

1. 启动 AI L10n Studio 开发服务器
2. 打开 **开发者工具**（Ctrl+Shift+I 或从菜单）
3. 切换到 **"供应商测试"** 标签
4. 点击 **"运行完整测试套件"**
5. 查看插件是否被正确加载

### 方法 3: 修改插件路径（开发测试）

在 `src-tauri/src/utils/init.rs` 中修改插件目录：

```rust
// 将插件目录指向示例插件
let plugins_dir = std::path::PathBuf::from("example-plugins");
plugin_loader::init_global_plugin_loader(&plugins_dir)?;
```

## 📋 插件文件结构

```
your-plugin/
├── plugin.toml          # 必需：插件配置和元数据
├── provider.rs          # 必需：AIProvider trait 实现
└── models.rs           # 可选：详细的模型定义
```

### plugin.toml 格式

```toml
[plugin]
name = "Your Plugin Name"
id = "your_plugin_id"        # 小写，下划线分隔
version = "1.0.0"            # 语义版本
api_version = "1.0"          # 支持的 API 版本
description = "插件描述"
author = "Your Name"

[provider]
display_name = "显示名称"
default_url = "https://api.example.com/v1"
default_model = "default-model-id"
supports_cache = true
supports_images = false

[models]
recommended_model = "推荐的模型ID"
disabled_models = ["old-model"]

[models.overrides."model-id"]
name = "自定义模型名称"
description = "自定义描述"
recommended = true
```

### provider.rs 模板

```rust
use super::super::super::provider::AIProvider;
use super::super::super::ModelInfo;

pub struct YourProvider;

impl AIProvider for YourProvider {
    fn id(&self) -> &'static str { "your_provider" }
    fn display_name(&self) -> &'static str { "Your Provider" }
    fn default_url(&self) -> &'static str { "https://api.example.com/v1" }
    fn default_model(&self) -> &'static str { "default-model" }

    fn get_models(&self) -> Vec<ModelInfo> {
        vec![
            ModelInfo {
                id: "your-model".to_string(),
                name: "Your Model".to_string(),
                max_input_tokens: 8192,
                max_output_tokens: 2048,
                input_price: 1.0,
                output_price: 2.0,
                // ... 其他字段
            }
        ]
    }
}
```

## 🧪 测试插件

### 1. 配置验证

```bash
# 验证 TOML 配置语法
toml-validate plugin.toml
```

### 2. 代码检查

```bash
# 检查 Rust 代码语法
cargo check
```

### 3. 运行测试

```bash
# 运行插件测试
cargo test
```

### 4. 应用内测试

- 开发者工具 → 供应商测试 → 运行测试套件
- 设置界面 → AI 配置 → 查看是否出现新供应商

## 🔧 高级功能

### 1. 缓存支持

```toml
[provider]
supports_cache = true
```

```rust
ModelInfo {
    supports_cache: true,
    cache_reads_price: Some(0.1),   # 缓存读取价格
    cache_writes_price: Some(1.2),  # 缓存写入价格
    // ...
}
```

### 2. 图像支持

```toml
[provider]
supports_images = true
```

```rust
ModelInfo {
    supports_images: true,
    // ...
}
```

### 3. 自定义配置

```toml
[provider.extra_config]
custom_param = "value"
special_header = "X-Custom-Header"
```

### 4. 模型覆盖

```toml
[models.overrides."specific-model"]
name = "自定义名称"
description = "自定义描述"
recommended = true
```

## 🐛 故障排除

### 常见问题

1. **插件未加载**
   - 检查 `plugin.toml` 语法
   - 确认插件ID唯一
   - 查看应用日志

2. **模型不显示**
   - 检查 `get_models()` 实现
   - 确认模型ID有效
   - 验证价格和参数

3. **配置错误**
   - 使用 `cargo check` 检查语法
   - 确认 trait 实现完整
   - 检查导入路径

### 调试技巧

1. **查看日志**：开发者工具 → 后端日志
2. **运行测试**：供应商测试 → 运行完整测试套件
3. **检查注册**：调用 `get_all_providers()` API

## 📚 相关文档

- [PHASE3-DESIGN.md](../PHASE3-DESIGN.md) - 插件化架构设计
- [Architecture.md](../docs/Architecture.md) - 整体架构文档
- [API.md](../docs/API.md) - API 参考文档

## 🤝 贡献插件

欢迎贡献新的插件示例！请确保：

1. 遵循插件规范和命名约定
2. 包含完整的测试用例
3. 提供清晰的文档和注释
4. 使用真实的模型信息和定价

---

**🎉 享受插件化的威力！** 现在添加新的 AI 供应商只需几分钟，无需修改任何现有代码！
