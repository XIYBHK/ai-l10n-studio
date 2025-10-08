# 🔄 完全重启应用指南

## 🚨 问题症状

- ❌ 控制台报错: `loadSettings is not defined`
- ❌ 主题设置不生效
- ❌ 刷新页面(F5)后问题依旧

**原因**: Vite 热更新 (HMR) 导致模块状态混乱

---

## ✅ 正确的重启步骤

### 步骤 1: 停止应用

在 **VS Code 终端** (Terminal 标签页) 中：

1. 点击终端窗口（确保焦点在终端上）
2. 按 **`Ctrl + C`** (Windows/Linux) 或 **`Cmd + C`** (Mac)
3. 等待看到进程完全停止

**确认停止成功**:
```
✅ 看到 `$` 或 `PS >` 提示符
✅ 应用窗口关闭
```

---

### 步骤 2: 清理缓存 (可选，但推荐)

```bash
# 清理 Vite 缓存
rm -rf node_modules/.vite

# PowerShell (Windows)
Remove-Item -Recurse -Force node_modules/.vite
```

---

### 步骤 3: 重新启动

```bash
cd po-translator-gui
npm run tauri:dev
```

**等待**:
- ⏱️ Rust 编译 (首次较慢，约 30-60 秒)
- ⏱️ Vite 启动 (约 5-10 秒)
- ⏱️ 应用窗口打开

---

### 步骤 4: 验证启动成功

打开 **F12 开发者工具 → Console**

**期望日志** (按顺序):

```
[Bootstrap] 🚀 开始数据迁移...
[Migration] 不需要迁移
[Bootstrap] 📦 加载持久化数据...
[Store] 初始化所有 Store...
[TauriStore] 初始化...
[TauriStore] 初始化成功
[useSettingsStore] 设置加载成功 { theme: 'dark', language: 'zh-CN' }
[useStatsStore] 统计加载成功 { totalTranslated: 0, ... }
[Bootstrap] ✅ 持久化数据加载完成
```

**如果看到这些日志** ✅:
- 说明初始化成功
- 主题应该正确显示
- 持久化正常工作

**如果仍然报错** ❌:
- 继续往下看故障排查

---

## 🐛 故障排查

### 问题 1: `loadSettings is not defined`

**症状**: 控制台仍然报这个错误

**解决**:
```bash
# 1. 停止应用 (Ctrl+C)

# 2. 删除 node_modules 和 lock 文件
rm -rf node_modules package-lock.json

# 3. 重新安装
npm install

# 4. 清理 Rust 缓存
cd src-tauri
cargo clean
cd ..

# 5. 重新启动
npm run tauri:dev
```

---

### 问题 2: 主题不保存

**检查步骤**:

1. **确认 TauriStore 初始化成功**
   ```
   控制台应该有: [TauriStore] 初始化成功
   ```

2. **检查数据文件**
   
   Windows:
   ```
   C:\Users\你的用户名\AppData\Roaming\com.potranslator.gui\app-settings.json
   ```
   
   打开文件，应该看到:
   ```json
   {
     "theme": "dark",
     "language": "zh-CN",
     ...
   }
   ```

3. **测试主题切换**
   - 切换主题后，控制台应该显示:
     ```
     [TauriStore] 设置 theme: dark
     [TauriStore] 保存成功
     ```

---

### 问题 3: 重启后主题变回亮色

**可能原因**:

1. ❌ **没有完全重启** - 只刷新了页面
   - **解决**: 按 Ctrl+C 完全停止，重新 `npm run tauri:dev`

2. ❌ **数据文件没有保存**
   - **检查**: 查看上述数据文件是否存在
   - **解决**: 检查文件权限，确保应用有写入权限

3. ❌ **初始化时机太晚**
   - **检查**: 控制台日志顺序
   - **期望**: `[Bootstrap] 📦 加载持久化数据...` 在 `[App]` 之前

---

## ✅ 成功标准

完全重启后，应该满足：

- ✅ 控制台无 `loadSettings is not defined` 错误
- ✅ Bootstrap 日志显示完整
- ✅ TauriStore 初始化成功
- ✅ 主题切换正常工作
- ✅ **重启后主题保持** ← 最重要！

---

## 🎯 测试持久化

### 完整测试流程

1. **启动应用** (`npm run tauri:dev`)
2. **检查初始主题** (应该是上次保存的)
3. **切换主题** (亮色 → 暗色)
4. **观察日志** (应该有保存成功提示)
5. **完全停止应用** (Ctrl+C)
6. **重新启动** (`npm run tauri:dev`)
7. **验证主题** (应该保持暗色) ✅

---

## 💡 提示

### ❌ 无效的重启方式

- ❌ 刷新页面 (F5)
- ❌ 点击应用的刷新按钮
- ❌ 修改代码触发热更新

### ✅ 有效的重启方式

- ✅ Ctrl+C 停止 + `npm run tauri:dev`
- ✅ 关闭 VS Code + 重新打开 + 运行命令
- ✅ 重启电脑（极端情况）

---

## 📞 仍然有问题？

如果按照上述步骤仍然无法解决，请提供：

1. 完整的控制台日志 (F12 → Console)
2. 数据文件内容 (`app-settings.json`)
3. 操作步骤截图

---

**最后更新**: 2025-10-08

