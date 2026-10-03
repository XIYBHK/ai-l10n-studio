# 其他功能模块逻辑复核

> 本文是修复前的审计基线，复现证据对应当时的工作树。A1–A6、B1–B3 已处理，目录翻译 IPC 已移除，多格式占位成功已改为明确错误。当前交付和验证边界见 [LogicFixes.md](../../LogicFixes.md)。

日期：2026-10-03。基线：`HEAD 2dc06ba` 加当前未提交工作树，**不是只审查 HEAD**。本轮只新增审计报告和复现证据，未修复下述业务问题，未提交或重新打包程序。

术语库、翻译记忆库已经单独复核，发现项仍见 [TermMemoryAudit.md](TermMemoryAudit.md)。这里继续检查文件读写、编辑器与选择、语言切换、异步翻译与取消、模型配置与插件、统计及设置。

结论：当前主流程有 **6 项 P1 问题**，涉及数据保留、保存、语言一致性和内置供应商请求。另有累计费用、通知设置等 P2 问题。目录翻译、多格式元数据及大文件工具的遗留问题单独列出，不能据此断言当前主界面所有相似功能都有问题。

## 当前主流程优先问题

### A1 / P1：普通新文件名无法“另存为”【运行时复现】

- 触发：打开 PO 后，另存为同目录中尚不存在的 `output.po`。
- 原因：保存命令复用 `SafePathValidator::validate_file_path`；它要求文件已经存在，只有路径字符串包含 `new_` 才例外。
- 影响：正常新文件名被拒绝；`new_output.po` 却能通过。这是名称依赖的校验错误。
- 证据：[path_validator.rs](../../../src-tauri/src/utils/path_validator.rs):20–45；[translator.rs](../../../src-tauri/src/commands/translator.rs):213–227；[useTranslationFlow.ts](../../../src/hooks/useTranslationFlow.ts):136–155。
- 探针：对同一临时目录中的两个不存在路径调用真实校验器，观察到 `output.po` 报“路径不存在”，`new_output.po` 成功。没有写入用户文件。
- 修复与验收：区分读取路径与输出路径校验。输出允许不存在的文件，但要求父目录合法；测试任意正常新名称、已存在目标和无效父目录。

### A2 / P1：文件保存不包含编辑器中尚未提交的草稿【组件探针 + 调用链】

- 触发：在译文框输入内容，不按 `Ctrl+Enter`，直接按 `Ctrl+S` 或进入文件保存操作。
- 原因：草稿在 `useEditorState` 的局部状态中；文件保存只读取 `useTranslationStore.entries`。全局 `Ctrl+S` 没有提交草稿步骤，输入框失焦到任意 `button/select` 时又跳过自动保存。
- 影响：文件保存可以显示成功，写出的却是旧译文；随后切换文件或退出可能丢失刚输入的内容。
- 证据：[useEditorState.ts](../../../src/hooks/useEditorState.ts):4–25；[TargetSection.tsx](../../../src/components/editor/TargetSection.tsx):80–90；[AppShell.tsx](../../../src/AppShell.tsx):96–103；[useTranslationFlow.ts](../../../src/hooks/useTranslationFlow.ts):141–154。
- 探针：使用真实 `EditorPane`、真实 store 和普通按钮，输入草稿后点击按钮，按钮读到旧 store 值，编辑器仍显示草稿。**探针未直接操作原生文件对话框**；`Ctrl+S` 到保存的衔接来自上述源码。
- 修复与验收：统一“编辑草稿 → 文档 → 文件”的提交顺序。覆盖聚焦输入框时 `Ctrl+S`、鼠标保存、取消编辑、保存失败；不能只靠 blur 的偶然触发。

### A3 / P1：打开其他文件会直接丢弃未落盘修改【运行时复现】

