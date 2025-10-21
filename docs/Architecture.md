## 架构（简版）

### 核心技术栈

**前端**: React 18 + TypeScript + Ant Design + Zustand + SWR  
**后端**: Tauri **2.8** + Rust (Tokio) + nom parser + 8 AI SDKs  
**构建**: Vite + Vitest（73 测试，82.8% 覆盖率）

### 提升开发效率的核心架构

#### 四层架构设计 (2025-10重构)

```
组件层 (React Components)
   ↓ useAppData / useAsync
AppDataProvider (统一数据提供者)
   ↓ SWR缓存 + 事件监听
命令层 (commands.ts - 13 模块)
   ↓ 统一错误处理 + 日志
Tauri Commands (52 个)
   ↓ 序列化/反序列化
Rust 服务层 (services/)
   ↓ ConfigDraft (原子更新)
Rust 持久化层 (JSON文件)
```

**核心改进**:

- 统一数据访问: `AppDataProvider` 集中管理所有全局数据
- 命令层重构: `commands.ts` 替代旧的 `api.ts`，模块化组织
- Draft 模式: `ConfigDraft` 实现配置的原子更新和并发安全
- 增强事件桥接: 防抖+节流+鲁棒清理，性能更优

#### 增强事件系统 (2025-10升级)

- UE 风格设计: `EventMap` 全局类型定义 → 编译时检查
- 增强桥接: `useTauriEventBridgeEnhanced` 支持防抖/节流/鲁棒清理
- 自动转发: 后端事件 → `eventDispatcher` → 前端状态
- 调试友好: 事件历史记录 + 时间戳 + payload 快照
- 集成方式: 已集成到 `AppDataProvider`，自动启用

#### 统一数据层 (AppDataProvider)

```typescript
// main.tsx - 全局包裹
<AppDataProvider>
  <App />
</AppDataProvider>

// 组件中使用
const { config, aiConfigs, termLibrary, refreshAll } = useAppData();
```

**核心特性**:

- SWR 集成: 自动缓存配置/TM/术语库（避免重复 IPC 调用）
- 统一刷新: `refreshAll()` 一键刷新所有数据
- 事件同步: 集成增强事件桥接，自动失效缓存
- 类型安全: 完整 TypeScript 类型推断

**替代的旧模式**:

- 旧: 每个组件单独调用 `useSWR`
- 新: 统一通过 `useAppData` 访问全局数据

#### Channel API 翻译（统一路径）

```rust
// Rust 端通过 IPC Channel 发送进度和统计
progress_tx.send(ProgressEvent { current, total, entry }).await;
stats_tx.send(StatsEvent { tm_hits, deduplicated, ... }).await;

// 前端 useChannelTranslation 订阅
const { progress, stats } = useChannelTranslation(onProgress);
```

- 高性能: 替代轮询，实时推送
- 低内存: 流式处理，无需缓存全部结果
- 唯一翻译路径: 已移除 Event API

#### 统计系统（Event Sourcing）

```
┌─────────────────────────────────────────────────────────────┐
│ Rust Backend (src-tauri)                                    │
├─────────────────────────────────────────────────────────────┤
│ translate_batch_with_channel                                │
│   ├─ AITranslator::translate_batch_with_sources()           │
│   │   ├─ TM 查询 → tm_hits++                                │
│   │   ├─ 去重处理 → deduplicated++                          │
│   │   └─ AI 翻译 → ai_translated++, token 统计              │
│   ├─ 发送统计到 Channel: stats_tx.send()                    │
│   └─ 发送事件: emit('translation:after', stats)             │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Frontend Event Bridge (useTauriEventBridge)                 │
├─────────────────────────────────────────────────────────────┤
│ 监听 Tauri Events → 转发到 EventDispatcher                  │
│   ├─ translation:before                                     │
│   ├─ translation-stats-update (Channel)                     │
│   └─ translation:after                                      │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ StatsManagerV2 (事件编排层)                                  │
├─────────────────────────────────────────────────────────────┤
│ 1. translation:before → 生成 taskId                         │
│ 2. translation-stats-update → StatsEngine 聚合会话统计       │
│ 3. translation:after → 更新累计统计（持久化）                │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ StatsEngine (事件溯源核心)                                   │
├─────────────────────────────────────────────────────────────┤
│ EventStore                                                  │
│   ├─ 存储所有 StatsEvent（带 eventId/taskId/timestamp）     │
│   ├─ 幂等性去重（同 eventId 只处理一次）                     │
│   └─ 事件聚合器（实时计算会话统计）                          │
│                                                             │
│ 调试工具                                                     │
│   ├─ getEventHistory() - 查看完整事件流                     │
│   ├─ getTaskStats(taskId) - 按任务查询                      │
│   └─ reset() - 清空事件存储                                 │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Zustand Stores (状态管理)                                    │
├─────────────────────────────────────────────────────────────┤
│ useSessionStore                                             │
│   ├─ sessionStats (应用启动时重置)                          │
│   └─ 聚合当前会话所有翻译统计                                │
│                                                             │
│ useStatsStore (持久化到 TauriStore)                          │
│   ├─ cumulativeStats (跨会话累加)                           │
│   └─ 包含完整统计字段（tm_hits/deduplicated/tokens/cost）   │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ UI Components (AIWorkspace)                                 │
├─────────────────────────────────────────────────────────────┤
│ 💼 本次会话统计 (sessionStats)                               │
│   ├─ 记忆库命中: X / Y%                                     │
│   ├─ 去重节省: X / Y%                                       │
│   ├─ AI调用: X                                              │
│   └─ 预估费用: ¥X.XX                                        │
│                                                             │
│ 📊 累计统计 (cumulativeStats)                                │
│   ├─ 总计: X                                                │
│   ├─ 命中: X, 去重: X, AI调用: X                            │
│   └─ Token: X,XXX / ¥X.XX                                   │
└─────────────────────────────────────────────────────────────┘
```

