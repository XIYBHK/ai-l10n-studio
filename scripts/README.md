# 开发工具脚本

## `check-unused-i18n.js`

扫描 `src/` 与 `src-tauri/src/` 的引用，检查 `src/i18n/locales/*.json` 中未使用的叶子键。

```powershell
npm run i18n:check
node --test scripts/scripts.test.js
```

使用 `--fix` 时会更新 locale 文件；运行前应检查 Git diff。动态 i18n 调用按脚本规则保守处理。

## `portable.js`

为 Windows 生成便携 ZIP：

```powershell
npm run tauri:build
npm run tauri:portable
```

输出包含主 exe、`_up_/plugins/<provider>/plugin.toml` 和 `.config/PORTABLE`。仅收录当前运行时使用的 catalog，忽略增量构建目录残留的 Rust 源码和 DLL；不读取或打包已有个人配置和密钥。架构参数可传入 `node scripts/portable.js x86_64-pc-windows-msvc`。

脚本依赖以根目录 `package.json` 为准，当前便携打包使用 `adm-zip`。
