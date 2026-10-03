# 数据契约

核验日期：2026-10-03。Rust 序列化定义和 `src/types/generated/` 是 IPC 契约来源；前端仅 re-export 或扩展运行时字段。

## 生成与命名

```powershell
cd src-tauri
cargo test --locked --features ts-rs --quiet
```

带 `TS` derive 和 export 标注的 Rust 类型在测试时导出到 `src/types/generated/`；不要手写镜像或直接编辑生成文件。前端构建通过 TypeScript 检查消费端。

命名按具体 serde 契约：配置 DTO 通常 camelCase，PO、Channel、文件元数据和库记录保留 snake_case。不要将返回的 `unknown` 强制转换成另一个字段命名的手写接口。

| 来源                        | 生成类型                                                                      | 关键字段                                                           |
| --------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `model_config.rs`           | ModelProviderProfile / Summary / Configuration / Selection / Definition / Api | 稳定 provider ID、多模型、默认选择、协议                           |
| `config_draft.rs`           | AppConfig / ConfigVersionInfo                                                 | 普通设置、版本、修改时间；无密钥                                   |
| `po_parser.rs`              | PODocument / POEntry                                                          | metadata、注释、上下文、复数、flags、obsolete、previous 字段       |
| `batch_progress_channel.rs` | TranslationInput / Item / Source / BatchProgressEvent / BatchResultWithTaskId | 有序输入索引、task_id、结果和累计统计                              |
| `translation_stats.rs`      | TranslationStats / TokenStats                                                 | 翻译来源、token、已知成本、未知价格次数                            |
| `translation_memory.rs`     | TranslationMemory / MemoryStats / ConfirmedTranslation                        | revision、memory、stats、目标语言与上下文                          |
| `term_library.rs`           | TermLibrary / Metadata / TermEntry / StyleSummary                             | revision、作用域、词条、总结元数据                                 |
| `file_format.rs`            | FileFormat / FileMetadata                                                     | format、total_entries、source_language、target_language、file_path |
| `commands/translator.rs`    | BuiltinPhrases / ContextualRefineRequest                                      | 内置 memory 集合；优化上下文                                       |

`BuiltinPhrases` 只有 `memory`，不伪装成含 revision/stats 的完整 TM。`FileMetadata` 的字段为 `total_entries` 等 snake_case；可选语言和路径字段缺失时省略。术语库的空总结/时间字段序列化为 `null`，不是可省略字段。

## 供应商、默认模型与凭据

公开 `ModelProviderProfile` 包含 `id/displayName/catalogProviderId/api/baseUrl/models/proxy`。内部 Rust `api_key` 不参与序列化。

- `defaultModel` 为 `null` 或 `{ providerId, modelId }`，必须指向存在的供应商及其模型。
- 保存时 `apiKey: null` 保留已存密钥，空字符串清除，其他字符串替换；凭据文件以稳定 ID 为键。
- 查询返回 `ModelProviderSummary.hasApiKey`。测试改变后的端点时必须提供密钥或先保存，避免将旧凭据隐式发送到新地址。
- `defaultModelId` 可在同一保存事务中设置默认模型；省略则保持原默认选择，删除其供应商/模型时清空失效选择。
- Base URL 使用 HTTP(S) 基础地址，禁止凭据、query、fragment 和具体操作端点。HTTP 自动重定向禁用。
- 三个协议值为 `openai-completions`、`openai-responses`、`anthropic-messages`。

`AppConfig` 保存 modelProviders/defaultModel、useTranslationMemory、batchSize、timeoutSeconds、systemPrompt、日志参数、configVersion/lastModified。已移除无消费者的 translationMemoryPath、autoSave、maxConcurrent、themeMode、language；不再接受这些普通设置 patch。主题和界面语言属于 Tauri store。

| 日志字段         | 默认值 | 生效                     |
| ---------------- | ------ | ------------------------ |
| logLevel         | info   | 保存后即时应用           |
| logRetentionDays | 7      | 启动清理；0 不按年龄清理 |
| logMaxSize       | 128 KB | 重启后用于轮转           |
| logMaxCount      | 8      | 重启后用于轮转           |

配置事务失败不发布内存状态；版本只随成功持久化递增。单文件使用原子替换，公开配置写入失败恢复原凭据文件。旧未发布的平面配置不继续运行兼容层；首次保存前保留替换前备份。

## 文档与翻译输入

`PODocument` 保留 header、metadata、metadata_is_fuzzy 和完整 entries。`POEntry` 保留原文、译文、复数、注释、上下文、flags、occurrences、obsolete 和 previous 字段。前端 `needsReview/translationSource/justUpdated` 属于运行时状态，保存时不作为 PO 元数据输出。

编辑草稿按条目与复数槽存储。保存先合并草稿并取得内容快照；任务回写须匹配文档/条目版本，不能覆盖更晚人工编辑。翻译的 `TranslationInput` 是 `{ text, context }`，输入数组位置对应结果 `index`；复数槽映射由前端维护。

目标语言属于文档：新目标语言创建独立文档、清空旧译文、更新头部和复数规则，不修改原语言文件。有效复数元数据是翻译复数条目的前提。

## Channel 与统计

每个 progress event 含 task_id、processed、total、items、stats；返回值含 task_id、items、cancelled、stats。stats 是同一任务的累计快照，不能逐事件重复累加；flow 只计入差值。传输 hook 按 index 去重回写，并用最终返回值补偿漏到的 Channel 结果。

取消可在首个 task_id 到达前请求；获知 ID 后发送取消。离开文档等待任务完成，取消已产生结果和 usage 仍需统计。

`TokenStats` 包含 input_tokens/output_tokens/total_tokens/cost/unpriced_requests。空响应失败仍保留响应报告的 usage，并在返回错误前发送累计统计。费用是本地目录估算，单位 USD/百万 token；无目录价格的请求增加 unpriced_requests，不把零展示值当成免费调用。

模型目录缓存价格：缺失表示按常规输入价估算，显式 0 表示该成本项为零，两者不能混淆。

## 翻译记忆和术语库

TM 的 memory 键为 JSON tuple `[source, context, canonicalTargetLanguage]`。中文简体与繁体保持不同作用域；语言别名规范化，原文中的分隔符不会造成键碰撞。

- AI 结果不自动入库；人工明确确认后通过 confirm_translations 收录。
- TM 整库编辑带 revision，过期版本拒绝保存；确认入库读取磁盘最新版本后事务修改。
- 术语定位使用 source/context/language；修改/删除可携带 expectedRevision，防止编辑基线失效。
- 精确短语规则进入提示词；风格总结使用同语言/上下文样例，写回时检查生成前版本。
- 文件原子替换前校验，进程内读写共用短时锁。旧库格式不迁移；重建必须有数据处理授权。
- 导出/导入使用真实库结构；后台刷新不丢弃管理器未保存草稿。

## 存储与日志

普通运行数据目录来自 `utils/paths.rs`；Windows 为用户 Roaming 下 `com.potranslator.gui`。便携标记位于 exe 旁 `.config/PORTABLE`，首次运行数据写入 `.config/com.potranslator.gui`。

便携 ZIP 只带程序、资源与标记，不带已有用户配置、密钥、TM 或术语库。Tauri store 保存偏好和累计统计并串行写入。

提示词日志包含发送给 AI 的原文/上下文及响应，用于调试；它不是价格账单或翻译记忆。IPC 参数日志递归脱敏敏感字段。日志清理保留文件、截断内容，I/O 失败返回错误。

相关说明：[API](API.md)、[架构](Architecture.md)、[安全](SECURITY_NOTES.md)、[本轮复查](ArchitectureReview.md)。
