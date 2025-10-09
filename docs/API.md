## API 索引（简版）

- **统一入口**: `src/services/api.ts`（封装 Tauri Commands，含：termLibraryApi、translationMemoryApi、poFileApi、configApi、translatorApi 等）。
- **常用命令**：
  - 文件操作：`poFileApi.*`
  - 翻译：`translatorApi.translate*`（单条/批量，含进度事件）
  - 配置：`configApi.*`（AI provider、代理、系统设置）
  - 记忆库/术语库：`translationMemoryApi.*`、`termLibraryApi.*`
- **事件**: 通过 `eventDispatcher` 订阅，如翻译进度、完成、统计上报等。

完整参考：
- 快速索引：`QUICK_API_REFERENCE.md`
- 详细说明：`API_REFERENCE_V2.md`