- 触发：将人工译文保存到条目，但未保存 PO 文件，随后打开或拖入另一文件。
- 原因：`loadFile` 解析成功后直接 `setDocument`；store 没有文件级 dirty 标记或保存快照。`documentRevision` 是文档身份版本，人工修改并不更新它，不能充当 dirty 状态。
- 影响：内存修改直接被新文档替换。编辑器的“已保存”只代表条目提交，容易被理解为已落盘。
- 证据：[useTranslationFlow.ts](../../../src/hooks/useTranslationFlow.ts):68–81、106–117；[useTranslationStore.ts](../../../src/store/useTranslationStore.ts):103–147；[EditorPane.tsx](../../../src/components/EditorPane.tsx):81–95。
- 探针：先用真实更新入口修改条目，再通过 mock 文件接口打开另一文档，原修改消失，保存接口未调用。当前 `src/` 和窗口初始化链中也未找到关闭窗口的 dirty 拦截；**未实测原生窗口关闭**。
- 修复与验收：文件级 dirty 状态覆盖人工修改、AI 回包、确认/清空和元数据修改；打开、拖入、关闭共用保存/放弃/取消流程，取消须保留原文档。

### A4 / P1：晚到的 AI 结果覆盖已提交的人工译文【运行时复现】

- 触发：启动翻译，在该条 AI 结果返回前手动编辑并提交同一条目。
- 原因：流式回包只检查任务代次和文档身份，没有检查该翻译槽自请求发出后是否已被人工修改；随后无条件赋值 `msgstr/msgstr_plural`。当前编辑器在翻译期间可编辑。
- 影响：已经提交到条目的人工译文被 AI 内容覆盖，又变为待确认。跨文档隔离正确，但无法保护同文档内的并发修改。
- 证据：[useTranslationFlow.ts](../../../src/hooks/useTranslationFlow.ts):169–175、192–214；[useTranslationStore.ts](../../../src/store/useTranslationStore.ts):122–147；[TranslationWorkspace.tsx](../../../src/components/TranslationWorkspace.tsx):131–133。
- 探针：暂停模拟翻译，写入 `Human translation`，再投递 `Late AI translation`，最终条目为后者且 `needsReview=true`。
- 修复与验收：对每个请求槽记录修改版本或基线，结果提交时进行冲突检查；保留人工内容并给出可审阅的候选结果，覆盖普通和复数槽。

### A5 / P1：切换目标语言后，文件头与复数规则仍属于旧语言【运行时复现】

- 触发：打开 `Language: fr` 的 PO，将目标语言改为 `ja`，翻译或保存。
- 原因：`setTargetLanguage` 只改变独立字段；`persistFile` 原样沿用 `document.metadata`，翻译槽也仍按旧 `Plural-Forms` 构造。
- 影响：目标译文与保存的语言头不一致；跨复数规则不同的语言时，槽数量和含义也可能不适合新语言。重新打开后又读取旧语言头。
- 证据：[useTranslationStore.ts](../../../src/store/useTranslationStore.ts):177–180；[useTranslationFlow.ts](../../../src/hooks/useTranslationFlow.ts):150–154、179–184、229–231；[poDocument.ts](../../../src/utils/poDocument.ts):40–75。
- 探针：store 目标已为 `ja`，实际传给保存接口的文档仍为 `Language=fr`、`nplurals=2; plural=n>1;`。
- 修复与验收：明确目标语言切换是修改文档还是另建目标文档，同时处理语言头、复数规则和现存译文。不要只改 `Language` 字符串就宣称完整支持跨语言切换。

### A6 / P1：旧“添加内置供应商”路径重复拼接请求端点【静态确认】

