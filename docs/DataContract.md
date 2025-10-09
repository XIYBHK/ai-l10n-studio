## 数据契约（简版）

- **核心类型**（TS 生成）：位于 `src/types/generated/`，含 `AIConfig`、`AppConfig`、`POEntry`、`TermEntry`、`TranslationPair`、`TranslationStats` 等。
- **用途**：前端/后端之间的数据结构对齐，驱动翻译流程、统计与配置。
- **原则**：类型为单一事实源；必要时在 Rust 端与前端同步更新并校验。

详细版请见：`docs/gui/DATA_CONTRACT.md`


