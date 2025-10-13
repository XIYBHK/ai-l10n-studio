## GUI 历史时间线（简版）

用于快速回顾关键里程碑，长文档请点右侧链接查看详情。

| 日期 | 主题 | 关键要点 | 文档 |
|---|---|---|---|
| — | Notification 功能与使用 | `useNotification` 与 `notificationManager`；长任务用系统通知，快速操作用应用内 message；提供设置页开关与测试按钮 | [NOTIFICATION_PLUGIN_USAGE.md](./NOTIFICATION_PLUGIN_USAGE.md) |
| — | Store Plugin 集成指南 | 启动时 `autoMigrate` + `initializeStores`；设置/统计持久化；提供改造前后对比与检查清单 | [INTEGRATION_GUIDE.md](./archive/INTEGRATION_GUIDE.md) |
| — | 类型生成自动化：ts-rs | Rust 派生 `TS` 自动导出到 `src/types/generated/`；作为 `prebuild` 步骤确保前后端类型一致 | [TYPE_GENERATION.md](./archive/TYPE_GENERATION.md) |

维护约定：
- 本页仅保留一屏概览；新增阶段完成后追加一行并链接长文。
- 长文档的实现细节、代码片段与步骤说明保存在 `./archive/` 中。


