# 📚 Roo-Code 参考代码库

> 从 [Roo-Code](https://github.com/RooVetGit/Roo-Cline) 提取的核心代码
> 
> 用于 ai-l10n-studio 多AI供应商功能开发参考

---

## 🌟 设计亮点

这套框架的 **8 大生产级设计理念**：

🔄 **容错优先** - 多层缓存、自动重试、Fallback | 💰 **成本透明** - 精确计费、分层定价  
🔌 **高扩展性** - 统一接口、插件架构 | 🎛️ **灵活配置** - 企业认证、自定义端点  
⚡ **性能优化** - Worker 线程、流式响应 | 🧠 **智能适配** - 特性识别、动态调整  
🔒 **安全合规** - VPC、私有部署、多认证 | 📈 **可观测性** - Token 追踪、成本统计

> 详见 [AI-Provider-Integration-Plan.md](./AI-Provider-Integration-Plan.md#设计哲学)

### ⚠️ 避免过度设计（重要！）

**翻译项目 ≠ 对话助手！** Roo-Code 的部分功能对翻译场景来说是过度设计：

| 特性 | Roo-Code（对话） | 翻译项目 | 原因 |
|------|----------------|---------|------|
| **供应商数量** | 10+ | 6个 | OpenAI, DeepSeek, Moonshot, Gemini, 智谱, Ollama |
| **流式响应** | ✅ 实时显示 | ❌ 不需要 | 批量翻译可以等待完成 |
| **Worker线程** | ✅ 高并发 | ❌ 不需要 | Rust异步足够 |
| **缓存成本** | ✅ 精确计算 | ⚠️ 简化 | 基础成本足够 |
| **动态模型** | ✅ API获取 | ❌ 静态配置 | 翻译模型稳定，无需动态 |

**💡 实施建议**：
- ❌ **跳过**：Worker线程、流式响应、ARN解析、VPC、审计日志、复杂分层定价
- ⚠️ **简化**：缓存成本、文件缓存、重试策略
- ✅ **保留**：Provider接口、基础成本计算、简单缓存、6个供应商

详见 [简化建议](./AI-Provider-Integration-Plan.md#翻译项目的简化建议)

---

## 🎯 使用说明

### 这个目录包含什么？

本目录按照 Roo-Code 的原始目录结构，保留了实现多AI供应商系统的**核心代码文件**。

### 为什么不直接克隆整个仓库？

1. **聚焦核心** - 只保留与多供应商和成本追踪相关的代码
2. **快速查阅** - 不需要在庞大的代码库中搜索
3. **离线可用** - 本地保存，随时参考
4. **版本固定** - 避免上游变更影响参考

---

## 📖 快速导航

### 🌟 必读文件（优先级从高到低）

#### ⭐⭐⭐ 核心基础
1. **packages/types/src/model.ts** - ModelInfo类型定义
2. **src/shared/cost.ts** - 成本计算核心算法
3. **src/api/providers/fetchers/modelCache.ts** - 缓存机制

#### ⭐⭐ 重要参考
4. **src/api/providers/base-provider.ts** - Provider基类设计
5. **src/shared/getApiMetrics.ts** - Token使用统计
6. **packages/types/src/providers/openai.ts** - 模型定义示例

#### ⭐ 供应商实现示例（翻译项目推荐）
7. **src/api/providers/openai-native.ts** - OpenAI实现 ⭐⭐⭐
8. **src/api/providers/deepseek.ts** - DeepSeek实现 ⭐⭐⭐
9. **src/api/providers/gemini.ts** - Gemini实现 ⭐⭐
10. **src/api/providers/ollama.ts** - 本地模型实现 ⭐⭐

**注意**: Anthropic 仅作学习参考（不在翻译项目清单）

### 🎨 UI参考
11. **webview-ui/src/components/chat/TaskHeader.tsx** - 成本展示UI
12. **webview-ui/src/components/history/TaskItemFooter.tsx** - 历史成本

---

## 📂 目录结构说明

```
roo-code-reference/
│
├── packages/types/src/          # TypeScript类型定义（转换为Rust）
│   ├── model.ts                 # ⭐⭐⭐ 核心类型
│   └── providers/               # 各供应商的模型定义
│       ├── anthropic.ts         # Claude模型
│       ├── openai.ts            # GPT模型
│       ├── gemini.ts            # Gemini模型
│       ├── deepseek.ts          # DeepSeek模型
│       └── bedrock.ts           # AWS Bedrock
│
├── src/shared/                  # 共享工具函数
│   ├── cost.ts                  # ⭐⭐⭐ 成本计算
│   └── getApiMetrics.ts         # ⭐⭐ Token统计
│
├── src/api/providers/           # 供应商实现
│   ├── base-provider.ts         # ⭐⭐ 基类
│   ├── openai-native.ts         # OpenAI实现 ⭐⭐⭐
│   ├── deepseek.ts              # DeepSeek实现 ⭐⭐⭐
│   ├── gemini.ts                # Gemini实现 ⭐⭐
│   ├── ollama.ts                # Ollama本地 ⭐⭐
│   ├── anthropic.ts             # (学习参考，非必需)
│   ├── router-provider.ts       # (学习参考)
│   └── openrouter.ts            # (学习参考)
│
├── src/api/providers/fetchers/  # 动态获取模型
│   ├── modelCache.ts            # ⭐⭐⭐ 缓存机制
│   ├── openrouter.ts            # OpenRouter获取
│   └── litellm.ts               # LiteLLM获取
│
└── webview-ui/src/components/   # UI组件参考
    ├── chat/TaskHeader.tsx      # 成本显示
    └── history/TaskItemFooter.tsx
```

---

## 🔑 核心概念解析

### 1. ModelInfo 设计哲学

**目标**: 用统一的数据结构描述所有AI模型

**核心字段**:
```typescript
{
  // 技术参数
  contextWindow: 128000,      // 上下文窗口大小
  maxTokens: 8192,            // 最大输出token
  
  // 定价（USD per million tokens）
  inputPrice: 3.0,            // $3/M
  outputPrice: 15.0,          // $15/M
  cacheReadsPrice: 0.3,       // 缓存读取 $0.3/M
  
  // 能力标识
  supportsCache: true,        // 支持缓存
  supportsImages: true,       // 支持图像
  
  // 分层定价（可选）
  tiers: [...]                // 不同规格的价格
}
```

**设计亮点**:
- ✅ 所有价格统一单位（per million tokens）
- ✅ 可选字段支持不同供应商特性
- ✅ 分层定价支持复杂计费模式

---

### 2. 成本计算的两种协议

#### Anthropic 协议
```typescript
// inputTokens 不包含缓存token
calculateApiCostAnthropic(
  modelInfo,
  inputTokens: 1000,          // 仅非缓存输入
  outputTokens: 500,
  cacheWriteTokens: 200,      // 单独传入
  cacheReadTokens: 300        // 单独传入
)
```

#### OpenAI 协议
```typescript
// inputTokens 包含所有token
calculateApiCostOpenAI(
  modelInfo,
  inputTokens: 1500,          // 包含缓存（1000 + 200 + 300）
  outputTokens: 500,
  cacheWriteTokens: 200,      // 需从总数中减去
  cacheReadTokens: 300        // 需从总数中减去
)
```

**为什么有两种？**
- 不同供应商的API返回格式不同
- Anthropic已经分离了缓存token
- OpenAI需要手动计算

---

### 3. 缓存策略

**双层缓存架构**:

```
请求 → 内存缓存 → 文件缓存 → API调用
         (5分钟)    (持久化)
           ↓          ↓
         命中 ←───────┘
```

**实现要点**:
```typescript
// 1. 先查内存（最快）
let models = memoryCache.get(provider)
if (models) return models

// 2. 调用API
models = await fetchFromAPI(provider)

// 3. 双写
memoryCache.set(provider, models)     // 写内存
await writeFile(provider, models)     // 写文件

// 4. 错误降级
catch (error) {
  models = await readFile(provider)   // 读文件缓存
}
```

**优势**:
- ⚡ 内存缓存响应快（<1ms）
- 💾 文件缓存持久化（重启可用）
- 🔄 API失败时降级（离线可用）

---

### 4. Provider 抽象设计

**核心思想**: 所有供应商实现统一接口

```typescript
interface BaseProvider {
  // 必须实现
  createMessage(...)       // 执行翻译
  getModel()              // 获取模型信息
  
  // 可选覆盖
  countTokens(...)        // Token计数（默认tiktoken）
}
```

**具体供应商**:
```typescript
class OpenAIProvider extends BaseProvider {
  // 使用默认的 countTokens
}

class AnthropicProvider extends BaseProvider {
  // 覆盖：使用官方API计数
  override async countTokens(...) {
    return this.client.messages.countTokens(...)
  }
}
```

**设计优势**:
- ✅ 新增供应商只需实现接口
- ✅ 默认实现减少重复代码
- ✅ 可覆盖实现优化特定供应商

---

## 💡 实现提示

### 从 TypeScript 到 Rust

#### 类型映射

| TypeScript | Rust |
|------------|------|
| `interface ModelInfo` | `struct ModelInfo` |
| `number` | `f64` (价格) / `usize` (token数) |
| `boolean` | `bool` |
| `string` | `String` |
| `Array<T>` | `Vec<T>` |
| `T \| undefined` | `Option<T>` |
| `async function` | `async fn` |
| `Promise<T>` | `Future<Output = T>` |

#### 示例转换

**TypeScript**:
```typescript
export interface ModelInfo {
  id: string;
  contextWindow: number;
  inputPrice?: number;
  tiers?: Array<PricingTier>;
}
```

**Rust**:
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelInfo {
    pub id: String,
    pub context_window: usize,
    pub input_price: Option<f64>,
    pub tiers: Option<Vec<PricingTier>>,
}
```

---

### 异步处理

**TypeScript**:
```typescript
async function fetchModels(): Promise<ModelInfo[]> {
  const response = await fetch(url)
  return await response.json()
}
```

**Rust**:
```rust
async fn fetch_models() -> Result<Vec<ModelInfo>, Error> {
    let response = reqwest::get(url).await?;
    let models = response.json().await?;
    Ok(models)
}
```

---

### 错误处理

**TypeScript**:
```typescript
try {
  const result = await riskyOperation()
} catch (error) {
  console.error(error)
  return fallback()
}
```

**Rust**:
```rust
match risky_operation().await {
    Ok(result) => result,
    Err(error) => {
        eprintln!("{}", error);
        fallback()
    }
}
```

---

## 🎓 学习路径

### Day 1-2: 理解数据结构
1. 读 `model.ts`
2. 理解每个字段含义
3. 画出数据结构图

### Day 3-4: 学习成本计算
1. 读 `cost.ts`
2. 手动计算几个例子
3. 理解两种协议差异

### Day 5-7: 研究供应商实现（翻译项目推荐）
1. 读 `openai-native.ts`（推荐，简单清晰）
2. 读 `deepseek.ts`（中文优化）
3. 看 `ollama.ts`（最简单，本地免费）
4. （可选）读 `anthropic.ts` - 仅作学习

### Day 8-10: 理解缓存机制
1. 读 `modelCache.ts`
2. 画出缓存流程图
3. 思考错误处理

### Day 11-14: 开始实现
1. 实现 Rust 数据结构
2. 实现成本计算
3. 实现一个供应商
4. 添加缓存

---

## 📝 注意事项

### ⚠️ 不要直接复制粘贴

**原因**:
1. TypeScript ≠ Rust，需要转换
2. Node.js 生态 ≠ Rust 生态
3. VSCode扩展 ≠ Tauri应用

### ✅ 正确使用方式

1. **理解概念** - 为什么这样设计？
2. **适配需求** - 你的场景需要什么？
3. **改写实现** - 用Rust重新实现
4. **测试验证** - 确保逻辑正确

---

## 🔗 相关链接

- [完整索引文档](./INDEX.md)
- [技术实施方案](../AI-Provider-Integration-Plan.md)
- [Roo-Code 仓库](https://github.com/RooVetGit/Roo-Cline)
- [ai-l10n-studio 仓库](https://github.com/XIYBHK/ai-l10n-studio)

---

## 📞 获取帮助

遇到问题？

1. 查看 [INDEX.md](./INDEX.md) 的常见问题
2. 阅读代码中的注释和JSDoc
3. 对比多个供应商实现找共性
4. 在 Roo-Code 仓库提Issue

---

**准备好开始学习了吗？** 📚

从 `packages/types/src/model.ts` 开始！

