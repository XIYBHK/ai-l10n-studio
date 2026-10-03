# 术语库与翻译记忆库逻辑核查

> 本文保留修复前的审计发现。下列优先问题及库并发写入问题已在本轮处理，当前行为、测试和限制见 [LogicFixes.md](../../LogicFixes.md)；不要将原始发现视为当前程序行为。

核查日期：2026-10-03。范围：当前工作树的翻译入口、人工确认、术语检测、提示词构建、两类库的管理与持久化。结论来自源码调用链及现有回归测试；未调用真实 AI API，未修改用户数据。本轮只核查以下业务逻辑，未实施下列修复。

## 优先修复的问题

### P1：未确认的 AI 译文先进入记忆库，人工修正却不回写

`AITranslator::translate_inputs` 对符合 `is_simple_phrase` 且译文不超过 50 字的 AI 结果立即调用 `tm.add_translation`，没有人工确认条件。批次命令在完成、取消或后续批次错误时保存已经生成的记忆库。

另一方面，`EntryList` 的单条/批量确认仅更新 `needsReview`；`EditorPane` 保存译文调用 `onEntryUpdate`，`useTranslationFlow` 将其直接绑定为 store 的 `updateEntry`。这些路径没有记忆库写入命令。

影响：例如 AI 将短语 `Open` 译错并自动收录，用户将其修正为“打开”后，后续相同键仍可命中旧的 AI 译文；仅确认正确译文也不会主动收录。

证据：[ai_translator.rs](../../../src-tauri/src/services/ai_translator.rs)、[translator.rs](../../../src-tauri/src/commands/translator.rs)、[EntryList.tsx](../../../src/components/EntryList.tsx)、[EditorPane.tsx](../../../src/components/EditorPane.tsx)、[useTranslationFlow.ts](../../../src/hooks/useTranslationFlow.ts)。

修复方向：以“用户确认/保存”作为正式记忆的写入入口；同语言、上下文和复数形式的人工修正更新同一键。待确认 AI 结果保留为候选，不直接参与正式记忆命中。

### P1：术语条目没有直接进入翻译约束

`AITranslator` 虽然加载 `TermLibrary`，`prompt_builder::build_system_prompt` 只读取 `style_summary.prompt`，没有遍历 `terms` 或筛选命中的术语。前端确认弹窗所说“相同原文将优先使用您的译法”目前缺少对应的精确规则。

影响：新增术语且未生成风格总结时，翻译请求不会携带该术语；生成风格总结后依赖 AI 对总结的理解，仍不等于逐条术语匹配。

证据：[prompt_builder.rs](../../../src-tauri/src/services/prompt_builder.rs)、[ai_translator.rs](../../../src-tauri/src/services/ai_translator.rs)、[TermConfirmModal.tsx](../../../src/components/TermConfirmModal.tsx)。

修复方向：将术语规则和风格总结分开；按当前语言及上下文筛选命中的术语，以结构化规则注入请求，并针对重要术语校验译文。

### P1：术语缺少语言隔离，同原文不同上下文会覆盖

`TermEntry` 不含语言字段；`add_term` 仅按 `source` 查重。相同原文再次添加时只更新 `user_translation` 和频次，保留第一次的 `context` 与 `ai_translation`。

影响：`Open` 在动词上下文保存为“打开”、形容词上下文保存为“开放”，第二次会覆盖译文却留下第一次的上下文。同一全局库还会被不同目标语言的项目复用。

证据：[term_library.rs](../../../src-tauri/src/services/term_library.rs) 的 `TermEntry`、`add_term`、`remove_term`。

修复方向：定义明确的语言与上下文键，必要时包含复数形式；更新和删除均使用同一稳定键。

## 其他一致性问题

| 级别 | 问题与影响                                                                                                                                                        | 证据                                                                                                                   |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| P2   | 词级差异只用于展示。分析器提供 `ai_term` / `user_term`，确认保存时却写入整条原文和整句译文。当前条目更接近“修订示例”，不等于词级术语规则。                        | [termAnalyzer.ts](../../../src/utils/termAnalyzer.ts)、[useTermDetection.ts](../../../src/hooks/useTermDetection.ts)               |
| P2   | 术语写入采用独立 load → mutate → `fs::write`，没有共享事务锁或原子替换。根据该读写顺序，并发写入可能丢更新，进程在写入中断时可能留下损坏 JSON；未做故障注入复现。 | [translator.rs](../../../src-tauri/src/commands/translator.rs)、[term_library.rs](../../../src-tauri/src/services/term_library.rs) |
| P2   | 记忆库管理器允许增加或编辑为重复的 `[source, context, language]`。保存时构造对象会保留最后一个值，但传入统计仍使用表格行数，导致静默覆盖和数量不一致。            | [MemoryManager.tsx](../../../src/components/MemoryManager.tsx) 的 `handleAdd`、`handleEdit`、`handleSave`                    |
| P3   | 合并内置记忆直接插入 map 并更新数量，没有同步 `last_updated`，可能显示旧更新时间。                                                                                | [translator.rs](../../../src-tauri/src/commands/translator.rs) 的 `merge_builtin_phrases`                                    |

## 已有行为与边界

- 记忆键采用 JSON 元组 `[source, context, canonicalTargetLanguage]`，避免分隔符碰撞；`zh-CN` / `zh-Hans` 归一，`zh-TW` / `zh-HK` 使用 `zh-Hant`，不会跨简繁命中。已有回归测试覆盖这些条件。
- PO 翻译槽保留上下文、注释、复数序号与 `Plural-Forms`。语义数据已具备，术语层尚未使用它们。
- 记忆库文件使用临时文件替换，能避免半截 JSON；这不等于多个读写者之间不会丢更新。
- 记忆库“导入”替换当前窗口中的草稿，点击保存后才落盘；关闭窗口会丢弃该导入草稿。当前不是合并导入，建议明确文案或提供明确的覆盖/合并选择。
- 复数条目保存不会触发术语确认，这是当前显式分支。是否扩展应与术语的复数键设计一起决定。
- 没有发现术语库导入/导出入口，本次未推定其覆盖或去重规则。

## 建议的修复顺序与验收

1. 统一人工确认/保存到记忆库的写入入口；验证“AI 错译 → 人工修正 → 再翻译”命中修正值，未确认项不进入正式记忆。
2. 定义术语规则与修订示例的不同模型，补语言和上下文键；验证相同原文的不同语义与目标语言可共存。
3. 将命中术语注入翻译请求；以本地模拟接口断言实际请求内容，避免仅测 UI 或条目数量。
4. 两类库统一事务写入、重复键策略和统计；覆盖并发添加、写入失败、重复导入及重载。
