# PO 翻译辅助工具

这个目录包含一些实用的命令行工具，用于快速检查和分析 PO 文件。

## 🚀 推荐工具

### 1. quick_check.py - 快速 PO 文件检查 ✅

**无需依赖**，快速验证 PO 文件结构和翻译进度。

```bash
python tools/quick_check.py
```

**功能**：
- ✅ 自动查找项目中的 PO 文件
- ✅ 显示翻译统计（总条目、已翻译、翻译率）
- ✅ 列出未翻译的条目

---

## 📦 已弃用的工具

以下工具依赖于旧的 Python CLI 版本（`src/` 目录），功能已集成到 Tauri GUI 应用中：

### ~~test_translator.py~~ ❌
- **状态**：已弃用
- **替代**：使用 Tauri GUI 应用的测试功能

### ~~manage_tm.py~~ 🟡
- **状态**：功能已集成到 GUI
- **替代**：使用 GUI 的"记忆库管理"功能
- **保留原因**：如需命令行批量操作可使用

### ~~analyze_po.py~~ 🟡
- **状态**：依赖旧代码
- **替代**：可用 `quick_check.py` 快速检查
- **保留原因**：提供更详细的成本预估

### ~~compare_translations.py~~ 🟡
- **状态**：依赖旧代码
- **替代**：使用 GUI 的对比功能
- **保留原因**：命令行快速对比

---

## 🎯 使用建议

### 日常使用
```bash
# 推荐：使用 Tauri GUI 应用
cd po-translator-gui
npm run tauri dev
```

### 快速验证（CI/脚本）
```bash
# 使用独立工具
python tools/quick_check.py
```

---

## 🧹 待清理

如果确认不再使用旧的 Python CLI 工具，可以删除：
- `src/` - 旧的 Python 翻译器代码
- `tools/test_translator.py` - 旧代码测试
- `tools/manage_tm.py` - 已有 GUI 替代
- `tools/analyze_po.py` - 可用 quick_check 替代
- `tools/compare_translations.py` - 已有 GUI 替代

**保留**：
- `tools/quick_check.py` - 轻量级独立工具

