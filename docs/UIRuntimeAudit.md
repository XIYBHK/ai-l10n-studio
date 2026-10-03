# 生产界面问题核查

核验日期：2026-10-03。用户反馈亮暗切换时文字闪烁、设置按钮无响应、开发工具布局像未加载样式。此前仅验证应用启动及 webview handle 的 smoke 不足以验收这些可见操作；本轮改为直接检查 release exe 的真实 DOM、CSSOM、窗口和文件输出。随后新增的关闭缺陷与专项验收见 [WindowCloseAudit.md](WindowCloseAudit.md)，本报告的修复后证据已用包含关闭修复的最终 exe 更新。

## 结论与修复

| 问题                                               | 直接证据                                                                                               | 修复                                                                                              |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| 设置无响应、开发工具无样式                         | 设置已经挂载，但 Ant Design style 没有 nonce，`sheet` 为 null；Modal 没有 fixed 定位，内容落到视口下方 | 主窗口和开发工具的 ConfigProvider 使用 Tauri 注入的 style nonce，保留原 CSP                       |
| 编辑器提示消息同样被 CSP 拦截                      | 在最初窗口修复后，新增取消编辑回归仍检出无 nonce 的动态 style                                          | 所有消息改用 `App.useApp()`；服务层绑定窗口的消息实例，避免静态 API 创建独立 React 根             |
| 主题切换文字闪烁                                   | 原实现使用普通 effect 更新 DOM，且对大量元素设置颜色过渡                                               | `useThemeDocument` 在 layout effect 中同步文档主题，取消全局颜色过渡，切换帧内暂时禁止 transition |
| 暗色占位文字过暗                                   | 原生 computed style 为 `rgba(0, 0, 0, 0.25)`，背景为 `rgb(30, 30, 46)`，对比度回归先失败               | 暗色主题使用 Ant Design `darkAlgorithm`，亮暗主题明确占位文字颜色                                 |
| 开发工具初始语言/主题和主窗口不一致                | 独立页面未等待持久化语言，且没有 store 加载权限                                                        | 增加只读 load/get capability，等待偏好后挂载，接收语言/主题事件且不回写偏好                       |
| 打开窗口失败时无反馈                               | 原打开流程未等待 created/error，聚焦异常被吞掉                                                         | 等待创建事件、处理超时及错误；重复点击共用打开中的 Promise；失败显示本地化消息                    |
| 设置/资源 lazy 加载时空白                          | Suspense fallback 为 null                                                                              | 使用可取消的加载 Modal                                                                            |
| 设置读取、通知权限、库导入导出和日志读取失败不可见 | 原路径仅写 console，部分配置以默认值继续可保存                                                         | Alert/消息及重试；日志配置读成功前禁用保存，保护未读取的原配置                                    |
| 日志停止/清空后被迟到响应重新填入                  | 监控读请求缺少生命周期标记                                                                             | generation 校验丢弃迟到结果；清空失败保留原内容；两个监控独立，失败停止定时器后可重试             |
| 便携模式前端偏好未隔离                             | Store 相对路径仍指向普通 AppData，早期探针影响了个人主题/语言                                          | Rust 返回当前模式的绝对偏好路径，前端 Store 使用该路径；runner 检查个人偏好前后哈希一致           |

开发工具偏好初始化失败也改为显示错误和重试按钮，避免仅记录 console 后继续使用默认状态；入口回归模拟读取失败，验证实际错误界面和日志监控未挂载。该异常分支由 Vitest 覆盖，未声称原生系统 I/O 故障已实测。

