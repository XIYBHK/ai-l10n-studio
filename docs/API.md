# IPC 与前端接口

核验日期：2026-10-03。注册入口是 `src-tauri/src/lib.rs::run`；此表按当前 handler 和命令源码整理。准确参数与返回值以 Rust 和生成类型为准，历史签名不继续兼容。

## 已注册命令

| 命令模块               | IPC 名称                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `translator.rs`        | `parse_po_file`、`cancel_translation`、`cancel_all_translations`、`get_translation_memory`、`get_builtin_phrases`、`merge_builtin_phrases`、`save_translation_memory`、`confirm_translations`、`open_file_dialog`、`save_file_dialog`、`save_po_file`、`get_app_config`、`update_app_config`、`validate_config`、`get_term_library`、`add_term_to_library`、`remove_term_from_library`、`generate_style_summary`、`contextual_refine`、`should_update_style_summary`、`translate_batch_with_channel` |
| `ai_config.rs`         | `get_model_configuration`、`save_model_provider`、`remove_model_provider`、`set_default_model`、`test_model_provider`、`discover_provider_models`、`get_system_prompt`、`update_system_prompt`、`reset_system_prompt`                                                                                                                                                                                                                                                                                |
| `ai_model_commands.rs` | `get_provider_models`、`get_model_info`、`estimate_translation_cost`、`calculate_precise_cost`、`get_all_providers`、`get_all_models`、`find_provider_for_model`                                                                                                                                                                                                                                                                                                                                     |
| `config_sync.rs`       | `get_config_version`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `file_format.rs`       | `detect_file_format`、`get_file_metadata`                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `language.rs`          | `detect_text_language`、`get_default_target_lang`、`get_supported_langs`                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `log.rs`               | `get_app_logs`、`clear_app_logs`、`get_frontend_logs`                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `prompt_log.rs`        | `get_prompt_logs`、`clear_prompt_logs`                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `system.rs`            | `get_system_language`、`get_log_directory_path`、`open_log_directory`、`get_native_system_theme`                                                                                                                                                                                                                                                                                                                                                                                                     |
| `utils/i18n.rs`        | `get_system_locale`、`get_available_languages`                                                                                                                                                                                                                                                                                                                                                                                                                                                       |

服务使用 `AppError` 分类并通过 `?` 传播；部分命令边界仍序列化为 String，前端以命令失败处理。日志清理失败会返回错误，不能显示为成功。

## 前端调用

`src/services/` 按功能提供命令对象：

| 文件                   | 对象                                                                                  |
| ---------------------- | ------------------------------------------------------------------------------------- |
| aiCommands.ts          | modelConfigurationCommands、aiProviderCommands、aiModelCommands、systemPromptCommands |
| configCommands.ts      | configCommands                                                                        |
| fileCommands.ts        | poFileCommands、fileFormatCommands、dialogCommands                                    |
| logCommands.ts         | logCommands                                                                           |
| termCommands.ts        | translationMemoryCommands、termLibraryCommands                                        |
| translationCommands.ts | i18nCommands                                                                          |

普通命令经 `apiClient.invoke` 处理 UI 错误，再经 `tauriInvoke` 脱敏日志后调用 Tauri。options.silent/showErrorMessage 只控制 UI 提示，不控制传输或重试；没有自动重试包装器。Channel hook 直接使用脱敏传输层，由业务 flow 处理错误。

原生文件选择/保存使用 dialog 插件；读写 PO 必须传完整 PODocument。读取路径必须存在，输出路径允许新文件名但要求已有合法父目录。

## 模型配置

```typescript
const configuration = await modelConfigurationCommands.get();
await modelConfigurationCommands.saveProvider(profile, apiKey, defaultModelId);
await modelConfigurationCommands.setDefault({ providerId, modelId });
const result = await modelConfigurationCommands.testProvider(profile, apiKey, modelId);
const models = await modelConfigurationCommands.discoverModels(profile, apiKey);
```

