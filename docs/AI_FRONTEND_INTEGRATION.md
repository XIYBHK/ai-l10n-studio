# AI 模型前端集成指南

> Phase 4 前端集成完成文档

## 📦 已完成内容

> **注意**：本文档中的 CostEstimator 组件已被删除，因为翻译前成本预估功能不需要。
> 
> **实际集成方案**：
> 1. ✅ 在 AI 工作区显示实际成本（使用新的精确计算）
> 2. ✅ 在设置页显示模型参数信息

### 1. TypeScript 类型（自动生成）✅

```typescript
// src/types/generated/ModelInfo.ts
export interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  context_window: number;
  max_output_tokens: number;
  input_price: number;       // USD per 1M tokens
  output_price: number;
  cache_reads_price: number | null;
  cache_writes_price: number | null;
  supports_cache: boolean;
  supports_images: boolean;
  description: string | null;
  recommended: boolean;
}

// src/types/generated/CostBreakdown.ts
export interface CostBreakdown {
  input_tokens: number;
  output_tokens: number;
  cache_write_tokens: number;
  cache_read_tokens: number;
  input_cost: number;
  output_cost: number;
  cache_write_cost: number;
  cache_read_cost: number;
  total_cost: number;
  cache_savings: number;
  cache_hit_rate: number;
}
```

### 2. API 服务层 ✅

```typescript
// src/services/api.ts

export const aiModelApi = {
  // 获取供应商所有模型
  async getProviderModels(provider: string): Promise<ModelInfo[]>
  
  // 获取单个模型信息
  async getModelInfo(provider: string, modelId: string): Promise<ModelInfo | null>
  
  // 估算翻译成本（基于字符数）
  async estimateTranslationCost(provider, modelId, totalChars, cacheHitRate?): Promise<number>
  
  // 精确计算成本（基于 token）
  async calculatePreciseCost(...): Promise<CostBreakdown>
  
  // 获取所有供应商
  async getAllProviders(): Promise<string[]>
}
```

### 3. UI 组件 ✅

#### ModelInfoCard - 模型信息卡片

```tsx
import { ModelInfoCard } from '../components/ModelInfoCard';

<ModelInfoCard
  model={modelInfo}
  selected={false}
  onClick={() => handleSelectModel(modelInfo)}
/>
```

**功能**:
- 展示模型名称、供应商、推荐标记
- 显示技术参数（上下文窗口、最大输出）
- 显示定价信息（输入/输出/缓存）
- 显示能力标签（缓存、多模态）
- 支持选中状态和点击事件

#### CostEstimator - 成本估算器

```tsx
import { CostEstimator } from '../components/CostEstimator';

<CostEstimator
  provider="OpenAI"
  modelId="gpt-4o-mini"
  defaultCharCount={10000}
  defaultCacheHitRate={0.3}
/>
```

**功能**:
- 实时估算翻译成本
- 调整字符数和缓存命中率
- 显示成本明细和节省金额
- 成本预警提示

---

## 🔌 集成示例

### 方案 1: 在设置界面添加模型选择

```tsx
// src/components/SettingsModal.tsx

import { useState, useEffect } from 'react';
import { Tabs, Row, Col } from 'antd';
import { aiModelApi } from '../services/api';
import { ModelInfoCard } from './ModelInfoCard';

// 在 AI 配置表单中添加模型选择
const AIConfigForm = ({ config }) => {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('');

  useEffect(() => {
    // 加载当前供应商的模型列表
    aiModelApi.getProviderModels(config.provider)
      .then(setModels)
      .catch(console.error);
  }, [config.provider]);

  return (
    <>
      {/* 现有的供应商选择、API Key 等 */}
      
      {/* 新增：模型选择 */}
      <Form.Item label="选择模型">
        <Row gutter={[16, 16]}>
          {models.map(model => (
            <Col key={model.id} span={12}>
              <ModelInfoCard
                model={model}
                selected={selectedModel === model.id}
                onClick={() => setSelectedModel(model.id)}
              />
            </Col>
          ))}
        </Row>
      </Form.Item>
    </>
  );
};
```

### 方案 2: 在翻译前显示成本预估