- 触发：通过“添加内置供应商”创建 OpenAI、DeepSeek 或智谱配置，保留默认地址后连接/翻译。
- 原因：`addBuiltin` 原样复制插件 `default_url` 到 `baseUrl`。这些 TOML 地址已包含 `/chat/completions`，运行时又追加一次。中间仅移除尾部 `/`，没有移除协议路径。
- 影响：例如 OpenAI 请求变成 `https://api.openai.com/v1/chat/completions/chat/completions`，正常服务不会按期望处理该请求。
- 证据：[AIConfigTab.tsx](../../../src/components/settings/AIConfigTab.tsx):125–145；[plugin_loader.rs](../../../src-tauri/src/services/ai/plugin_loader.rs):263–265；[OpenAI 插件](../../../plugins/openai/plugin.toml):16；[DeepSeek 插件](../../../plugins/deepseek/plugin.toml):16；[智谱插件](../../../plugins/zhipu/plugin.toml):16；[ai_translator.rs](../../../src-tauri/src/services/ai_translator.rs):117–121、325–329。
- 边界：刚增加的六个国产快捷预设使用协议基础地址，不受这个拼接问题影响。Moonshot 的旧目录地址本身为基础地址，也不属于此重复后缀案例。旧 Gemini/MiniMax 目录地址与默认 OpenAI 协议的搭配也需一并核对，不能把所有旧目录项直接当成可用配置。
- 修复与验收：统一目录地址/协议契约；本地 HTTP mock 断言每个内置入口最终发出的路径，而非仅测试配置保存成功。

## 其他当前问题

| 编号 / 级别 | 确认的行为与影响                                                                                            | 证据与边界                                                                                                                                                                                                                                                                                                                                                          |
| ----------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B1 / P2     | 未配置价格的模型会增加 token，但累计卡片仍将未计价部分显示为数值 `0`；累计结构也不保存价格是否已知。        | [ai_translator.rs](../../../src-tauri/src/services/ai_translator.rs):382–401；[CumulativeStatsSection.tsx](../../../src/components/aiWorkspaceSections/CumulativeStatsSection.tsx):38、137–143；[useStatsStore.ts](../../../src/store/useStatsStore.ts):53–103。当前会话卡片在当前模型无目录价格时已有“价格未配置”显示，成本估算 API 对未知模型返回错误；不能把这些正确路径一起判错。 |
| B2 / P2     | 通知开关仅改变内存，重启恢复默认启用；页面宣称翻译完成通知，但所查 `src/` 中业务通知方法没有实际调用者。    | [NotificationTab.tsx](../../../src/components/settings/NotificationTab.tsx):13–25、61–64；[notificationManager.ts](../../../src/utils/notificationManager.ts):32、134–157。这是状态不持久化和功能未接入，不能声称已实测重启后发送了通知。                                                                                                                                       |
| B3 / P3     | 插件价格字段注释写 CNY/1K，加载器和模型计算器却按 USD/1M 直接使用数值。按注释编写第三方插件会得到错误估价。 | [plugin_config.rs](../../../src-tauri/src/services/ai/plugin_config.rs):79–82；[plugin_loader.rs](../../../src-tauri/src/services/ai/plugin_loader.rs):279–286；[model_info.rs](../../../src-tauri/src/services/ai/model_info.rs):34–48。这里确认的是契约矛盾，未据此断言所有现存内置价格错误；应统一单位并测试插件契约。                                                             |

## 遗留入口和未完成能力

以下问题的优先级低于可直接丢数据的主流程缺陷。

