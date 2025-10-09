## 架构（简版）

- **技术栈**: React 18 + TypeScript + Ant Design（前端），Tauri 2.x + Rust（后端）。
- **前后端通信**: 通过 Tauri Commands（`src-tauri/src/commands/`），统一在前端 `src/services/api.ts` 封装。
- **事件系统**: `src/services/eventDispatcher.ts` + `useTauriEventBridge.ts`，覆盖翻译进度/文件操作/配置等事件。
- **状态管理**: Zustand（`src/store/`），持久化主题/语言/统计等关键状态。
- **翻译管线**: PO 解析 → 记忆库匹配 → AI 翻译（多厂商）→ 记忆库更新 → 事件上报。
- **配置管理**: `src-tauri/src/services/config_manager.rs`（后端）与 `configApi`（前端）协同，立即持久化与校验。
- **性能要点**: 大文件分批、去重批量翻译、100ms 进度节流、LRU 缓存与内存优化。
- **测试**: 前端 Vitest（`npm run test`），后端 `cargo test`；覆盖核心路径。

进一步阅读：`docs/gui/ARCHITECTURE.md`（详细版）。


