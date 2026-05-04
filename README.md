# PO 翻译工具 - Tauri GUI

🌐 基于 AI 的 PO 文件翻译工具，采用 Tauri + React + Rust 架构。

## 当前状态（2026）

- 前端栈：React 19 + TypeScript + Ant Design 6 + Zustand 5
- 后端栈：Tauri 2.x + Rust + Tokio
- 运行时配置：优先使用 `ConfigDraft`
- 密钥存储：公开配置与独立 secrets 文件拆分持久化
- 兼容路径：`ConfigManager` 仅保留给导入/导出与旧路径兼容

## ✨ 特性

### 核心功能

- 🚀 **现代化界面** - 基于 Ant Design 的专业 UI，支持暗色主题
- 🤖 **多 AI 提供商** - 支持 Moonshot AI、OpenAI、讯飞星火、百度文心等 8 家 AI 服务
- 💾 **智能翻译记忆** - 内置 83+ 短语库，自动学习新翻译
- ⚡ **高效批量处理** - 智能去重，分块处理，实时进度显示
- 🌐 **多语言支持** - 支持 10 种主流语言的自动检测和翻译
- 📁 **多格式文件** - 支持 PO、JSON、XLIFF、YAML 格式（基础）

### 高级功能

- 🎯 **Contextual Refine** - 上下文感知的精细翻译（Ctrl+Shift+R）
- 🔧 **自定义提示词** - 可定制 AI 系统提示词，适应不同翻译场景
- 📚 **术语库管理** - 术语库+风格提示词自动拼接
- 🌍 **应用本地化** - 系统语言自动检测，简体中文/English 界面
- ⚙️ **性能优化** - 大文件智能分块，进度节流，内存优化

## 🚀 快速开始

### 环境要求