```tsx
// src/components/EditorPane.tsx 或 MenuBar.tsx

import { useState } from 'react';
import { Modal, Button } from 'antd';
import { DollarOutlined } from '@ant-design/icons';
import { CostEstimator } from './CostEstimator';

const TranslationToolbar = ({ entries, config }) => {
  const [showCostModal, setShowCostModal] = useState(false);
  
  // 计算总字符数
  const totalChars = entries
    .filter(e => !e.msgstr && e.msgid)
    .reduce((sum, e) => sum + e.msgid.length, 0);

  const handleStartTranslation = async () => {
    // 显示成本预估
    setShowCostModal(true);
  };

  return (
    <>
      <Button 
        type="primary" 
        icon={<DollarOutlined />}
        onClick={handleStartTranslation}
      >
        开始翻译（查看成本）
      </Button>

      <Modal
        title="翻译成本预估"
        open={showCostModal}
        onCancel={() => setShowCostModal(false)}
        onOk={() => {
          setShowCostModal(false);
          // 执行翻译
          handleBatchTranslate();
        }}
        okText="确认并翻译"
        cancelText="取消"
      >
        <CostEstimator
          provider={config.provider}
          modelId={config.model || 'gpt-4o-mini'}
          defaultCharCount={totalChars}
          defaultCacheHitRate={0.3}
        />
      </Modal>
    </>
  );
};
```

### 方案 3: 在翻译后显示实际成本

```tsx
// 监听翻译完成事件

import { useEventListener } from '../hooks/useEventListener';
import { CostBreakdown } from '../types/generated/ModelInfo';

const TranslationStatsPanel = () => {
  const [costBreakdown, setCostBreakdown] = useState<CostBreakdown | null>(null);

  useEventListener('translation:completed', (event) => {
    const { stats } = event.detail;
    
    // 计算实际成本
    aiModelApi.calculatePreciseCost(
      config.provider,
      config.model,
      stats.input_tokens,
      stats.output_tokens,
      0, // cache_write_tokens
      stats.cache_tokens || 0
    ).then(setCostBreakdown);
  });

  if (!costBreakdown) return null;

  return (
    <Card>
      <Statistic
        title="本次翻译成本"
        value={costBreakdown.total_cost}
        precision={4}
        prefix="$"
      />
      {costBreakdown.cache_savings > 0 && (
        <Text type="success">
          💾 缓存节省: ${costBreakdown.cache_savings.toFixed(4)} 
          ({costBreakdown.cache_hit_rate.toFixed(1)}% 命中率)
        </Text>
      )}
    </Card>
  );
};
```

---

## 🎨 UI 预览

### ModelInfoCard 布局

```
┌─────────────────────────────────────┐
│ GPT-4o Mini [推荐]         OpenAI  │
│ 性价比最高的小模型                    │
├─────────────────────────────────────┤
│ 🌐 上下文窗口: 128K                  │
│ ⚡ 最大输出: 16K                    │
│ 💵 输入价格: $0.15/M                │
│ 💵 输出价格: $0.60/M                │
│ 💾 缓存价格: $0.075/M [省50%]       │
├─────────────────────────────────────┤
│ [⚡ 提示词缓存] [🖼️ 多模态]          │
└─────────────────────────────────────┘
```

### CostEstimator 布局

```
┌─────────────────────────────────────┐
│ 💵 成本估算                          │
├─────────────────────────────────────┤
│ 翻译字符数: [10,000]                 │
│ ⚡ 估算 Token: 2,500 输入 + 2,500 输出│
│                                      │
│ 💾 缓存命中率: 30%                   │
│ ├────────────────────────────────┤ │
│ 0%      30%      50%        100%  │
│                                      │
│ ✅ 节省成本约 $0.0002                │
│                                      │
│ ┌─────────────┬─────────────┐      │
│ │ 估算成本     │ 每千字符     │      │
│ │ $0.0012    │ $0.0001     │      │
│ └─────────────┴─────────────┘      │
│                                      │
│ 价格明细:                            │
│ • 输入价格: $0.15/1M tokens         │
│ • 输出价格: $0.60/1M tokens         │
│ • 缓存价格: $0.075/1M tokens        │
└─────────────────────────────────────┘
```

---

## 📝 实施建议

### 阶段 1: 模型选择（可选）

