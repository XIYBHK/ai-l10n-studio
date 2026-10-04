# Desktop E2E

本目录使用 WebDriverIO、`tauri-driver` 和真实 WebView2 测试 release exe，覆盖生产 CSP 下的组件样式和常用界面操作。Vitest 继续覆盖状态流及失败分支。

```powershell
npm ci --prefix e2e-tests
npm run test:e2e
```

根命令先构建 `src-tauri/target/release/po-translator-gui.exe`。启动脚本把 exe 和插件复制到 `src-tauri/target/e2e/run-*`，在副本旁创建全新的 `.config/PORTABLE` 和单条 PO 样本。前端偏好通过 `get_app_settings_path` 使用副本的应用目录。退出时只删除带本次所有权标记的测试目录；测试前后比较普通模式偏好文件 SHA-256，变化即失败。

根命令随后执行六组界面回归和四个独立原生关闭场景。已有最新 release 时可单独运行关闭套件：

```powershell
npm run test:e2e:close
```

`window-close.e2e.cjs` 通过 Win32 `SC_CLOSE` 检查无修改退出、重复关闭与取消/放弃、只读 PO 保存失败后重试，以及开发工具单独关闭和随主窗口退出。helper 只控制带所有权标记、完整 exe 路径和 PID 匹配的隔离副本；每个场景在 runner 强制清理前验证进程自行结束。它不替代人工鼠标命中测试，也不调用真实供应商。证据见 [WindowCloseAudit.md](../docs/WindowCloseAudit.md)。

已有最新 release 可直接运行，不重复构建，也不调用 MidScene 或 AI 服务：

```powershell
$env:TAURI_APP_PATH = (Resolve-Path 'src-tauri/target/release/po-translator-gui.exe').Path
npm --prefix e2e-tests run test -- --spec ./specs/ui.e2e.cjs
```

需要已安装的 `tauri-driver`、Edge 和 WebView2。匹配 Edge 版本的驱动默认缓存到 `src-tauri/target/e2e/driver`；可用 `EDGE_DRIVER_BIN` 指定已有驱动。

可通过 `TAURI_E2E_WINDOW_X` 和 `TAURI_E2E_WINDOW_Y` 指定测试窗口的桌面坐标，将主窗口与开发工具放到副屏。例如副屏左上角为 `(3840, 0)` 时，运行前设置：

```powershell
$env:TAURI_E2E_WINDOW_X = '3840'
$env:TAURI_E2E_WINDOW_Y = '50'
```

定位 helper 仅移动有所有权标记的隔离副本，并输出实际原生窗口边界。原生键盘回归需要可见窗口和焦点，不使用隐藏窗口代替真实交互；终端子进程保持隐藏。

`specs/ui.e2e.cjs` 验证真正的 `http://tauri.localhost/` UI，不能把 `about:blank` 或仅有 window handle 当成成功。当前六组回归覆盖：

- 生产 CSP 保持启用，每个 Ant Design 动态 style 带 nonce 且 CSSOM 已生效；设置 Modal 在视口内，占位文字可读。
- 五个设置标签、下拉框、关闭和重新打开。
- 四次主题切换，每次采样 20 个绘制帧，检查 DOM 和文字/背景颜色同步。
- 文件菜单、记忆与术语管理弹窗。
- 编辑取消的消息样式，以及保持 textarea 焦点时 Ctrl+S 经真实 Rust IPC 写出 PO。
- 调试窗口加载保存的语言/主题、两个日志标签、暂停状态独立、跨窗口主题同步和重复点击复用窗口。

PO 导入通过发送应用现有 `tauri://drag-drop` 事件驱动正常处理器；这不等于实测 OS 文件对话框或鼠标拖放。通知、真实供应商请求、完整翻译/确认业务和大文件性能不在此套原生测试覆盖内。失败保存截图与 DOM；当前证据目录和修复记录见 [UIRuntimeAudit.md](../docs/UIRuntimeAudit.md)。
