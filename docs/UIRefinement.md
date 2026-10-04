# 前端设计优化

日期：2026-10-04。基于用户明确要求优化现有前端，使用已安装的 [UI/UX Pro Max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill)。紫色是早期 AI 的选择，不是用户品牌需求。

## 设计方向与实现

本地检索 `desktop productivity editor minimal` 的设计系统和 `developer tool editor` 的产品指南后，选用简洁、紧凑、有清晰层次的工具界面：石墨灰深色、柔和浅色背景、青绿色操作强调色。青绿同样是本轮实现选择，不作为用户品牌定义。字体使用离线可用的 Windows 系统字体和中文回退；没有引入网络字体或新 UI 依赖。

- 欢迎页重排标题、说明、导入按钮、快捷键和三个功能入口说明，PO 预览使用分层卡片。
- 菜单、工作区边框与留白、列表选中态和原文/译文区域统一层次。状态通过文字与颜色共同表达，降低重复装饰和持续闪烁。
- 编辑工具栏收敛状态与操作，英文快捷键说明改为可打开的帮助。最窄列表使用 Pending/Review/Done，并保留完整状态名称和数量的可访问文本。
- 1180px 以下将助手改为 Ant Design Drawer，使用框架遮罩。WebView2 实测默认焦点锁在 Tab 末尾可离开到 body，等待一秒仍未恢复；抽屉复用仓库已有的 `FocusTrap`，停用同层默认焦点锁，显式处理正反 Tab 边界和触发按钮恢复。资源库 Modal 仍使用 Ant Design 内置焦点管理。抽屉 Esc 在自身 DOM 范围内处理，尊重已处理事件及输入法组合状态，避免资源库关闭后全局弹层路由未关闭抽屉；嵌套 portal 不由该处理器关闭。存在可见模态层时屏蔽背景编辑器及文件快捷键，包含焦点暂落在外层 portal/body 的情况。宽窗口保留侧栏。
- 记忆库和术语库关闭前确认未保存草稿。记忆库后台刷新不覆盖脏快照，编辑字段有可访问名称，新增表单使用实际标签。
- 高级供应商反馈统一使用 `App.useApp()`，继承窗口主题和 CSP nonce。主窗口、开发工具与相关编辑操作同步中英文可访问文本及 Ant Design locale。

实际验收还发现库弹窗直接卸载会跳过 Modal 的关闭和焦点恢复。现在先关闭，等待 `afterClose` 才卸载管理器，焦点返回助手的资源按钮；去掉 Drawer 的 `forceRender`，让关闭的 portal 退出 Esc 处理。回归检查打开库、关闭、再按 Esc 退出助手，全程保留 PO 草稿。

`src/index.css` 是设计 token 唯一来源。`src/theme/config.ts` 解析同一份打包 CSS，为 Ant Design 的色板算法提供实际值；不再维护重复色板。浅色主操作色为 `#0f766e`，深色为 `#5eead4`，对应白色与深色按钮文字。两种主题的正常正文和翻译来源标签有自动对比度检查。

## 验收与证据

实际桌面验收使用新构建的 `src-tauri/target/release/po-translator-gui.exe`，由 WebDriver 启动隔离副本，读取真实 WebView2 DOM 和截图。测试副本拥有独立配置和 PO 文件，并检查个人偏好文件的 SHA-256 未改变。

最终通过 103 个前端测试、6 个脚本测试、3 个设计桌面场景、6 个常规桌面场景和 4 个原生退出场景，类型与国际化检查通过。桌面主窗口和开发工具使用有所有权保护的 Win32 定位移到副屏 `(3840, 50)`，实际边界得到核对；终端子进程隐藏。原生键盘检查仍使用可见窗口。测试结束时应用与驱动进程均已退出。截图步骤在弹层内保留键盘焦点，避免 WebDriver 的输入释放操作把焦点移到 body，干扰 Esc 验收。

设计回归覆盖高级供应商保存消息的可见矩形与 CSP 样式、欢迎页和编辑器的双主题、1000×700 英文窗口与 260px 列表、抽屉连续八次 Tab 与八次 Shift+Tab 命中、关闭抽屉保留 PO 草稿，以及记忆库取消/放弃确认与重新打开后的实际内容。没有发送 AI 请求；虚拟供应商仅用于本地配置和反馈检查。

具体命令、测试结果和被测 exe 哈希见 [validation.json](audits/2026-10-04/ui-redesign/validation.json)，交互测量见 [results.json](audits/2026-10-04/ui-redesign/results.json)。默认桌面回归另外检查设置、主题切换、资源库、编辑保存和开发工具；原生关闭套件检查无修改、取消/放弃、保存失败后重试和子窗口退出。

| 界面             | 浅色                                                             | 深色                                                            |
| ---------------- | ---------------------------------------------------------------- | --------------------------------------------------------------- |
| 欢迎页           | [截图](audits/2026-10-04/ui-redesign/welcome-light.png)          | [截图](audits/2026-10-04/ui-redesign/welcome-dark.png)          |
| 中文编辑器       | [截图](audits/2026-10-04/ui-redesign/editor-light.png)           | [截图](audits/2026-10-04/ui-redesign/editor-dark.png)           |
| 窄窗口英文编辑器 | [截图](audits/2026-10-04/ui-redesign/editor-narrow-en-light.png) | [截图](audits/2026-10-04/ui-redesign/editor-narrow-en-dark.png) |
| 英文编辑器       | [截图](audits/2026-10-04/ui-redesign/editor-en-light.png)        | [截图](audits/2026-10-04/ui-redesign/editor-en-dark.png)        |

其他证据：[助手抽屉](audits/2026-10-04/ui-redesign/assistant-narrow-en-light.png)、[库草稿确认](audits/2026-10-04/ui-redesign/memory-discard-prompt.png)、[英文记忆库](audits/2026-10-04/ui-redesign/memory-en-light.png)、[供应商反馈](audits/2026-10-04/ui-redesign/provider-feedback.png)。原审查与修复前截图保留在 [UIUXDesignReview.md](UIUXDesignReview.md)。

## 边界

这是现有桌面前端的视觉与交互优化，保留 PO 编辑、翻译、确认和保存流程。验收是有界桌面覆盖，不代表所有业务路径、辅助技术或真实 AI 服务均已验证。库弹窗的未保存关闭保护不等于主程序退出时保护库草稿；后者仍未实现。验证窗口为 1400×850 和 1000×700，中英文及亮暗主题；没有新增移动端支持。
