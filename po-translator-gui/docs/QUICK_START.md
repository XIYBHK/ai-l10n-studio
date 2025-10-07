# 🚀 快速启动指南

## 第一步：检查环境

在命令行运行以下命令检查环境：

```bash
# 检查 Node.js（需要 >= 18.0.0）
node --version

# 检查 Rust（需要 >= 1.70.0）
rustc --version

# 如果没有 Rust，安装它：
# Windows: 下载并运行 https://rustup.rs/
# macOS/Linux: curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

## 第二步：安装依赖

```bash
# 在 po-translator-gui 目录下
cd po-translator-gui

# 安装前端依赖（选择一个）
npm install
# 或
pnpm install
# 或
yarn install
```

## 第三步：启动开发模式

```bash
# 启动开发服务器
npm run tauri:dev
```

**⏰ 首次运行时间**：
- 首次：10-20 分钟（需要编译所有 Rust 依赖）
- 后续：1-2 分钟（增量编译）

**成功标志**：
- 出现应用窗口
- 显示 "🌐 PO 翻译工具" 界面

## 第四步：配置 API

1. 点击工具栏的 **[设置]** 按钮
2. 在设置对话框中：
   - **API 密钥**：输入你的 Moonshot 或 OpenAI API 密钥
   - **AI 提供商**：选择 Moonshot AI（推荐）或 OpenAI
   - **模型**：选择 `moonshot-v1-8k`（默认）
3. 点击 **[保存]**

### 获取 API 密钥

**Moonshot AI**（推荐，中文效果好）:
- 访问：https://platform.moonshot.cn/
- 注册并创建 API 密钥
- 新用户通常有免费额度

**OpenAI**:
- 访问：https://platform.openai.com/
- 创建 API 密钥
- 需要付费使用

## 第五步：测试翻译

### 方式 1：使用提供的测试文件

```bash
# 测试文件已包含在项目中
# 路径：po-translator-gui/test-sample.po
```

1. 点击 **[打开]** 按钮
2. 选择 `test-sample.po`
3. 左侧列表显示 30 个条目
4. 点击 **[批量翻译]** 按钮
5. 观察翻译进度

### 方式 2：使用你自己的 PO 文件

1. 点击 **[打开]** 按钮
2. 选择你的 `.po` 文件
3. 选择一个未翻译的条目（⚪）
4. 点击编辑器中的 **[AI 翻译]** 按钮测试单条翻译

### 方式 3：手动翻译

1. 选择任意条目
2. 在右侧译文框中直接输入翻译
3. 内容自动保存

## 第六步：保存结果

1. 翻译完成后，点击 **[保存]** 按钮
2. 选择保存位置
3. 完成！

## 🎯 快速测试检查清单

运行以下快速测试，确保一切正常：

- [ ] 应用成功启动
- [ ] 点击 **[设置]** 可以打开设置对话框
- [ ] 输入 API 密钥并保存成功
- [ ] 点击 **[打开]** 可以选择文件
- [ ] 打开 `test-sample.po` 显示 30 个条目
- [ ] 点击列表中的条目，右侧编辑器显示内容
- [ ] 在译文框输入文字可以实时保存
- [ ] 点击 **[AI 翻译]** 可以翻译单条（需要 API 密钥）
- [ ] 点击 **[批量翻译]** 可以批量翻译（需要 API 密钥）
- [ ] 翻译时显示进度条
- [ ] 点击 **[保存]** 可以保存文件

## 📊 预期效果

### 翻译记忆库 (TM) 效果

测试文件中的一些短语会被 TM 自动翻译（极快）：
- "Hello" → "你好"
- "Open" → "打开"  
- "Save" → "保存"
- "Copy" → "复制"
- "Settings" → "设置"

### AI 翻译效果

较长的句子会调用 AI 翻译（稍慢）：
- "Are you sure you want to delete this item?" → AI 生成翻译
- "Connection failed. Please check your network." → AI 生成翻译

## 🐛 常见启动问题

### 问题 1：`npm run tauri:dev` 报错

**错误**: `tauri: command not found`

**解决**:
```bash
# 重新安装依赖
rm -rf node_modules package-lock.json
npm install
```

### 问题 2：Rust 编译失败

**错误**: `error: could not compile ...`

**解决**:
```bash
# 更新 Rust
rustup update stable

# 清理并重新编译
cd src-tauri
cargo clean
cd ..
npm run tauri:dev
```

### 问题 3：窗口打开后是空白

**原因**: 前端编译出错

**解决**:
1. 按 `F12` 打开开发者工具
2. 查看 Console 中的错误
3. 检查 `package.json` 依赖是否完整安装

### 问题 4：按钮点击无反应

**检查**:
1. 打开开发者工具（F12）查看错误
2. 确认 API 密钥已配置（需要翻译时）
3. 确认已打开 PO 文件（需要操作条目时）

## 📈 性能参考

**测试文件 (30 条目)**:
- 打开文件：< 1 秒
- 批量翻译：约 30-60 秒
  - TM 命中（约 10 条）：瞬间
  - AI 翻译（约 20 条）：1-2 条/秒
- 保存文件：< 1 秒

**实际项目 (500+ 条目)**:
- 打开文件：2-5 秒
- 批量翻译：5-15 分钟
- TM 可节省 30-50% 时间

## 🎉 成功！

如果以上测试都通过，恭喜你！环境配置成功，可以开始实际翻译工作了。

## 📚 下一步

- 阅读完整的 [README.md](./README.md) 了解所有功能
- 查看 [TESTING_GUIDE.md](./TESTING_GUIDE.md) 进行深度测试
- 查看 [UI_IMPROVEMENTS.md](./UI_IMPROVEMENTS.md) 了解设计理念

## 💡 小贴士

1. **首次翻译**：建议先用测试文件熟悉流程
2. **API 成本**：Moonshot 新用户有免费额度，足够测试
3. **翻译质量**：可以在设置中尝试不同模型
4. **备份文件**：翻译前建议备份原始 PO 文件
5. **批量翻译**：大文件建议分批处理，避免超时

---

**祝你翻译愉快！** 🚀

有问题？查看 [TESTING_GUIDE.md](./TESTING_GUIDE.md) 的问题排查部分。