在 SettingsModal 中添加模型选择功能，让用户可以为每个 AI 配置选择特定模型。

**优先级**: 🟡 中等（可以使用默认模型）

### 阶段 2: 翻译前成本预估（推荐）

在批量翻译前显示成本预估，让用户知道大概花费。

**优先级**: 🟢 高（提升用户体验）

**实施位置**: `MenuBar.tsx` 的"批量翻译"按钮

### 阶段 3: 翻译后成本统计（可选）

翻译完成后显示实际花费和缓存节省情况。

**优先级**: 🟡 中等（统计价值）

**实施位置**: 翻译完成通知或统计面板

---

## 🔧 开发提示

### 1. 类型安全

所有类型已自动生成，直接从 `src/types/generated/` 导入即可。

```typescript
import type { ModelInfo, CostBreakdown } from '../types/generated/ModelInfo';
```

### 2. API 调用

使用统一的 API 服务层，自动处理错误和日志。

```typescript
import { aiModelApi } from '../services/api';

// 获取模型
const models = await aiModelApi.getProviderModels('OpenAI');

// 估算成本
const cost = await aiModelApi.estimateTranslationCost('OpenAI', 'gpt-4o-mini', 10000);
```

### 3. 错误处理

API 层已内置错误处理，无需额外 try-catch（除非需要自定义处理）。

```typescript
// 自动显示错误消息
const models = await aiModelApi.getProviderModels('OpenAI');

// 或者捕获错误自定义处理
try {
  const models = await aiModelApi.getProviderModels('OpenAI');
} catch (error) {
  // 自定义错误处理
}
```

### 4. 性能优化

- ModelInfoCard 使用 memo 优化（如果在列表中渲染多个）
- CostEstimator 内部已做 debounce 处理
- 模型列表可以缓存（provider 不变时）

---

## 🚀 快速测试

### 测试 API

```typescript
// 在浏览器控制台或组件中测试

import { aiModelApi } from './services/api';

// 1. 获取所有供应商
const providers = await aiModelApi.getAllProviders();
console.log('供应商:', providers);

// 2. 获取 OpenAI 模型列表
const models = await aiModelApi.getProviderModels('OpenAI');
console.log('OpenAI 模型:', models);

// 3. 估算成本
const cost = await aiModelApi.estimateTranslationCost(
  'OpenAI',
  'gpt-4o-mini',
  10000,  // 10000 字符
  0.3     // 30% 缓存命中率
);
console.log('预估成本:', cost);
```

### 测试组件

```tsx
// 在 App.tsx 或任意页面临时添加

import { ModelInfoCard } from './components/ModelInfoCard';
import { CostEstimator } from './components/CostEstimator';

// 测试 ModelInfoCard
<ModelInfoCard
  model={{
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'OpenAI',
    context_window: 128000,
    max_output_tokens: 16384,
    input_price: 0.15,
    output_price: 0.60,
    cache_reads_price: 0.075,
    cache_writes_price: 0.1875,
    supports_cache: true,
    supports_images: true,
    description: '性价比最高的小模型',
    recommended: true,
  }}
/>

// 测试 CostEstimator
<CostEstimator
  provider="OpenAI"
  modelId="gpt-4o-mini"
  defaultCharCount={10000}
  defaultCacheHitRate={0.3}
/>
```

---

## ✅ 完成清单

- [x] 生成 TypeScript 类型定义
- [x] 创建 API 服务层（aiModelApi）
- [x] 创建 ModelInfoCard 组件
- [x] 创建 CostEstimator 组件
- [x] 编写集成文档和示例
- [ ] 集成到 SettingsModal（可选）
- [ ] 集成到 MenuBar（推荐）
- [ ] 集成到翻译统计（可选）

---

## 📚 相关文档

- [`AI_ARCHITECTURE_CHANGELOG.md`](./AI_ARCHITECTURE_CHANGELOG.md) - 架构升级日志
- [`NEXTEST_SETUP.md`](../NEXTEST_SETUP.md) - 测试加速指南
- [`API_REFERENCE_V2.md`](./archive/API_REFERENCE_V2.md) - API 参考

---

**前端集成基础已完成！根据需要选择集成方案。** ✅