**核心特性**:

1. **事件溯源**: 所有统计以事件流存储，可追溯、可审计
2. **幂等性**: 同一事件多次处理结果一致，防止重复计数
3. **双存储分离**: 会话统计（瞬态）+ 累计统计（持久化）
4. **类型安全**: 完整 TypeScript 类型定义 + 编译时检查

#### 6️⃣ **性能优化策略**

- **智能分批**: <10MB 直接加载，10-50MB 500条/批，>50MB 200条/批
- **去重翻译**: 批量去重（减少 70% API 调用）
- **🆕 事件节流**: 配置更新 500ms，统计更新 500ms（性能更优）
- **LRU 缓存**: 翻译记忆库模式匹配缓存
- **🆕 日志轮转**: 单个文件最大 128KB，自动切换新文件，保留最新 8 个
- **🆕 代码清理**: 移除50行临时调试代码，优化日志性能，修复所有linter问题

#### 7️⃣ **多AI供应商架构（插件化 + 类型统一）**

```
┌─────────────────────────────────────────────────┐
│ 插件化供应商注册表 (ProviderRegistry)             │
├─────────────────────────────────────────────────┤
│ 内置供应商 (providers/)                          │
│   ├─ openai.rs    → OpenAIProvider              │
│   ├─ moonshot.rs  → MoonshotProvider            │
│   └─ deepseek.rs  → DeepSeekProvider            │
│                                                 │
│ 动态加载 (plugin_loader.rs)                      │
│   └─ 从 plugins/*.toml 加载外部供应商            │
│                                                 │
│ ProviderRegistry.get_provider(id) → &dyn AIProvider │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│ 模型层 (models/)                                 │
├─────────────────────────────────────────────────┤
│ openai.rs    → get_openai_models()              │
│ moonshot.rs  → get_moonshot_models()            │
│ deepseek.rs  → get_deepseek_models()            │
│   ↓ 返回 Vec<ModelInfo>                         │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│ 成本计算 (CostCalculator)                        │
├─────────────────────────────────────────────────┤
│ calculate_openai(&ModelInfo, ...) → CostBreakdown│
│   ├─ 输入/输出 token                             │
│   ├─ 缓存写入/读取                               │
│   └─ 节省计算 (高达90%)                          │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│ AI 翻译器 (AITranslator)                         │
├─────────────────────────────────────────────────┤
│ 🆕 new_with_config(AIConfig, ...)               │
│   ├─ config.provider_id: String                 │
│   ├─ ProviderRegistry.get_provider_info(id)     │
│   └─ provider.get_model_info(model_id)          │
│       .expect("模型必须存在")  ← Fail Fast       │
│                                                 │
│ CostCalculator::calculate_openai(...)           │
│   → token_stats.cost (USD)                      │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│ 🆕 前后端类型统一 (Zero Conversion)              │
├─────────────────────────────────────────────────┤
│ Rust: AIConfig { provider_id: String, ... }    │
│   ↓ serde(rename_all = "camelCase")            │
│ JSON: { providerId: string, ... }              │
│   ↓ Tauri IPC                                  │
│ TypeScript: AIConfig { providerId: string }    │
│   ↓ 零转换，直接使用                             │
│ React Components                                │
└─────────────────────────────────────────────────┘
```

**核心设计**：

- **插件化架构** - `AIProvider` trait + `ProviderRegistry` 全局注册表
- **🆕 类型统一** - 前后端 `AIConfig` 完全一致，通过 serde camelCase 自动转换
- **🆕 providerId 字符串** - 废弃 `ProviderType` 枚举，使用 `providerId: string`
- **强制 ModelInfo** - 无降级逻辑，模型不存在 = 立即失败
- **统一定价** - USD per 1M tokens，清除所有 CNY 标记
- **精确成本** - 支持缓存定价，30%命中率节省27%成本
- **类型安全** - ts-rs 自动生成 TypeScript 类型（`ProviderInfo`, `ProxyConfig` 等）

#### 8️⃣ **AI 翻译管线**

