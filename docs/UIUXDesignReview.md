# UI/UX 设计审查

审查日期：2026-10-04。源码基线：`614db8288cb2d1cd4f0b901990688c415d810d92`。

已安装并实际使用 [UI/UX Pro Max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) 的 `SKILL.md`、桌面适用的 `quick-reference.md` 和本地检索脚本。安装目录为 `C:/Users/xiybh/.codex/skills/ui-ux-pro-max`。本轮是审查，应用源码未修改。

## 结论

原紫色配色是早期 AI 的设计选择，不能当作用户品牌需求。此文记录修复前的审查基线；用户随后明确要求基于 UI/UX Pro Max 优化现有前端。新的视觉实现与 release 验收见 [UIRefinement.md](UIRefinement.md)，本文件中的问题和截图保留为修复前证据。

确认 7 项问题，其中 2 项应优先修复。以下区分真实 release 复现、源码确认和颜色计算，不把规则库建议直接当作应用缺陷。

| 编号 | 优先级 | 问题                                              | 验证方式                                  |
| ---- | ------ | ------------------------------------------------- | ----------------------------------------- |
| F1   | P1     | 记忆库关闭丢弃未保存修改，缺少确认                | release 行内修改、关闭、重新打开          |
| F2   | P1     | 高级供应商保存成功提示被 CSP 拒绝，落到可视区域外 | release 保存虚拟供应商、DOM/样式和截图    |
| F3   | P2     | 英文状态筛选在允许的最窄列表宽度下裁切、互相挤压  | release 1000×700，键盘将列表缩到 260px    |
| F4   | P2     | AI 工作区覆盖编辑按钮，键盘仍可进入被遮住的控件   | release 1000×700，实际 Tab 导航、命中测试 |
| F5   | P2     | 库表格编辑字段缺少可访问名称                      | 记忆库 release 计算名称；术语库源码       |
| F6   | P2     | 亮色来源标签文字对比度不足                        | release 实际 CSS token 与源码使用关系计算 |
| F7   | P2     | 英文界面仍有中文导航和条目状态可访问文本          | release DOM 与源码                        |

## F1：关闭记忆库前保护修改

位置：`src/components/MemoryManager.tsx:394`（行内编辑）、`:174`（显式保存）、`:482`（直接 `onClose`）；`src/components/AIWorkspace.tsx:158` 起由可见状态决定是否挂载管理器。

实际操作：打开记忆库，修改第一行原文，点右上角关闭，重新打开。修改前字段为 `XTools|Random`，修改后为 `XTools|RandomUI audit unsaved edited source`，重新打开恢复 `XTools|Random`。关闭期间没有保存/放弃确认。字段修改只在本地 state，关闭后组件被卸载。

建议：以加载时的快照判断 dirty；关闭按钮、取消、Esc、遮罩和应用退出使用一致的未保存保护，提供保存、放弃、继续编辑。保存失败时保留草稿。验收不能只检查关闭按钮能否工作，还要验证数据不会被无提示丢弃。

证据：[操作结果](audits/2026-10-04/ui-ux/interaction-results.json)、[修改后](audits/2026-10-04/ui-ux/memory-unsaved.png)、[重新打开](audits/2026-10-04/ui-ux/memory-reopened.png)。依据：skill `sheet-dismiss-confirm`。

## F2：高级设置仍绕过消息上下文

位置：`src/components/settings/AIConfigTab.tsx:16` 导入静态 `message`；`:123` 保存成功、`:160` 模型发现成功、`:171`/`:172` 连接测试结果沿用静态 API。

实际操作：在隔离副本中添加 `ui-audit-local`，填写无密钥的本地地址 `http://127.0.0.1:11434/v1` 和虚拟模型 ID，点击保存。供应商卡片已出现，配置保存成功，但“供应商已保存”不在可视区域。消息节点的矩形为 `x=-700, y=850, width=1400, height=24`，当时视口为 `1400×850`。新插入的 5 个样式节点均没有 nonce，`sheet` 不可用；默认消息样式未被生产 CSP 接受。

建议：从 `App.useApp()` 取消息实例，沿用现有上下文、主题与 nonce。所有高级设置反馈路径统一处理。验收需同时确认消息可见、样式有效、两种主题正常和业务实际结果。