- **Node.js** >= 18.18.0（建议 20 LTS）
- **npm** >= 9 或 **pnpm**/**yarn**（任选其一）
- **Rust toolchain**（stable；Windows 建议通过 Rustup 安装）
- **Tauri 2 依赖**：
  - Windows: Microsoft Visual Studio C++ 生成工具（含 Desktop development with C++）
  - macOS: Xcode（含命令行工具）
  - Linux: `libgtk-3-dev`、`webkit2gtk` 等（参考 Tauri 官方）

### 安装

```bash
# 克隆仓库
git clone <repository-url>
cd ai-l10n-studio

# 安装依赖
npm install

# 如需指定国内镜像
# npm config set registry https://registry.npmmirror.com
```

### 安装 Rust 与平台依赖（必读）

> 首次开发前，请完成本节。Tauri 需要 Rust 和平台原生依赖。

1. 安装 Rust（使用 rustup）

- Windows（PowerShell）

```powershell
winget install --id Rustlang.Rustup -e
rustup default stable
rustup update
```

- macOS / Linux（终端）

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup default stable
rustup update
```

2. 安装平台依赖（Tauri 2）

- Windows：安装 Visual Studio Build Tools，并勾选「使用 C++ 的桌面开发」工作负载。
- macOS：安装 Xcode 与命令行工具：

```bash
xcode-select --install
```

- Linux（以 Debian/Ubuntu 为例）：

```bash
sudo apt update
sudo apt install -y libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev build-essential
```

（其他发行版请参考 Tauri 官方文档，确保安装 WebKitGTK 与 GTK3 等开发包）

3. 验证安装

```bash
node --version
rustc --version
cargo --version
```

若 `rustc` / `cargo` 未找到，Windows 请确认 PATH 包含 `%USERPROFILE%\.cargo\bin`，并重启终端/IDE。

### 开发模式

```bash
# 启动开发服务器（首次运行较慢，需编译 Rust）
npm run tauri:dev
```

### 构建生产版本

```bash
# 构建可执行文件
npm run tauri:build
```

### 常见环境问题

1. Windows 缺少 C++ 构建工具：请安装 Visual Studio Build Tools，选择 “使用 C++ 的桌面开发”。
2. macOS 缺少 CLT：运行 `xcode-select --install`。
3. Linux 缺少 GTK/WebKit：参考 Tauri 文档安装 `webkit2gtk`、`libgtk-3-dev` 等。
4. Rust 版本过旧：`rustup update stable`。

```

## 📖 使用指南

### 1. 配置 API 密钥

1. 点击工具栏 **[设置]** 按钮
2. 输入你的 Moonshot 或 OpenAI API 密钥
3. 选择 AI 提供商和模型
4. 点击 **[保存]**

> 安全说明：当前版本采用“公开配置 + 独立 secrets 文件”的拆分存储方案，
> 运行时主路径优先使用 `ConfigDraft`。详细说明见 `docs/SECURITY_NOTES.md`。

### 2. 打开 PO 文件

1. 点击工具栏 **[打开]** 按钮
2. 选择 `.po` 文件
3. 左侧列表将显示所有翻译条目

### 3. 翻译方式

#### 手动翻译
1. 从左侧列表选择条目
2. 在右侧译文框中输入翻译
3. 内容自动保存

#### AI 翻译单条
1. 选择条目
2. 点击编辑器的 **[AI 翻译]** 按钮
3. 等待翻译完成

#### 批量翻译
1. 点击工具栏 **[批量翻译]** 按钮
2. 观察实时进度
3. 完成后自动应用翻译

### 4. 保存文件

1. 点击工具栏 **[保存]** 按钮
2. 选择保存位置
3. 翻译完成！

### 5. 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl+O` | 打开文件 |
| `Ctrl+S` | 保存文件 |
| `Ctrl+Shift+S` | 另存为 |
| `Ctrl+Shift+R` | 精翻选中条目（Contextual Refine） |
| `Ctrl+,` | 打开设置 |
| `Ctrl+D` | 打开开发工具 |

## 📊 界面说明

### 工具栏
```

[🌐 PO 翻译工具] [打开] [保存] | [批量翻译] ... [设置]

```

### 条目列表（左侧）
- **✅** 已翻译
- **⚪** 未翻译
- **⚫** 空条目
- 点击条目查看和编辑

### 编辑器（右侧）
- **原文** - 只读显示
- **上下文** - 翻译上下文信息
- **注释** - 开发者注释
- **译文** - 可编辑翻译内容
- **状态栏** - 行号、字符数、状态

## 🔧 配置选项

### API 设置
- **API 密钥** - Moonshot/OpenAI API Key
- **提供商** - Moonshot AI / OpenAI
- **模型** - 选择对应的 AI 模型
- **基础 URL** - API 端点（可选）

### 配置与密钥
- **运行时配置** - 优先使用 `ConfigDraft`
- **密钥持久化** - 公开配置与 secrets 文件分离存储
- **兼容路径** - `ConfigManager` 仅保留给导入/导出与旧路径兼容

### 翻译设置
- **批量大小** - 每批翻译的条目数
- **最大并发** - 并发翻译请求数
- **超时时间** - 请求超时设置

### 翻译记忆库
- **启用 TM** - 使用翻译记忆库
- **TM 路径** - 记忆库文件位置
- **自动保存** - 自动保存翻译

## 🏗️ 项目结构

```

ai-l10n-studio/
├── src/ # 前端代码 (React + TypeScript)
│ ├── components/ # UI 组件
│ │ ├── MenuBar.tsx # 工具栏
│ │ ├── EntryList.tsx # 条目列表
│ │ ├── EditorPane.tsx # 编辑器
│ │ └── SettingsModal.tsx # 设置对话框
│ ├── hooks/ # React Hooks
│ ├── store/ # Zustand 状态管理
│ ├── types/ # TypeScript 类型
│ └── App.tsx # 主应用
├── src-tauri/ # 后端代码 (Rust)
│ ├── src/
│ │ ├── commands/ # Tauri 命令
│ │ ├── services/ # 核心服务
│ │ │ ├── po_parser.rs # PO 文件解析
│ │ │ ├── ai_translator.rs # AI 翻译
│ │ │ ├── translation_memory.rs # 翻译记忆库
│ │ │ ├── batch_translator.rs # 批量翻译
│ │ │ └── config_manager.rs # 配置管理
│ │ └── main.rs # 入口文件
│ └── Cargo.toml # Rust 依赖
├── package.json # Node.js 依赖
└── vite.config.ts # Vite 配置

````

更多说明参见 docs/README.md 与 docs/API.md。

## 📚 技术栈

### 前端

- **React 19** - UI 框架
- **TypeScript** - 类型安全
- **Ant Design 6** - UI 组件库
- **Zustand** - 状态管理
- **Vite** - 构建工具

### 后端

- **Tauri 2.x** - 桌面应用框架（权限系统）
- **Rust** - 系统编程语言
- **Tokio** - 异步运行时
- **Reqwest** - HTTP 客户端
- **Serde** - 序列化/反序列化

### AI 集成

- **Moonshot AI** - 中文优化的大语言模型
- **OpenAI** - GPT 系列模型

## 📈 性能

### 文件处理

- **小文件** (< 10MB): 即时加载，< 1s
- **大文件** (10-50MB): 自动分块，< 3s
- **超大文件** (> 50MB): 优化处理，智能节流

### 翻译效率

- **批量翻译**: 1-3 条目/秒（取决于 AI 响应）
- **TM 命中率**: 30-50%（简单短语）
- **去重优化**: 自动去重，减少 AI 调用
- **进度节流**: 100ms 更新间隔，流畅 UI

### 资源占用

- **内存占用**: < 200MB（常规文件）
- **CPU 使用**: 低（异步处理）

## 🎯 核心功能

### 翻译记忆库 (TM)

- 83+ 内置常用短语
- 自动识别简单短语 (9 条件判断)
- 自动保存新翻译
- 命中/未命中统计

### 智能翻译

- 批量去重优化
- 上下文感知
- 对话历史管理
- Token 使用统计

### PO 文件支持

- 完整的 PO 格式解析
- 保留注释和元数据
- 支持 msgctxt 上下文
- 正确处理转义字符

## 📄 文档

### 📚 完整文档库

**所有文档已整理到 [`docs/`](./docs/) 文件夹** - [查看文档索引](./docs/README.md)

推荐优先阅读：`docs/Architecture.md`、`docs/API.md`、`docs/DataContract.md`、`docs/SECURITY_NOTES.md`

### 快速链接

#### 🚀 新手入门

- [快速开始指南](./docs/QUICK_START.md) - 5分钟上手
- [开发指南](./docs/DEVELOPMENT_GUIDE.md) - 完整开发教程

#### 🏗️ 架构与设计

- [系统架构](./docs/ARCHITECTURE.md) - 技术架构说明
- [数据契约](./docs/DATA_CONTRACT.md) - 数据结构定义

#### 📋 项目规划

- [特性扩展计划](./docs/FEATURE_EXPANSION_PLAN.md) - 8 个 Phase 详细规划

#### 📊 阶段总结

- [Phase 1-7 完成总结](./docs/) - 各阶段详细报告
- [最新进展 (Phase 7)](./docs/PHASE7_COMPLETION_SUMMARY.md) - Contextual Refine 功能

## 🐛 问题排查

### 应用无法启动

```bash
# 清理缓存
npm run tauri clean
rm -rf node_modules
npm install
```

### Rust 编译错误

```bash
# 更新 Rust
rustup update stable

# 清理构建
cd src-tauri
cargo clean
```

### 翻译失败

1. 检查 API 密钥是否正确
2. 检查网络连接
3. 查看控制台错误信息
4. 验证 API 额度

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📝 许可证

[MIT License](./LICENSE)

## 🙏 致谢

- [Poedit](https://github.com/vslavik/poedit) - UI 设计灵感
- [Tauri](https://tauri.app/) - 优秀的桌面应用框架
- [Ant Design](https://ant.design/) - 企业级 UI 组件

---

**开始翻译你的 PO 文件吧！** 🚀
````