- **目录翻译**：`translate_directory` 仍在后端注册，但在整个 `src/` 中未找到 wrapper/caller/界面入口。它没有任务注册和取消 token，现有取消 API 无法取消该路径；不能扩大为“主界面停止按钮无效”。该路径单文件失败时固定报告 `failed=1`、`total_entries=0`，把文件失败混入条目计数。递归扫描还跟随 `is_dir()`，无 visited 集或链接边界，联接环可能造成重复扫描或错误；未创建环或触发崩溃，不能断言必然无限递归。证据：[translator.rs](../../../src-tauri/src/commands/translator.rs):91–102、231–250；batch_translator.rs（历史引用，当前文件已移除）:145–187、276–303、429–441。
- **多格式元数据**：XLIFF/YAML 的元数据实现返回占位零计数；当前文件编辑主链和对话框均为 PO。枚举中出现格式不等于已实现相应导入导出。证据：[file_format.rs](../../../src-tauri/src/services/file_format.rs):185–207；[fileCommands.ts](../../../src/services/fileCommands.ts)。
- **大文件工具**：`FileAnalyzer/chunk_vec` 没有接入当前读文件路径，PO 仍全量读入。确认的是未接入；没有做超大文件内存/耗时测试，不给出性能幅度或容量上限。证据：file_chunker.rs（历史引用，当前文件已移除）、[po_parser.rs](../../../src-tauri/src/services/po_parser.rs):60–64。
- **编辑器内部导航**：组件传入 `onNavigatePrev/Next` 时，工具栏切换及 `Ctrl+箭头` 会丢弃未提交草稿，两个组件探针已复现；但当前 `TranslationWorkspace` 没传这两个回调，不能列作当前主界面已可达的丢稿路径。对应快捷键和导航能力也尚未接通。证据：[EditorPane.tsx](../../../src/components/EditorPane.tsx):140–149；[TranslationWorkspace.tsx](../../../src/components/TranslationWorkspace.tsx):132。

## 已核对的正确边界

- 主翻译 Channel 与精翻入口使用独立 taskId；收到 taskId 前的取消会排队，旧文档结果不会应用到新文档；累积统计使用差值而非重复累计总量。
- 当前 PO 读写保留复数、上下文、注释、fuzzy 和 obsolete；写文件采用临时文件替换。**写入原子性不能弥补写入前拿到旧草稿的问题。**
- `ConfigDraft.transaction` 在持锁事务中验证和持久化后发布；密钥独立保存，不通过模型配置查询回填前端。
- 日志级别即时生效，轮转/保留在重启后生效；当前中英文页面已明确写出这个区别。该项已从初筛疑点中排除。
- 刚新增的国产快捷预设保存供应商与默认模型使用同一事务；本轮没有把旧插件目录入口的缺陷误归到快捷预设。

## 验证证据与范围

本轮执行 **7 条隔离诊断断言**，全部命中预期的当前缺陷：3 条 flow hook、3 条编辑器组件、1 条 Rust 路径校验；其中编辑器 2 条是未接入主界面的潜在路径。**探针通过意味着复现成立，不是功能验收通过，也不是问题已修复。**

- [flow/path 结果与重放命令](../../audits/2026-10-03/flow-path-probes.result.txt)
- [flow 探针源码](../../audits/2026-10-03/flow-probe.test.ts.txt)
- [路径探针源码](../../audits/2026-10-03/path-probe.rs.txt)
- [编辑器探针结果](../../audits/2026-10-03/editor-probe.result.txt)
- [编辑器探针源码](../../audits/2026-10-03/editor-probe.test.tsx.txt)

临时可执行测试已从测试目录移除，保留文本源码和结果，避免将“断言错误行为”混入长期回归测试。没有运行真实 AI、修改真实配置或用户 PO；没有做 Windows 文件锁/网络盘故障注入、原生窗口关闭、重启通知、极大文件压力测试。模型 URL 问题以当前源码和配置确认，未消耗 API 额度做外部请求。

本仓库图谱仍未建立，索引尝试中断且覆盖检查返回 `project not found or not indexed`，因此本轮采用有范围的源码阅读、`rg` 和实际探针。结论覆盖上述链路，不宣称全仓库已无其他问题。

## 建议修复顺序

1. A1–A4：先建立可靠的编辑、保存和并发提交语义，防止内容丢失或覆盖。
2. A5–A6：处理目标语言/复数契约与内置模型入口，避免生成错误文件或请求。
3. 按 [两类库审计](TermMemoryAudit.md) 修复人工确认入库、语言/上下文隔离、精确术语约束与事务写入。
4. B1–B3 和遗留入口：修正统计与设置契约，明确保留并补齐哪些功能、移除哪些未接入入口。

每一组修复将对应探针改写为正确行为断言，再纳入正式测试；不以单纯构建成功作为逻辑验收。