证据：[反馈 DOM/样式](audits/2026-10-04/ui-ux/provider-feedback.json)、[保存后界面](audits/2026-10-04/ui-ux/provider-feedback.png)。依据：skill `success-feedback`、`error-feedback`、`dark-mode-pairing` 和项目 CSP 约定。

注意：曾怀疑 `AIConfigTab.run` 的 catch 导致所有远程失败静默。沿 `aiCommands → apiClient → reportUiError` 核验后排除了该判断：IPC 异常已有上下文消息提示。这里确认的是高级设置直接使用静态消息的路径，不能扩大成“全部设置反馈失效”。

## F3：最窄列表的英文筛选标签不可完整阅读

位置：`src/components/entryListParts/StatusColumns.tsx:64` 使用 `Segmented block`；`src/components/EntryList.module.css:65` 起设置紧凑标签；列表最小宽度在 `src/components/TranslationWorkspace.tsx:123`。

实际操作：1000×700 的英文窗口，聚焦分隔条并按四次左箭头，把列表从 320px 缩到允许的 260px。前两个标签的可用宽度约 76px，内容宽度分别为 83px、84px。`Untranslated 28` 与 `Needs Review 2` 被裁切、挤压，状态名称和数量难以区分。

建议：根据最窄宽度和英文标签共同确定布局；可用非等分布局、窄宽下的状态下拉或带完整名称的紧凑选项。不要继续缩小文字，也不要仅增加鼠标悬停提示。计数增大和四位数条目也应纳入验收。

证据：[截图](audits/2026-10-04/ui-ux/editor-min-list-en.png)、[宽度测量](audits/2026-10-04/ui-ux/interaction-results.json)。依据：skill `compact-label-overflow`、`chip-collection-reflow`。

## F4：覆盖式 AI 工作区缺少焦点管理

位置：`src/components/TranslationWorkspace.module.css:101` 起使用绝对定位和 `z-index: 5` 覆盖编辑区域；`src/components/TranslationWorkspace.tsx:94` 起只切换可见状态，未管理被覆盖区域的焦点。

实际操作：1000×700 打开 AI 工作区，聚焦列表分隔条后按两次 Tab。焦点进入“复制原文到剪贴板”，但按钮中心的命中对象属于覆盖层，按钮及焦点不可见。确认按钮和编辑区右侧也被覆盖。

建议：明确采用占位侧栏或模态抽屉。占位方案需保证编辑区仍可用；模态方案复用 Ant Design Drawer 的焦点、Esc 和关闭恢复，并使被覆盖内容不能接收操作。不要把非模态覆盖层仅加上 `aria-modal` 就视为修复。

证据：[焦点截图](audits/2026-10-04/ui-ux/overlay-focused-copy.png)、[命中测试](audits/2026-10-04/ui-ux/interaction-results.json)。依据：skill `focus-not-obscured`、`keyboard-nav`、`escape-routes`。

## F5：库编辑字段需要稳定的名称和标签

位置：`src/components/MemoryManager.tsx:417`、`:430` 的表格 Input；`:529`、`:548`、`:554` 的搜索/新增 Input；`src/components/TermLibraryManager.tsx:177` 的行内 TextArea。

实际记忆库表格中，20 个已渲染的行内输入框的 `getComputedLabel()` 均为空。表头不自动成为每个输入的名称。新增区和搜索输入的计算名称来自 placeholder，不能笼统称为完全无名，但填写后没有持续可见的字段标签。术语库 TextArea 没有 label 或 aria-label，此项仅作源码确认。

建议：新增区使用关联 label；行内字段提供本地化名称，包含原文/译文语义和行身份。避免将整段长原文直接塞入名称。验证读屏用户进入编辑框时能确定当前字段及行，且键盘操作顺序合理。

证据：[计算名称](audits/2026-10-04/ui-ux/interaction-results.json)。依据：skill `form-labels`、React `Label form controls`。

## F6：亮色来源标签使用浅色前景

位置：`src/index.css:65` 起；标签使用处为 `src/components/entryListParts/VirtualizedColumn.tsx:105` 和 `src/components/editor/TargetSection.tsx:56`。

使用本轮 release 的 CSS token，将半透明标签背景合成到实际 `bgPrimary=#ffffff` 后计算：

| 来源 | 亮色对比度 | 暗色对比度 |
| ---- | ---------- | ---------- |
| TM   | 2.088:1    | 5.931:1    |
| 去重 | 2.905:1    | 6.235:1    |
| AI   | 1.780:1    | 7.763:1    |

