# 主窗口关闭核查

核验日期：2026-10-03。用户反馈点击右上角关闭按钮没有退出。此前界面回归未实际发送原生关闭请求，这个漏项已加入默认桌面回归。

## 根因与修复

隔离运行上一版 release，向本次副本的主窗口发送 Windows `WM_SYSCOMMAND / SC_CLOSE`，窗口和进程仍存在，WebView 捕获到 `Command plugin:window|destroy not allowed by ACL`。证据见 [原生失败记录](audits/2026-10-03/window-close/before-clean-close.json) 和 [截图](audits/2026-10-03/window-close/before-clean-close.png)。

修复前 JSON 的窗口标题字段因探针 stdout 编码不一致显示乱码，保留原记录；实际 HWND 匹配使用 Unicode 标题，权限错误和进程存活记录有效。后续 helper 明确 UTF-8 输出，修复后记录的中文标题正常。

本机安装的 Tauri JavaScript API 在 `onCloseRequested` 回调没有阻止事件时会调用 `destroy()`；原实现先阻止事件、处理未保存修改，再调用 `close()` 触发第二次事件，但主窗口 capability 没有允许最终的 `destroy()`。这个权限失败发生在框架监听器中，应用原有 catch 没有捕获。此前只模拟 `close()` 成功的测试无法检出真实 ACL 问题。

- 主窗口 capability 增加 `core:window:allow-destroy`，权限限定于主窗口。
- 关闭处理器始终先阻止默认关闭，完成任务取消与未保存确认后直接等待 `destroy()`；取消、保存失败或销毁失败都允许重试，失败显示本地化消息。
- 重复关闭请求共用正在处理的流程，不能绕过未保存确认。
- Rust 在主窗口实际 `Destroyed` 后结束应用进程及开发工具；单独关闭开发工具保留主窗口。
- 保存失败验收发现文件状态漏译，以及编辑器“已保存”容易与磁盘状态混淆。补齐“文件尚未保存”，编辑器使用“编辑内容已同步”，Ctrl+Enter 标为“确认译文”；文件保存仍由文件操作或 Ctrl+S 完成。

参考 [Tauri 关闭事件 API](https://v2.tauri.app/reference/javascript/api/namespacewindow/#oncloserequested)、[核心权限](https://v2.tauri.app/reference/acl/core-permissions/) 和 [Windows 系统命令](https://learn.microsoft.com/en-us/windows/win32/menurc/wm-syscommand)。根因以本地安装源码和真实 release 的失败记录为准。

## 原生验收

`npm run test:e2e:close` 对每个场景创建独立便携副本及 PO 样本。Win32 helper 校验目录边界、随机所有权标记、exe 完整路径和 PID，然后只向对应窗口发送 `SC_CLOSE`。它走标题栏关闭使用的系统命令；未声称实测人工鼠标点击的命中位置。

| 场景           | 实际验证                                                                                               |
| -------------- | ------------------------------------------------------------------------------------------------------ |
| 无修改退出     | 主窗口关闭后进程自行结束                                                                               |
| 取消与放弃     | 连续关闭只出现一个确认框；取消保留窗口和草稿；再次放弃退出，磁盘内容未变                               |
| 保存失败与重试 | 将隔离 PO 设为只读；保存失败保留窗口和译文，文件状态仍显示未保存；恢复可写后再次保存退出，磁盘包含修改 |
| 开发工具       | 单独关闭调试窗口不退出主程序；重新打开后关闭主窗口，整个进程及子窗口结束                               |

四个场景均在 runner 的强制清理之前检查进程已退出，JSON 中记录 `processExited: true` 和 `forcedCleanupBeforeCheck: false`。保存重试直接读取磁盘 PO，未以 toast 或 mock 代替文件结果。

原生证据：[直接退出](audits/2026-10-03/window-close/after-clean.json)、[取消与放弃](audits/2026-10-03/window-close/after-discard.json)、[保存失败与重试](audits/2026-10-03/window-close/after-save.json)、[子窗口退出](audits/2026-10-03/window-close/after-devtools.json)、[未保存确认截图](audits/2026-10-03/window-close/unsaved-close.png)、[保存失败截图](audits/2026-10-03/window-close/save-failure.png)。

同时重新运行六组真实界面回归；设置、主题、库弹窗、编辑保存和开发工具操作均通过，最新截图见 [UIRuntimeAudit.md](UIRuntimeAudit.md)。构建哈希、测试数量和便携白名单见 [验证摘要](audits/2026-10-03/window-close/validation.json)。完整命令输出保留为同目录 `.log`，按仓库规则不提交 Git。

## 覆盖边界

Vitest 另外验证原生销毁失败可重试，以及正在翻译时先等待取消再销毁；后者使用模拟传输，未进行真实供应商请求中的关闭测试。OS 文件对话框、通知、完整翻译确认业务、大文件性能及其他机器 DPI 未由这些场景覆盖。

测试只操作本次隔离副本。每轮检查普通模式偏好文件前后 SHA-256 一致，保留原个人数据。关闭验收时图谱尚未建立，结论来自对应源码、测试和原生测量；随后图谱已恢复，失败原因与剩余工具限制见 [GraphIndexAudit.md](GraphIndexAudit.md)。
