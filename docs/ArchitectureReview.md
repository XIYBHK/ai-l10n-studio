# 整体复查与架构收敛

核验日期：2026-10-03。范围为前后端、配置与插件、持久化、测试入口和现行文档。按用户授权直接替换不合理结构，不保留旧接口兼容层。验证记录对应提交前的完整实现，提交与推送状态以 Git 历史为准。

## 已完成的调整

| 范围           | 发现与调整                                                                                                                                                                                      | 验证依据                                                  |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Rust 入口      | main 与 library 原先各自声明服务模块，重复编译和运行同一套测试。main 现仅调用 library `run()`，初始化和 54 个 IPC handler 在同一入口注册。                                                      | library 测试、all-features Clippy、release 构建           |
| 配置事务       | 移除未被业务使用的 draft/apply 生命周期和可绕过事务的 update；系统提示词也统一经 transaction 校验、持久化后发布。去掉未生效的旧配置字段，主题与语言由 Tauri store 持有。                        | 失败事务保持内存、磁盘和版本不变的回归                    |
| 启动与失败状态 | 等待偏好、累计统计加载并应用语言后挂载 UI，防止晚到的持久化状态覆盖用户操作。模型读取失败显示重试，只有成功读取空配置才自动打开设置。                                                           | bootstrap 与 AppShell 回归                                |
| 翻译状态       | Channel hook 只处理任务、取消、事件与最终结果补偿；移除其重复 React 状态和未使用的统计 props。活动模型读取不再顺带订阅普通配置与系统提示词。                                                    | Channel、翻译 flow、文档生命周期回归及类型检查            |
| 主题           | 主窗口一个 runtime hook 负责系统监听、DOM 和跨窗口广播；其他组件只读取主题。开发工具在异步 listen 晚于卸载返回时立即清理。                                                                      | 多消费者下单监听/单广播、延迟订阅释放回归                 |
| 插件与费用     | 价格使用可选值，显式 `0` 保持零价，缺失值才采用既有输入价回退；provider 元信息借用现有字符串，移除 `Box::leak`。TOML 拒绝无效/未知字段，示例与真实解析契约一致。                                | TOML → model → cost 回归、6 个内置与 3 个示例目录解析     |
| IPC 类型与日志 | 文件元数据、术语库、内置短语响应由 Rust 生成 TypeScript；修正文件信息组件读取旧字段名的问题。日志命令独立成模块，清空日志传播磁盘错误。IPC 日志递归脱敏嵌套凭据，移除 any 和未使用的 raw 入口。 | 生成类型、TypeScript、日志磁盘失败与嵌套脱敏回归          |
| 遗留代码       | 删除未接入的旧目录翻译器、独立 chunker、providers/models 旧源码和插件 Rust 示例，仅保留当前 TOML catalog 与 Channel 路径。                                                                      | 源码调用检查、完整测试与构建                              |
| E2E 隔离       | 原脚本可能删除被测 exe 旁的便携配置。现复制 exe/插件到独立 run 目录，创建新数据并验证目录与所有权后清理；Windows 调用使用 pwsh 和无 shell 子进程。                                              | 原配置保留、越界清理拒绝回归；真实 release 桌面启动 smoke |

## 文档清理

- 重写 [Architecture.md](Architecture.md)、[API.md](API.md)、[DataContract.md](DataContract.md) 以及对应 AGENTS，按当前职责、IPC 和类型说明实现，不保留固定行号及旧模块数量。
- 更新 README、主题、颜色、安全、插件示例、脚本和 E2E 指南；去掉自动学习未经确认 AI 译文、旧 ConfigManager、可用多格式编辑、无凭据预览和已启用 updater 等不符合当前实现的描述。
- 旧架构快照、两份修复前审计移至 [日期归档](archive/README.md)，旧 `specs/001-bug-7` 阶段方案移至 [specs 归档](archive/specs/001-bug-7/STATUS.md)。历史证据保留，现行索引指向当前契约。
- [LogicFixes.md](LogicFixes.md) 保留前一轮逻辑修复、旧库重建及真实 DeepSeek 验证记录；[ERRORS.md](ERRORS.md) 补充本轮问题与防止重现的边界。

## 验证

| 检查                                                               | 结果                                                  |
| ------------------------------------------------------------------ | ----------------------------------------------------- |
| `npm run test:run -- --reporter=dot`                               | 22 个文件，77 项通过                                  |
| `cargo test --locked --features ts-rs --quiet`                     | library 161 项通过；二进制不再重复运行模块测试        |
| `npm run test:scripts`                                             | 6 项通过                                              |
| `npx tsc --noEmit`                                                 | 通过                                                  |
| `cargo clippy --locked --all-features --lib --bins -- -D warnings` | 通过                                                  |
| `npm run i18n:check`                                               | 通过；动态键候选保守保留                              |
| `npm run lint:all`                                                 | Prettier 与 Cargo fmt 通过                            |
| `npm run tauri:build -- --no-bundle`                               | Windows x64 release 构建通过                          |
| release 桌面 smoke，`--spec ./specs/app.e2e.cjs`                   | 1 项通过，WebView2 154.0.4258.53；取得 webview handle |

机器可读记录及包校验见 [architecture-review.result.json](audits/2026-10-03/architecture-review.result.json)。便携包位于 `src-tauri/target/release/PO-Translator_1.0.0_x64_portable.zip`，仅携带 exe、6 个插件和全新 PORTABLE 标记。

此前 lib/bin 的测试数量包含重复模块测试。当前还移除了已删除模块的测试，并新增真实边界回归；不能直接把测试数量下降解释为覆盖减少或增加。

## 保留边界

- 结构图谱索引多次中止，最终 coverage 查询仍返回项目未索引。本轮结论来自相关源码、调用搜索和测试，不声称图谱已验证全仓库穷尽性。
- 桌面 smoke 只验证原生进程、WebDriver 和 webview handle。它不保证编辑、关闭确认或通知送达的完整桌面流程；这些行为已有组件/服务回归，原生送达仍未专项实测。
- 未执行新的远程 AI 请求。此前授权 DeepSeek 实测记录保留，其他供应商没有据此获得可用性保证；catalog 价格也没有重新核验。
- PO 仍完整读入，未声称超大文件性能改善。JSON 是检测/元数据，XLIFF/YAML 明确不支持编辑。
- 旧库格式不迁移，读取错误保留原文件；此前授权的个人库重建已有独立备份。本轮 E2E 不接触日常配置和库。