这类文字为 11–12px，亮色三个组合均低于 skill 的普通文字 4.5:1 建议。暗色组合通过该阈值。这里是确定的颜色计算；本轮 PO 文件未产生来源标签，没有执行真实 AI 翻译来截图这些状态。

建议：在 token SSOT 中提供亮色专用深色前景，保留较淡的背景和来源文字，不只靠颜色区分。复验所有来源、选中/悬停状态及两种主题。

证据：[计算方法与结果](audits/2026-10-04/ui-ux/source-contrast.json)。依据：skill `color-contrast`、`color-dark-mode`。

## F7：英文界面的可访问文案仍混用中文

位置：`src/components/editor/EditorToolbar.tsx:136`、`:144` 的导航 aria-label/title；`src/components/EditorPane.tsx:147`、`:184` 的区域名称；`src/utils/accessibility.ts:86` 起的条目状态名称，经 `VirtualizedColumn.tsx:83` 拼接。

切换 English 后，列表实际 aria-label 为 `Item 1: 第 1 条，未翻译`，导航按钮仍为“下一项 (Ctrl+下箭头)”，编辑器区域也保留中文。英文可见文案已经切换，可访问名称没有同步。

建议：把所有实际调用的可访问文案纳入当前 i18n，避免只替换可见按钮文字。分别验证中英文的按钮名称、区域、列表状态和快捷键提示。

证据：[英文 DOM 快照](audits/2026-10-04/ui-ux/editor-narrow-en-light.json)。依据：skill `aria-labels`、`voiceover-sr` 和项目 i18n 约定。

## 视觉调整建议

- 保留现有桌面工具的信息密度和字体栈；skill 的移动端 16px 正文、44pt/48dp 目标并不是本应用的机械验收条件。
- 1000×700 英文编辑器中，状态栏把 `Line: 19`、字符数量、状态和快捷键拆成多行。优先为状态和数字保留完整短语，把长快捷键提示收进帮助入口；不通过进一步缩小字体解决。
- AI 工作区空状态同时出现顶部“准备好开始了”和中心同文案，重复信息可以收敛，留出资源和真实任务反馈的位置。
- 库管理器在小窗口有外层与表格内层滚动。可使主要操作固定并优先让表格滚动，减少寻找保存/取消按钮的成本；这属于布局改进，不等同于确认按钮当前不可操作。

## 方法、交付与边界

真实 release 程序：`src-tauri/target/release/po-translator-gui.exe`，构建时间 2026-10-03 20:49:25，SHA-256：`937A65657B041099359547C9154B9D6456CB50888EFD487C13A3AF4164246228`。本轮没有重新构建或修改应用源码。通过仓库现有隔离运行器复制程序及资源，使用独立便携配置，测试副本已清理；没有 AI 请求或真实密钥。

检查中英文、亮暗色及 1400×850、1000×700 CSS 视口；截图设备比例为 2。布局采集在 AI 工作区懒加载结束后进行。三类最终探针均完成：布局采集、库编辑/键盘交互、供应商反馈。探针运行成功表示成功采集/复现，不表示审查项通过。

早期探针曾出现选择器错误；反馈探针还遇到单数字端口被表单 URL 规则拒绝。诊断并修正探针后，使用常见本地地址完成保存。未将这些探针失败直接报成产品缺陷。未覆盖真实读屏软件、所有模型/网络失败、完整业务流程、Windows 文件选择对话框或各类 DPI/系统字体缩放。

结构发现使用 codebase-memory，逐文件覆盖检查显示 `no_recorded_issue`，但新鲜度为 `metadata_changed`；因此本报告的结论以本轮直接源码核验和实际 release 证据为准，不声称图谱已证明整个前端没有其他问题。

本地 skill 检索覆盖 `text contrast light dark`、`keyboard focus navigation`、`badge chip label wraps`、`error feedback recovery`、`truncation keyboard tooltip` 和 React 语义控件。关闭未保存内容的查询结果没有匹配到适用的桌面专用条目，采用 `quick-reference.md` 的明确规则，未将无关移动端结果包装成匹配结论。

可复用探针位于 [证据目录](audits/2026-10-04/ui-ux/)。运行时用原有 `e2e-tests/scripts/run-wdio.cjs --spec <绝对探针路径>`；需保留 `examples/test.en-zh_CN.po`。本轮不修改 app 设计 token 或生成第二份设计系统 SSOT。
