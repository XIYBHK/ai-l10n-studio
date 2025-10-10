# 📚 Roo-Code 参考代码索引

> 本目录包含从 [Roo-Code](https://github.com/RooVetGit/Roo-Cline) 项目中提取的关键代码文件
> 
> 用于 ai-l10n-studio 多AI供应商功能实现参考

**✨ 设计亮点**：容错优先、成本透明、高扩展性、灵活配置、性能优化、智能适配、安全合规、可观测性  
详见 [设计哲学](./AI-Provider-Integration-Plan.md#设计哲学)

## ⚠️ 翻译项目场景说明

本参考代码来自 **对话式 AI 助手**（Roo-Code），部分功能对 **翻译项目** 来说是过度设计：

| 类型 | Roo-Code 需要 | 翻译项目需要 | 说明 |
|------|--------------|-------------|------|
| **供应商** | 10+ | **6个** | OpenAI, DeepSeek, Moonshot, Gemini, 智谱, Ollama |
| **流式响应** | ✅ 必需 | ❌ 不需要 | 批量翻译不需要实时显示 |
| **Worker线程** | ✅ 必需 | ❌ 不需要 | Rust异步足够 |
| **缓存成本** | ✅ 精确 | ⚠️ 简化 | 基础成本计算即可 |
| **动态获取** | ✅ 推荐 | ❌ 不推荐 | 静态配置更简单 |

**💡 使用建议**: 重点参考 **核心架构**（Provider接口、成本计算），跳过 **高级特性**（流式、Worker、复杂缓存）

详见 [简化建议](./AI-Provider-Integration-Plan.md#翻译项目的简化建议)

---

## 📂 目录结构

```
roo-code-reference/
├── INDEX.md                          # 本文件 - 索引导航
├── README.md                         # 参考代码说明
│
├── packages/types/src/               # 类型定义
│   ├── model.ts                      # ModelInfo 核心定义 ⭐⭐⭐
│   ├── providers/
│   │   ├── anthropic.ts              # Anthropic 模型定义
│   │   ├── openai.ts                 # OpenAI 模型定义
│   │   ├── gemini.ts                 # Gemini 模型定义
│   │   ├── deepseek.ts               # DeepSeek 模型定义
│   │   └── bedrock.ts                # AWS Bedrock 模型定义
│
├── src/shared/                       # 共享工具
│   ├── cost.ts                       # 成本计算核心 ⭐⭐⭐
│   └── getApiMetrics.ts              # Token统计工具 ⭐⭐
│
├── src/api/providers/                # 供应商实现
│   ├── base-provider.ts              # 基础抽象类
│   ├── anthropic.ts                  # Anthropic 实现
│   ├── openai-native.ts              # OpenAI 实现
│   ├── gemini.ts                     # Gemini 实现
│   ├── deepseek.ts                   # DeepSeek 实现
│   ├── router-provider.ts            # 路由提供商基类
│   ├── openrouter.ts                 # OpenRouter 聚合
│   └── ollama.ts                     # Ollama 本地
│
├── src/api/providers/fetchers/       # 动态模型获取
│   ├── modelCache.ts                 # 模型缓存机制 ⭐⭐⭐
│   ├── openrouter.ts                 # OpenRouter 模型获取
│   └── litellm.ts                    # LiteLLM 模型获取
│
├── webview-ui/src/                   # 前端UI组件
│   ├── components/history/
│   │   └── TaskItemFooter.tsx        # 成本展示示例
│   └── components/chat/
│       └── TaskHeader.tsx            # 实时成本显示
│
└── docs/                             # 参考文档
    ├── architecture.md               # 架构设计文档
    └── pricing-system.md             # 定价系统说明
```

---

## 🌟 核心文件导航

### ⭐⭐⭐ 必读文件

#### 1. ModelInfo 类型定义
**文件**: `packages/types/src/model.ts`
**重要性**: ⭐⭐⭐ 核心基础
**内容**:
- `ModelInfo` 接口定义
- 定价字段结构
- 分层定价 (tiers)
- 能力标识 (supports*)

**关键代码**:
```typescript
export interface ModelInfo {
  maxTokens: number
  contextWindow: number
  supportsPromptCache: boolean
  inputPrice?: number        // USD per million tokens
  outputPrice?: number
  cacheWritesPrice?: number
  cacheReadsPrice?: number
  tiers?: Array<{           // 分层定价
    name?: ServiceTier
    contextWindow: number
    inputPrice?: number
    outputPrice?: number
  }>
}
```

**适用场景**: 定义你的 Rust `ModelInfo` 结构体

---

#### 2. 成本计算核心
**文件**: `src/shared/cost.ts`
**重要性**: ⭐⭐⭐ 核心算法
**内容**:
- `calculateApiCostAnthropic()` - Anthropic协议
- `calculateApiCostOpenAI()` - OpenAI协议
- `parseApiPrice()` - 价格解析工具

**关键代码**:
```typescript
// OpenAI协议：输入包含缓存token
export function calculateApiCostOpenAI(
  modelInfo: ModelInfo,
  inputTokens: number,        // 包含所有token
  outputTokens: number,
  cacheCreationInputTokens?: number,
  cacheReadInputTokens?: number,
): number {
  const cacheCreation = cacheCreationInputTokens || 0
  const cacheRead = cacheReadInputTokens || 0
  
  // 计算非缓存输入
  const nonCachedInput = Math.max(0, inputTokens - cacheCreation - cacheRead)
  
  const inputCost = (modelInfo.inputPrice || 0) / 1_000_000 * nonCachedInput
  const outputCost = (modelInfo.outputPrice || 0) / 1_000_000 * outputTokens
  const cacheWriteCost = (modelInfo.cacheWritesPrice || 0) / 1_000_000 * cacheCreation
  const cacheReadCost = (modelInfo.cacheReadsPrice || 0) / 1_000_000 * cacheRead
  
  return inputCost + outputCost + cacheWriteCost + cacheReadCost
}
```

**适用场景**: 实现你的 `CostCalculator::calculate()`

---

#### 3. 模型缓存机制
**文件**: `src/api/providers/fetchers/modelCache.ts`
**重要性**: ⭐⭐⭐ 性能关键
**内容**:
- 双层缓存（内存+文件）
- 5分钟TTL
- 自动降级

**关键代码**:
```typescript
const memoryCache = new NodeCache({ stdTTL: 5 * 60 })

export async function getModels(provider) {
  // 1. 查内存缓存
  let models = memoryCache.get(provider)
  if (models) return models
  
  // 2. 从API获取
  try {
    models = await fetchFromAPI(provider)
    memoryCache.set(provider, models)      // 写内存
    await writeModels(provider, models)    // 写文件
  } catch (error) {
    // 3. 降级：读文件缓存
    models = await readModels(provider)
  }
  
  return models
}
```

**适用场景**: 实现你的 `ModelCache` 结构

---

### ⭐⭐ 重要参考

#### 4. Provider 基类
**文件**: `src/api/providers/base-provider.ts`
**重要性**: ⭐⭐ 架构设计
**内容**:
- 抽象基类设计
- Token计数默认实现
- 供应商可覆盖

**关键代码**:
```typescript
export abstract class BaseProvider {
  abstract createMessage(...)
  abstract getModel()
  
  // 默认实现：使用 tiktoken
  async countTokens(content) {
    return countTokens(content, { useWorker: true })
  }
}
```

**适用场景**: 设计你的 `AIProvider` trait

---

#### 5. Token使用统计
**文件**: `src/shared/getApiMetrics.ts`
**重要性**: ⭐⭐ 统计系统
**内容**:
- 从消息中提取token统计
- 累加计算总成本
- 上下文token追踪

**关键代码**:
```typescript
export function getApiMetrics(messages) {
  const result = {
    totalTokensIn: 0,
    totalTokensOut: 0,
    totalCacheReads: 0,
    totalCost: 0,
  }
  
  messages.forEach(message => {
    if (message.type === "api_req_started") {
      const { tokensIn, tokensOut, cacheReads, cost } = JSON.parse(message.text)
      result.totalTokensIn += tokensIn
      result.totalTokensOut += tokensOut
      result.totalCacheReads += cacheReads || 0
      result.totalCost += cost
    }
  })
  
  return result
}
```

**适用场景**: 实现你的 `CostTracker::get_stats()`

---

### ⭐ 参考实现

#### 6. OpenAI Provider（推荐参考）
**文件**: `src/api/providers/openai-native.ts`
**重要性**: ⭐ 供应商实现示例
**要点**:
- HTTP 请求处理
- Token 统计
- 成本计算集成
- 适合翻译项目的简单实现

**提示**: 对于翻译项目，OpenAI 的实现最具参考价值

---

#### 7. DeepSeek Provider（推荐参考）
**文件**: `src/api/providers/deepseek.ts`
**重要性**: ⭐ 中文优化示例
**要点**:
- 兼容 OpenAI 格式
- 中文翻译优化
- 超低价格
- 适合大批量翻译

**提示**: DeepSeek 性价比最高，适合翻译场景

---

#### 8. 动态模型获取（可选参考）
**文件**: `src/api/providers/fetchers/openrouter.ts`
**重要性**: ⭐ 仅供学习
**要点**:
- 从API获取模型列表（翻译项目可跳过，用静态配置更简单）
- 解析价格信息

**⚠️ 翻译项目建议**: 使用静态模型配置即可，无需动态获取

---

#### 8. UI 成本展示
**文件**: `webview-ui/src/components/chat/TaskHeader.tsx`
**重要性**: ⭐ UI展示示例
**要点**:
- 实时成本显示
- 格式化金额
- 条件渲染

**关键代码**:
```tsx
{!!totalCost && (
  <span className="cost-badge">
    ${totalCost.toFixed(4)}
  </span>
)}

// 历史记录中的成本
{!!item.totalCost && (
  <div className="cost-info">
    {"$" + item.totalCost.toFixed(2)}
  </div>
)}
```

---

## 🎯 按功能查找

### 功能1：模型信息管理

| 任务 | 参考文件 | 关键点 |
|------|---------|--------|
| 定义模型结构 | `packages/types/src/model.ts` | ModelInfo 接口 |
| 硬编码模型列表 | `packages/types/src/providers/openai.ts` | 预设配置 |
| 动态获取模型 | `src/api/providers/fetchers/openrouter.ts` | API调用 |
| 缓存模型列表 | `src/api/providers/fetchers/modelCache.ts` | 双层缓存 |

---

### 功能2：成本计算

| 任务 | 参考文件 | 关键点 |
|------|---------|--------|
| 成本计算公式 | `src/shared/cost.ts` | 两种协议 |
| Token统计 | `src/shared/getApiMetrics.ts` | 累加计算 |
| 价格解析 | `src/shared/cost.ts` | parseApiPrice() |
| 分层定价 | `packages/types/src/providers/openai.ts` | tiers数组 |

---

### 功能3：供应商实现（翻译项目推荐）

| 任务 | 参考文件 | 关键点 | 翻译项目 |
|------|---------|--------|----------|
| 基类设计 | `src/api/providers/base-provider.ts` | 抽象类 | ⭐⭐⭐ 必读 |
| OpenAI实现 | `src/api/providers/openai-native.ts` | 简单HTTP请求 | ⭐⭐⭐ 推荐 |
| DeepSeek实现 | `src/api/providers/deepseek.ts` | 中文优化 | ⭐⭐⭐ 推荐 |
| 本地模型 | `src/api/providers/ollama.ts` | 无密钥、免费 | ⭐⭐ 可选 |
| Gemini实现 | `src/api/providers/gemini.ts` | 分层定价 | ⭐ 学习 |

**⚠️ 注意**: Anthropic 不在翻译项目供应商清单中，仅作学习参考

---

### 功能4：UI组件

| 任务 | 参考文件 | 关键点 |
|------|---------|--------|
| 成本展示 | `webview-ui/src/components/chat/TaskHeader.tsx` | 格式化 |
| 历史记录 | `webview-ui/src/components/history/TaskItemFooter.tsx` | 列表项 |
| 统计面板 | - | 需自行设计 |

---

## 📖 使用指南

### 如何使用这个参考库？

#### Step 1: 理解核心概念
阅读顺序：
1. `model.ts` - 了解数据结构
2. `cost.ts` - 理解计算逻辑
3. `modelCache.ts` - 学习缓存策略

#### Step 2: 选择实现方式（翻译项目推荐）
根据你的需求：
- **静态模型配置**: 参考 `providers/openai.ts` ⭐⭐⭐ 推荐
- **本地模型**: 参考 `ollama.ts` ⭐⭐ 可选
- **动态获取**: 参考 `fetchers/openrouter.ts` ❌ 翻译项目不推荐

#### Step 3: 实现核心功能（翻译项目路线）
按顺序实现：
1. Rust `ModelInfo` 结构 ← `model.ts`（简化版）
2. Rust `CostCalculator` ← `cost.ts`（无缓存成本）
3. Rust `Provider` trait ← `base-provider.ts`
4. 具体供应商实现 ← `openai-native.ts`, `deepseek.ts`

**⚠️ 跳过**：流式响应、Worker线程、复杂缓存策略

#### Step 4: 添加UI
参考组件：
- 成本显示 ← `TaskHeader.tsx`
- 供应商选择 ← 自行设计（可参考设置界面）

---

## 🔑 关键代码片段速查

### 1. 模型定义模板（Rust）

```rust
// 改编自 packages/types/src/model.ts
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelInfo {
    pub id: String,
    pub name: String,
    pub context_window: usize,
    pub max_tokens: usize,
    pub supports_cache: bool,
    
    // 价格（USD per million tokens）
    pub input_price: Option<f64>,
    pub output_price: Option<f64>,
    pub cache_reads_price: Option<f64>,
    pub cache_writes_price: Option<f64>,
    
    // 分层定价
    pub tiers: Option<Vec<PricingTier>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PricingTier {
    pub name: Option<String>,
    pub context_window: usize,
    pub input_price: Option<f64>,
    pub output_price: Option<f64>,
}
```

### 2. 成本计算模板（Rust）

```rust
// 改编自 src/shared/cost.ts
pub fn calculate_cost_openai(
    model: &ModelInfo,
    input_tokens: usize,
    output_tokens: usize,
    cache_write_tokens: usize,
    cache_read_tokens: usize,
) -> f64 {
    // 计算非缓存输入
    let uncached_input = input_tokens
        .saturating_sub(cache_write_tokens)
        .saturating_sub(cache_read_tokens);
    
    // 价格计算
    let input_cost = model.input_price.unwrap_or(0.0) * (uncached_input as f64 / 1_000_000.0);
    let output_cost = model.output_price.unwrap_or(0.0) * (output_tokens as f64 / 1_000_000.0);
    let cache_write_cost = model.cache_writes_price.unwrap_or(0.0) * (cache_write_tokens as f64 / 1_000_000.0);
    let cache_read_cost = model.cache_reads_price.unwrap_or(0.0) * (cache_read_tokens as f64 / 1_000_000.0);
    
    input_cost + output_cost + cache_write_cost + cache_read_cost
}
```

### 3. 模型缓存模板（Rust）

```rust
// 改编自 src/api/providers/fetchers/modelCache.ts
use std::sync::Arc;
use tokio::sync::RwLock;
use std::time::{Duration, Instant};

pub struct ModelCache {
    data: Arc<RwLock<HashMap<String, CachedModels>>>,
    ttl: Duration,
}

struct CachedModels {
    models: Vec<ModelInfo>,
    cached_at: Instant,
}

impl ModelCache {
    pub fn new() -> Self {
        Self {
            data: Arc::new(RwLock::new(HashMap::new())),
            ttl: Duration::from_secs(300), // 5分钟
        }
    }
    
    pub async fn get_or_fetch<F, Fut>(
        &self,
        provider: &str,
        fetch_fn: F,
    ) -> Result<Vec<ModelInfo>>
    where
        F: FnOnce() -> Fut,
        Fut: std::future::Future<Output = Result<Vec<ModelInfo>>>,
    {
        // 1. 读缓存
        {
            let cache = self.data.read().await;
            if let Some(cached) = cache.get(provider) {
                if cached.cached_at.elapsed() < self.ttl {
                    return Ok(cached.models.clone());
                }
            }
        }
        
        // 2. 缓存未命中，调用API
        let models = fetch_fn().await?;
        
        // 3. 写缓存
        {
            let mut cache = self.data.write().await;
            cache.insert(provider.to_string(), CachedModels {
                models: models.clone(),
                cached_at: Instant::now(),
            });
        }
        
        Ok(models)
    }
}
```

---

## 🎓 学习路径

### 新手路径（2周）
1. Day 1-2: 阅读 `model.ts` + `cost.ts`
2. Day 3-4: 实现 Rust 版本的基础结构
3. Day 5-7: 实现一个供应商（OpenAI）
4. Day 8-10: 添加成本计算
5. Day 11-14: 前端集成

### 进阶路径（1周）
1. Day 1: 实现多个供应商
2. Day 2-3: 添加缓存系统
3. Day 4-5: 完善UI组件
4. Day 6-7: 测试和优化

---

## ❓ 常见问题

### Q1: 价格单位是什么？
**A**: 所有价格都是 **USD per million tokens**（每百万token的美元价格）

例如：
- `inputPrice: 3.0` = $3.00 per 1M tokens = $0.003 per 1K tokens

### Q2: Anthropic协议和OpenAI协议有什么区别？
**A**: 主要区别在 token 计数方式：
- **Anthropic**: `inputTokens` 不包含缓存token
- **OpenAI**: `inputTokens` 包含所有token（需减去缓存）

参考 `src/shared/cost.ts` 中的两个函数。

### Q3: 如何处理分层定价？
**A**: 使用 `tiers` 数组，根据上下文窗口或服务层级选择价格。

参考 `packages/types/src/providers/openai.ts` 中的 GPT-5 定义。

### Q4: 缓存TTL设多少合适？
**A**: 建议 **5分钟**，在 Roo-Code 中经过验证：
- 太短：频繁API调用
- 太长：价格更新不及时

### Q5: 需要实现所有供应商吗？
**A**: **不需要**。翻译项目建议优先级：
1. ⭐⭐⭐ 必须: OpenAI + DeepSeek（2个）
2. ⭐⭐ 推荐: Moonshot + 智谱（国内用户）
3. ⭐ 可选: Gemini + Ollama（免费/测试）

**注意**: Anthropic 不在翻译项目清单中

---

## 📋 检查清单

### 实现前检查
- [ ] 阅读 `model.ts` 了解数据结构
- [ ] 阅读 `cost.ts` 理解计算逻辑
- [ ] 阅读 `modelCache.ts` 学习缓存策略
- [ ] 确定要实现的供应商列表

### 实现中检查
- [ ] Rust ModelInfo 结构完整
- [ ] 成本计算测试通过
- [ ] 至少实现2个供应商
- [ ] 缓存机制工作正常
- [ ] UI能正确显示价格

### 实现后检查
- [ ] 单元测试覆盖率 > 80%
- [ ] 成本计算误差 < 5%
- [ ] 供应商切换流畅
- [ ] 文档完善

---

## 🔗 相关资源

### 项目链接
- [Roo-Code GitHub](https://github.com/RooVetGit/Roo-Cline)
- [ai-l10n-studio GitHub](https://github.com/XIYBHK/ai-l10n-studio)

### 官方文档
- [OpenAI Pricing](https://openai.com/api/pricing/)
- [Anthropic Pricing](https://www.anthropic.com/pricing)
- [DeepSeek Pricing](https://platform.deepseek.com/api-docs/pricing/)

### 技术文档
- [Tauri 2.x Docs](https://tauri.app/v2/)
- [Rust async-trait](https://docs.rs/async-trait)
- [React TypeScript](https://react-typescript-cheatsheet.netlify.app/)

---

## 📝 更新日志

### 2025-01-XX
- ✅ 创建参考代码库
- ✅ 提取核心文件
- ✅ 编写索引文档
- ✅ 添加代码模板

---

**开始探索参考代码吧！** 🚀

有任何问题，请查看各文件中的注释和 JSDoc。

