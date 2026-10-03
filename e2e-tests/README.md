# Desktop E2E

本目录是独立的 Tauri 桌面 shell smoke 测试项目，使用 WebDriverIO 和 `tauri-driver`；UI 语义测试由根项目 Vitest 覆盖。

```powershell
npm ci --prefix e2e-tests
npm run test:e2e
```

根命令会先构建 `src-tauri/target/debug/po-translator-gui.exe`，再运行本目录测试。启动脚本把 exe 和插件复制到 `src-tauri/target/e2e/run-*`，在副本旁创建全新的 `.config/PORTABLE`。退出时只删除带本次所有权标记的测试目录；源程序旁的配置不会读取、复制或清除。

已有 release 可直接测试单个启动用例，不重复构建，也不调用 MidScene：

```powershell
$env:TAURI_APP_PATH = (Resolve-Path 'src-tauri/target/release/po-translator-gui.exe').Path
npm --prefix e2e-tests run test -- --spec ./specs/app.e2e.cjs
```

需要已安装的 `tauri-driver`、Edge 和 WebView2。匹配 Edge 版本的驱动默认缓存到 `src-tauri/target/e2e/driver`；可用 `EDGE_DRIVER_BIN` 指定已有驱动。

当前范围是应用启动、WebDriver 连接和至少一个桌面 webview handle；本机 Edge/WebView2 条件下可能停留在 `about:blank`，因此不把它描述为完整业务流程 E2E。