Tauri 的 CSP 处理和 Ant Design nonce/context API 与上述实测一致，参考 [Tauri CSP](https://tauri.app/security/csp/)、[Ant Design ConfigProvider](https://ant.design/components/config-provider/) 和 [主题配置](https://ant.design/docs/react/customize-theme/)。运行时行为以本地安装版本和实际 release 测量为准。

## 原生验证

使用隔离副本运行 `e2e-tests/specs/ui.e2e.cjs`，WebView2 `154.0.4258.53`，主窗口 CSS 视口 1400 × 850，开发工具 900 × 700。测试不读取个人后端配置或凭据，不调用 AI 服务。

六组回归全部通过：生产 CSP/设置定位和占位文字、五个设置标签与下拉框、四次主题切换的 80 个绘制帧、文件菜单和两个库弹窗、编辑取消提示及焦点内 Ctrl+S 保存、开发工具初始偏好/日志标签/独立暂停/同步和窗口复用。

每次主题切换检查 html/body 一致、文字和背景没有中间颜色；所有已注册且有内容的 Ant Design style 都具有 nonce、有效 sheet 和规则。取消编辑后 textarea 回到原值，保存后从隔离样本磁盘读取 `msgstr "本地检查"`，验证真实 Rust 输出。

占位文字实测对比度：暗色 7.37:1、亮色 5.49:1，均通过此回归的 3:1 可读性阈值；该测量只针对模型占位文字，不代表全界面无障碍审计。

| 验证                                                         | 结果                                                                              |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| Vitest 全量                                                  | 26 个文件、92 项通过                                                              |
| 打包/隔离脚本回归                                            | 6 项通过                                                                          |
| Rust `--locked --features ts-rs`                             | 161 项通过                                                                        |
| Clippy `--locked --all-features --lib --bins -- -D warnings` | 通过                                                                              |
| 真实 release WebView2                                        | 6 组通过                                                                          |
| 原生 `SC_CLOSE`                                              | 4 个独立场景通过，清理前确认进程退出                                              |
| `tauri:build -- --no-bundle`                                 | 构建成功，包含 TypeScript 检查                                                    |
| 便携 ZIP                                                     | 8 个白名单条目：exe、6 个插件 TOML、新 PORTABLE 标记；内置 exe 哈希与受测文件相同 |
| 格式与国际化                                                 | Prettier / cargo fmt 通过；i18n 检查完成，保留动态键候选                          |

受测 exe 构建时间为 2026-10-03 20:49:25（Asia/Shanghai），SHA-256 为 `937A65657B041099359547C9154B9D6456CB50888EFD487C13A3AF4164246228`。便携包 SHA-256 为 `FF9A55BCBD047C33E6063C9112A6F38BCD512BAADD16615D66F7D13E8D2A9899`。直接运行此 release exe 可测试这些已编译修复；修改源码后须重新构建，旧 exe 不会自动包含新代码。

PO 导入通过已有 `tauri://drag-drop` 事件驱动正常处理器，未实测 OS 文件对话框和鼠标拖放。关闭专项覆盖无修改、取消/放弃、保存失败重试及子窗口退出；真实供应商请求期间退出仍未实测。原生通知、供应商配置保存/联网、完整翻译/确认、大文件性能和其他机器 DPI/分辨率不能从本报告推断全部通过。错误重试、窗口创建失败、日志迟到响应和偏好路径另有 Vitest 回归；mock 不代表真实系统权限故障已复现。

本仓库图谱建立未成功，覆盖检查返回未索引；本轮结论来自对应源码、回归测试和原生测量，不以图谱作完整性证明。

## 证据

- [修复前设置](audits/2026-10-03/ui-runtime/before-settings.png) / [CSSOM 与位置](audits/2026-10-03/ui-runtime/before-settings.json)。
- [修复前开发工具](audits/2026-10-03/ui-runtime/before-devtools.png) / [CSSOM](audits/2026-10-03/ui-runtime/before-devtools.json)。
- [修复后设置](audits/2026-10-03/ui-runtime/after-settings.png)、[记忆库](audits/2026-10-03/ui-runtime/after-open-memory-manager.png)、[术语库](audits/2026-10-03/ui-runtime/after-open-term-manager.png)。
- [修复后开发工具](audits/2026-10-03/ui-runtime/after-devtools.png)、[编辑保存](audits/2026-10-03/ui-runtime/after-editor.png)。
- [主题帧 0](audits/2026-10-03/ui-runtime/theme-frames-0.json)、[帧 1](audits/2026-10-03/ui-runtime/theme-frames-1.json)、[帧 2](audits/2026-10-03/ui-runtime/theme-frames-2.json)、[帧 3](audits/2026-10-03/ui-runtime/theme-frames-3.json)。
- [实际生产 CSP](audits/2026-10-03/ui-runtime/production-csp.txt)、[验证与构建摘要](audits/2026-10-03/ui-runtime/validation.json)。最终版本的命令完整输出保存在 `audits/2026-10-03/window-close/*.log`，按仓库规则不纳入 Git。
- [暗色占位文字对比度](audits/2026-10-03/ui-runtime/placeholder-contrast-dark.json)、[亮色对比度](audits/2026-10-03/ui-runtime/placeholder-contrast-light.json)、[修复前低对比度截图](audits/2026-10-03/ui-runtime/before-contrast.png)。

## 个人偏好隔离与恢复

早期测试副本已经隔离 Rust 配置、记忆和术语数据，但旧 Store 相对路径仍访问普通 AppData，实际影响了个人主题/语言。恢复前保留 `C:/Users/xiybh/AppData/Local/Temp/ai-l10n-ui-test-preferences-20261003.json`，仅恢复 `theme=dark`、`language=zh-CN`，其他字段保留。该恢复对应已知的中文深色外观，不能声称恢复了无法确认的原始 theme 模式或原文件字节。

修复后的原生 runner 检查普通偏好文件前后哈希一致；可提交报告只记录校验结果，不保存个人文件哈希。测试副本及自建驱动进程按所有权清理，个人恢复备份保留。