```
PO 文件 → nom 解析器 → 去重队列
   ↓
TM 查询（记忆库文件：首次83+内置短语 + 用户学习词条）
   ↓
AI 翻译（ModelInfo + CostCalculator 精确计费）
   ↓
TM 更新 + 事件发布 → SWR 失效 → UI 更新
```

**🆕 翻译记忆库逻辑** (2025-10-21):

- **首次使用**: 自动加载83+条内置短语到记忆库文件
- **后续使用**: 只查询记忆库文件，不再自动回退到内置短语
- **用户控制**: 删除的词条不会被自动恢复，保持用户完全控制权
- **手动加载**: 用户可主动合并内置词库到当前记忆库

#### 9️⃣ **🆕 后端配置管理（Draft 模式）** - 2025-10

```rust
// 读取配置（只读访问）
let draft = ConfigDraft::global().await;
let config = draft.data(); // MappedRwLockReadGuard
println!("Active AI: {}", config.active_config_index);
// config 自动释放读锁

// 修改配置（原子更新）
let draft = ConfigDraft::global().await;
{
    let mut config = draft.draft(); // MappedRwLockWriteGuard
    config.ai_configs.push(new_config);
}
draft.apply()?; // 保存到磁盘 + 发送事件
```

**核心特性**：

- ✅ **并发安全**：`parking_lot::RwLock` 保证线程安全
- ✅ **原子更新**：配置修改要么全部成功，要么全部失败
- ✅ **自动持久化**：`apply()` 自动保存到磁盘并发送更新事件
- ✅ **全局单例**：`ConfigDraft::global()` 提供全局访问

**参考源**：`clash-verge-rev/src-tauri/src/config/draft.rs`

#### 🆕 **系统主题检测架构** - 2025-10-15

**问题背景**：Tauri webview环境中 `window.matchMedia('(prefers-color-scheme: dark)')` 无法准确反映真实系统主题

**解决方案**：混合检测策略 + 原生API优先

```
┌─────────────────────────────────────────────────┐
│ Frontend (useTheme Hook)                        │
├─────────────────────────────────────────────────┤
│ SystemThemeManager.handleSystemThemeChange()    │
│   ├─ 1️⃣ 原生API检测 (优先)                      │
│   │   └─ systemCommands.getNativeSystemTheme()  │
│   ├─ 2️⃣ 媒体查询检测 (备用)                      │
│   │   └─ window.matchMedia()                    │
│   ├─ 3️⃣ 结果对比 + 警告                         │
│   └─ 4️⃣ 更新全局状态                            │
│       └─ useAppStore.setSystemTheme()           │
└─────────────────────────────────────────────────┘
                    ↓ Tauri IPC
┌─────────────────────────────────────────────────┐
│ Backend (Rust Commands)                         │
├─────────────────────────────────────────────────┤
│ get_native_system_theme()                       │
│   ├─ Windows: 注册表查询                        │
│   │   └─ HKCU\...\Personalize\AppsUseLightTheme │
│   ├─ macOS: defaults 命令                       │
│   │   └─ defaults read -g AppleInterfaceStyle    │
│   ├─ Linux: gsettings 查询                      │
│   │   └─ org.gnome.desktop.interface gtk-theme  │
│   └─ 返回: "dark" | "light"                     │
└─────────────────────────────────────────────────┘
```

**核心特性**：

- ✅ **100% 准确性**：绕过webview限制，直接从OS获取
- ✅ **优雅降级**：原生API失败时自动回退到媒体查询
- ✅ **调试友好**：详细对比日志，帮助诊断环境问题
- ✅ **跨平台支持**：Windows/macOS/Linux统一接口
- ✅ **性能优化**：缓存检测结果，避免重复系统调用

**集成到主题系统**：

```typescript
// 全局单例管理器（防止重复初始化）
export function initializeGlobalSystemThemeManager(setSystemTheme) {
  if (systemThemeListenerInitialized) return;

  const handleSystemThemeChange = async (forceUpdate = false) => {
    // 混合检测策略
    const { nativeResult, mediaQueryResult, finalTheme } = await detectSystemTheme();

    // 不一致警告
    if (nativeResult !== mediaQueryResult) {
      log.warn('系统主题检测不一致', { nativeResult, mediaQueryResult });
    }

    // 更新全局状态（单一数据源）
    setSystemTheme(finalTheme);
  };
}
```

**技术价值**：

- 🎯 **解决框架限制**：为Tauri生态贡献了webview主题检测的标准方案
- 🏗️ **架构示范**：展示了如何优雅处理跨平台系统API调用
- 🔧 **可复用性**：其他Tauri项目可直接借鉴此实现

---

### 开发工作流

```bash
npm run tauri:dev  # 自动热重载（Vite HMR + Rust 监控）
npm run test       # Vitest 监听模式
npm run test:ui    # 可视化测试调试

# 新增：代码规范工具
npm run format       # Prettier 格式化前端代码
npm run format:check # 检查代码格式
npm run fmt          # Rust 代码格式化
npm run lint:all     # 检查所有代码格式
```

**完整文档**: `CLAUDE.md` §Architecture Overview & Development Guidelines
