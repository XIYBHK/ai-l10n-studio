## 架构（简版）

### 核心技术栈
**前端**: React 18 + TypeScript + Ant Design + Zustand + SWR  
**后端**: Tauri **2.8** + Rust (Tokio) + nom parser + 8 AI SDKs  
**构建**: Vite + Vitest（73 测试，82.8% 覆盖率）

### 提升开发效率的核心架构

#### 1️⃣ **三层 API 设计**
```
组件层 (React Hooks)
   ↓ useAsync / useConfig
API 层 (api.ts - 13 模块)
   ↓ 统一错误处理 + 日志
Tauri Commands (52 个)
   ↓ 序列化/反序列化
Rust 服务层 (services/)
```

#### 2️⃣ **类型安全事件总线**
- **UE 风格设计**: `EventMap` 全局类型定义 → 编译时检查
- **双向桥接**: `useTauriEventBridge` 自动连接后端事件到前端 dispatcher
- **调试友好**: 事件历史记录 + 时间戳 + payload 快照

#### 3️⃣ **SWR 数据缓存层**
- 自动缓存配置/TM/术语库（避免重复 IPC 调用）
- 后台重验证（保持数据新鲜）
- 乐观更新（即时 UI 响应）
- 与事件系统集成（数据变更自动失效缓存）

#### 4️⃣ **通道模式异步翻译**
```rust
// Rust 端通道发送进度
tx.send(ProgressEvent { current, total, entry }).await;

// 前端 useChannelTranslation 订阅
const { progress, complete } = useChannelTranslation(onProgress);
```
替代轮询，实时进度推送。

#### 4.1️⃣ **统一统计链路（StatsManager）**
```
Rust Services → Events
  ├─ translation:stats       （批次统计：去重/TM命中/AI调用/Token）
  └─ translation:after       （最终统计：整次任务汇总）

前端 EventDispatcher（类型安全）
  └─ StatsManager（services/statsManager.ts）
       ├─ normalizeStats（utils/statsAggregator.ts）字段归一化
       ├─ 会话统计：useSessionStore.updateSessionStats(stats)
       └─ 累计统计：useStatsStore.updateCumulativeStats(stats)

UI（AIWorkspace）
  ├─ 会话统计：实时展示批次累计
  └─ 累计统计：仅在完成时增长（持久化）
```

设计原则：
- 单一入口：所有统计只经由 StatsManager 聚合，视图不再自行累加
- 可组合：归一化/累加为纯函数，便于单元测试与复用
- 兼容性：支持 `translation:stats` 与 `translation-stats-update` 两种事件名

#### 5️⃣ **性能优化策略**
- **智能分批**: <10MB 直接加载，10-50MB 500条/批，>50MB 200条/批
- **去重翻译**: 批量去重（减少 70% API 调用）
- **节流更新**: 100ms 进度节流（避免 UI 卡顿）
- **LRU 缓存**: 翻译记忆库模式匹配缓存

#### 6️⃣ **AI 翻译管线**
```
PO 文件 → nom 解析器 → 去重队列
   ↓
TM 查询（83+ 内置 + 用户自定义）
   ↓
AI 翻译（8 厂商负载均衡/降级）
   ↓
TM 更新 + 事件发布 → SWR 失效 → UI 更新
```

### 开发工作流
```bash
npm run tauri:dev  # 自动热重载（Vite HMR + Rust 监控）
npm run test       # Vitest 监听模式
npm run test:ui    # 可视化测试调试
```

**完整文档**: `CLAUDE.md` §Architecture Overview & Development Guidelines


