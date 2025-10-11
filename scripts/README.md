# 开发工具脚本

本目录包含项目开发和发布的辅助脚本。

## 📋 脚本列表

### 1. `check-unused-i18n.js` - i18n 键清理工具

自动扫描源代码，检测并清理未使用的国际化翻译键。

**用法：**

```bash
npm run i18n:check
```

**功能：**
- 扫描 `src/` 和 `src-tauri/` 目录的所有源代码文件
- 检测 `src/i18n/locales/*.json` 中未被引用的键
- 自动备份原文件为 `.old` 后缀
- 生成清理后的精简 i18n 文件

**白名单：**
- `theme.light`, `theme.dark`, `theme.system`
- `common.ok`, `common.cancel`, `common.confirm`

**示例输出：**
```
🔍 Checking unused i18n keys...

📂 Found 2 i18n files: [ 'en.json', 'zh-CN.json' ]

📝 Scanned 15432 lines of source code

[en] Progress: 245/245 (100.0%)

[en] Unused keys (12): ["old.feature", "deprecated.button", ...]
[en] ✅ Cleaned i18n file written to src/i18n/locales/en.json
[en] 📦 Original file backed up as en.json.old

[zh-CN] Progress: 245/245 (100.0%)
[zh-CN] ✅ No unused keys found. Skipping file update.

✅ Done! Check the output above for details.
```

---

### 2. `portable.js` - Windows 便携版打包

生成 Windows 便携版 (绿色版) zip 包，支持无需安装直接运行。

**用法：**

```bash
# 先构建 Release 版本
npm run tauri:build

# 然后打包便携版
npm run tauri:portable

# 或指定目标架构
node scripts/portable.js x86_64-pc-windows-msvc
```

**功能：**
- 自动创建 `.config/PORTABLE` 标志文件（启用便携模式）
- 打包主程序 `po-translator-gui.exe`
- 打包资源文件 `resources/`
- 生成 `PO-Translator_{version}_{arch}_portable.zip`

**输出示例：**
```
PO-Translator_1.0.0_x64_portable.zip
├── po-translator-gui.exe
├── resources/
│   └── locales/
│       ├── en.json
│       └── zh-CN.json
└── .config/
    └── PORTABLE
```

**便携模式特性：**
- 所有配置文件存储在程序目录下的 `.config/`
- 翻译记忆库和日志存储在程序目录
- 可直接复制到 U 盘或其他目录运行

---

## 🛠️ 依赖

这些脚本需要以下 npm 包（已在 `package.json` 中配置）：

- `adm-zip` - ZIP 文件压缩

---

## 📝 注意事项

1. **i18n 检查**：运行前请确保提交所有更改，以便回滚
2. **便携版打包**：仅支持 Windows 平台
3. **架构支持**：
   - `x64` (x86_64-pc-windows-msvc) - 64位 Intel/AMD
   - `arm64` (aarch64-pc-windows-msvc) - ARM64
   - `x86` (i686-pc-windows-msvc) - 32位 (不推荐)

---

## 🔗 参考

这些脚本改编自 [clash-verge-rev](https://github.com/clash-verge-rev/clash-verge-rev) 项目，已针对本项目进行适配和优化。

