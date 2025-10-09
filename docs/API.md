## API 索引（简版）

### 统一 API 层 (`src/services/api.ts`)
封装 **52 个 Tauri Commands**，13 个功能模块，自动处理错误、日志和用户反馈：

**核心 API 模块**：
- 📄 `poFileApi.*` - 文件解析/保存（PO/JSON/XLIFF/YAML）
- 🤖 `translatorApi.*` - AI 翻译（8 厂商，单条/批量/通道模式）
- 💾 `translationMemoryApi.*` - 翻译记忆库（83+ 内置短语，模式匹配）
- 📚 `termLibraryApi.*` - 术语库管理（风格分析、批量导入）
- ⚙️ `configApi.*` - 配置管理（AI/代理/系统设置，实时校验）
- 📊 `statsApi.*` - 统计聚合（Token/去重/性能指标）
- 🌐 `languageApi.*` - 语言检测（10 语言，自动识别）
- 📝 `logApi.*` - 结构化日志（开发/生产模式）

### 现代化 React Hooks
- `useAsync` - 统一异步操作（替代旧的 useTranslator）
- `useConfig` - SWR 驱动的配置管理（自动缓存、重验证）
- `useLanguage` - 语言状态与检测
- `useTermLibrary` / `useTranslationMemory` - 专用数据管理
- `useChannelTranslation` - 通道模式批量翻译（实时进度）

### 类型安全事件系统 (`eventDispatcher`)
受 Unreal Engine 启发，全类型推断：
```typescript
// 订阅事件（自动推断 payload 类型）
eventDispatcher.on('translation:progress', (data) => {
  console.log(`进度: ${data.current}/${data.total}`);
});

// 一次性订阅
eventDispatcher.once('translation:complete', handleComplete);

// 历史记录（调试神器）
eventDispatcher.getEventHistory();
```

### SWR 数据缓存
自动缓存、后台重验证、乐观更新：
```typescript
const { data, error, isLoading } = useSWR('config', configApi.loadConfig);
```

**完整参考**: `CLAUDE.md` §Architecture Overview

---

## 统计聚合（StatsManager）

统一入口：`src/services/statsManager.ts`

订阅事件：
- `translation:stats`（或 `translation-stats-update`）：批次统计 → 会话累计
- `translation:after`：最终统计 → 累计（持久化）

归一化工具：`src/utils/statsAggregator.ts`
- `normalizeStats(raw)`：兼容 Channel/Event 字段（prompt/completion → input/output），补齐 total/cost 等
- `accumulateStats(a,b)`：纯函数累加，保证数值安全（默认 0）

使用示例：
```ts
import { initializeStatsManager } from '@/services/statsManager';

initializeStatsManager(); // 在 main.tsx 启动（一次）
```

约定：
- 会话统计 = 所有批次的和（应用运行期）
- 累计统计 = 每次任务完成累加一次（跨会话持久化）


