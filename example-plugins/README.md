# TOML 插件示例

本目录包含 Anthropic、Gemini OpenAI 兼容接口和本地兼容服务的配置示例，不参与应用默认打包。模型 ID 是占位值，须替换为服务实际开放的模型；示例不提供价格或能力承诺。

每个插件仅需 `plugin.toml`。`provider.rs`、`models.rs` 不会被动态编译或加载，旧示例源码已移除。供应商 HTTP 行为由 Rust `ModelApi` 三协议实现；超时、代理、密钥等来自应用中的供应商配置。

- `[plugin]`：id、name、version、api_version 等元数据。
- `[provider]`：api、display_name、default_url、default_model、supports_cache、supports_images。
- `[[provider.models]]`：有已知模型目录时填写 id/name/context_window/max_output_tokens/input_price/output_price，缓存价格可省略。
- 缓存价格省略时按普通输入价估算，显式零价保持零；价格单位 USD/百万 token。
- 不支持 extra_config、独立 models.overrides 等旧方案字段；未知字段会导致该配置加载失败。

完整目录实例见 [plugins](../plugins)，解析与校验见 [plugin_config.rs](../src-tauri/src/services/ai/plugin_config.rs)。

debug 从工作区 plugins 加载，release 从资源目录 `_up_/plugins` 加载；不扫描任意用户目录。修改应用目录后重新启动并检查加载日志。目录缺失、全部插件无效时初始化失败。

普通私有端点通常直接在设置中“添加自定义 API”，无需维护插件目录。相关说明：[架构](../docs/Architecture.md)、[数据契约](../docs/DataContract.md)。