apiKey 为 null 时保留已存密钥，空字符串清除。defaultModelId 可与保存供应商在同一事务中设为默认。查询只返回 profile 与 hasApiKey。

本地目录供应商从 TOML 发现模型，自定义服务使用所选协议的模型列表端点；Anthropic 列表支持分页。连接测试使用真实请求，保存预设本身不访问收费接口。测试编辑后的端点应重新输入密钥或先保存。协议、地址和类型见 [DataContract.md](DataContract.md)，快速预设见 [ModelPresets.md](ModelPresets.md)。

普通配置 update 仅接受 useTranslationMemory、logLevel、batchSize、timeoutSeconds、logRetentionDays、logMaxSize、logMaxCount。供应商和提示词使用专用命令，禁止通过普通 patch 修改。批次为 1–25，超时大于零；所有写入最终进入 ConfigDraft.transaction。

## 配置 hooks 与主题

| Hook                                  | 内容                                                        |
| ------------------------------------- | ----------------------------------------------------------- |
| useAppConfig                          | SWR app_config                                              |
| useModelConfiguration                 | SWR model_configuration；configuration/loading/error/mutate |
| useSystemPrompt                       | SWR system_prompt                                           |
| useActiveAIConfig                     | 只订阅 model_configuration 并派生活动模型摘要               |
| useTheme                              | 纯主题状态与 actions                                        |
| useThemeRuntime                       | 主 AppShell 唯一的主题全局副作用                            |
| useTranslationMemory / useTermLibrary | 库读取与刷新；管理器保留版本编辑快照                        |

初始化读取失败显示错误和重试；成功读取无默认模型时才自动打开设置。持久化初始化完成前不挂载主交互 UI。

## Channel 翻译与取消

```typescript
const { translateBatch, cancelTranslation, cancelAndWait, reset } = useChannelTranslation();
const result = await translateBatch(inputs, targetLanguage, {
  onItems: (items) => applyItems(items),
  onStats: (stats) => receiveCumulativeSnapshot(stats),
  onProgress: (processed, total, percentage) => updateProgress(percentage),
});
```

可选第四个参数 refineRequests 将同一传输流程用于 contextual_refine。结果 index 对应输入数组，重复原文及复数槽保持位置映射；最终返回值补偿漏到的 Channel items。取消可早于 task_id 到达，cancelAndWait 等待当前请求实际结束。reset 中止回写并请求取消，离开文档使用 cancelAndWait。

传输 hook 不返回第二套 progress/stats/isTranslating 状态。会话状态属于 useSessionStore，统计快照由 flow 按差值累加；累计统计属于 useStatsStore。

## 库操作

- translationMemoryCommands.get/save 使用完整带 revision 的 TranslationMemory。
- getBuiltinPhrases 仅返回 BuiltinPhrases.memory；加载到管理器属于草稿，保存时仍进行版本检查。
- confirm 使用 ConfirmedTranslation[]，每项带 source/translation/context/language，后端读最新文件再事务修改。
- termLibraryCommands.addTerm/removeTerm 传 source、context、language，可传 expectedRevision。
- generateStyleSummary/shouldUpdateStyleSummary 使用指定语言与上下文，生成完成时检查库版本。

AI 输出不自动学习。保存 PO 与确认入库的结果分别处理；入库失败保留审核状态，不能谎报成功。旧目录翻译、BatchTranslator 和 file chunker 不再是公开运行路径。

## 格式、日志与错误

FileFormat 为 PO/JSON/XLIFF/YAML。主编辑流程只处理 PO；JSON 元数据可读取，XLIFF/YAML 元数据返回不支持。FileMetadata 使用 total_entries 等生成字段；不要强制 cast 到 camelCase 镜像。

logCommands.clear 截断日志文件内容并清内存缓冲区，枚举或写入失败返回错误。没有前端日志文件时返回空列表，由 UI 显示空状态。

关联：[架构](Architecture.md)、[数据契约](DataContract.md)、[错误目录](ERRORS.md)、[复查记录](ArchitectureReview.md)。
