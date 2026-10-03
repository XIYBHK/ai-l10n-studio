# AI L10n Studio

Tauri 2 + React 19 + TypeScript + Rust 桌面 PO 翻译工具。当前主编辑流程面向 gettext `.po`：AI 结果进入文档并标记待审核，明确确认后才收录到翻译记忆库；文档写入磁盘仍需保存。

## 当前能力

- PO 是当前主编辑格式；JSON 仅用于检测和元信息，XLIFF/YAML 当前不支持翻译编辑。
- AI 配置使用 `ConfigDraft` 事务模型，以稳定 `providerId` 管理多个模型，并单独选择 `defaultModel`。
- `config.json` 保存公开配置，API key 按供应商 ID 写入同目录 `config.secrets.json`；查询仅返回 `hasApiKey` 状态。
- 快速预设：DeepSeek、Qwen、Kimi、Zhipu、MiniMax、SiliconFlow。TOML 目录另含 OpenAI、Moonshot、DeepSeek、Gemini、MiniMax、Zhipu。Rust 请求层支持 OpenAI Completions、OpenAI Responses、Anthropic Messages；Gemini 使用 OpenAI 兼容接口。
- 翻译记忆库和术语库按 `revision` 原子写入，冲突拒绝提交；记录按上下文和语言隔离，旧格式不自动迁移。
- 新建目标语言文档会保留原文和上下文并清空译文，需另存为独立文件。
- 插件自动升级依赖仍存在，但当前主流程未启用自动升级。

## 环境与安装

Node.js 要求 `^20.19.0 || ^22.12.0 || >=24.0.0`，与 Vite/jsdom 的已安装版本一致；npm `>=9.0.0`。开发还需要 stable Rust；Windows 需要 Visual Studio C++ Build Tools 和 WebView2。PowerShell 7：

```powershell
npm install
npm run tauri:dev
```

常用检查：

```powershell
npm run test:run
npm run format:check
npm run i18n:check
cd src-tauri
cargo test --locked --features ts-rs --quiet
```

## 构建与便携包

```powershell
npm run tauri:build
npm run tauri:portable
```

便携包包含 exe、`_up_/plugins/` 和 `.config/PORTABLE`，不包含个人配置、翻译记忆库或 API key。

## 文档入口

- [文档索引](./docs/README.md)
- [数据契约](./docs/DataContract.md)
- [安全说明](./docs/SECURITY_NOTES.md)
- [主题指南](./docs/THEME.md)
- [颜色系统](./docs/COLOR_SYSTEM.md)
- [错误目录](./docs/ERRORS.md)

`src/` 是 React 前端，`src-tauri/src/` 是 Tauri 命令和 Rust 服务，`plugins/` 是随应用资源加载的 TOML 目录，`example-plugins/` 是配置示例，`e2e-tests/` 是基于 release exe 的桌面界面回归项目。当前架构与本轮复查见 [Architecture.md](docs/Architecture.md)、[ArchitectureReview.md](docs/ArchitectureReview.md) 和 [UIRuntimeAudit.md](docs/UIRuntimeAudit.md)。
