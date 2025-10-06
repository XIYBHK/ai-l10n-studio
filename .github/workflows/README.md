# GitHub Actions 工作流说明

本项目包含三个 GitHub Actions 工作流，用于自动化构建、测试和发布流程。

## 📋 工作流列表

### 1. Check - 代码检查 (check.yml)

**触发条件：**
- Push 到 `main` 或 `feature/*` 分支
- Pull Request 到 `main` 分支

**执行内容：**
- ✅ 前端 ESLint 检查
- ✅ Rust 代码格式检查 (rustfmt)
- ✅ Rust 静态分析 (clippy)
- ✅ Rust 单元测试

### 2. Build - 多平台构建 (build.yml)

**触发条件：**
- Push 到 `main` 或 `feature/*` 分支
- Pull Request 到 `main` 分支
- 手动触发

**支持平台：**
- 🪟 Windows (MSI, NSIS)
- 🍎 macOS (DMG, .app)
- 🐧 Linux (DEB, AppImage)

**产物保留期：** 30 天

### 3. Release - 自动发布 (release.yml)

**触发条件：**
- Push tag `v*` (例如：v1.0.0)
- 手动触发

**执行内容：**
- 多平台编译
- 自动创建 GitHub Release (草稿)
- 上传所有平台的安装包

## 🚀 使用方法

### 开发流程

1. **提交代码**
   ```bash
   git add .
   git commit -m "feat: add new feature"
   git push
   ```
   → 自动触发 **Check** 和 **Build** 工作流

2. **创建 Pull Request**
   → 自动运行所有检查

### 发布流程

1. **更新版本号**
   ```bash
   # 更新 po-translator-gui/package.json 的 version
   # 更新 po-translator-gui/src-tauri/Cargo.toml 的 version
   # 更新 po-translator-gui/src-tauri/tauri.conf.json 的 version
   ```

2. **创建并推送标签**
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```
   → 自动触发 **Release** 工作流

3. **完成发布**
   - 前往 GitHub Releases 页面
   - 编辑自动创建的草稿
   - 完善发布说明
   - 发布正式版本

## 🔧 配置 Secrets

### 可选：自动更新配置

如需启用 Tauri 的自动更新功能，需配置以下 Secrets：

1. 生成密钥对：
   ```bash
   cd po-translator-gui
   npm run tauri signer generate -- -w ~/.tauri/myapp.key
   ```

2. 在 GitHub 仓库设置中添加 Secrets：
   - `TAURI_PRIVATE_KEY`: 私钥内容
   - `TAURI_KEY_PASSWORD`: 密钥密码（如果设置了）

## 📦 构建产物

### Windows
- `*.msi` - Windows 安装包
- `*.exe` - NSIS 安装程序

### macOS
- `*.dmg` - macOS 磁盘映像
- `*.app.tar.gz` - 应用程序包

### Linux
- `*.deb` - Debian/Ubuntu 安装包
- `*.AppImage` - 通用 Linux 可执行文件

## 🐛 故障排查

### 构建失败

1. **检查依赖版本**
   - Node.js 版本：20.x
   - Rust 版本：stable

2. **查看工作流日志**
   - Actions 标签页 → 选择失败的工作流 → 查看详细日志

3. **本地复现**
   ```bash
   cd po-translator-gui
   npm ci
   npm run tauri build
   ```

### Ubuntu 构建失败

确保所有系统依赖已安装：
```bash
sudo apt-get update
sudo apt-get install -y libgtk-3-dev libwebkit2gtk-4.0-dev \
  libappindicator3-dev librsvg2-dev patchelf
```

## 📝 注意事项

- ✅ 所有工作流使用最新的 Actions 版本 (v4)
- ✅ Rust 缓存加速构建
- ✅ npm 缓存加速依赖安装
- ⚠️ Release 默认创建草稿，需手动发布
- ⚠️ 构建产物保留 30 天后自动删除
