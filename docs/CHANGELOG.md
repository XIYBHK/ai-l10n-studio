# 更新日志

## 2025-01-11

### 新增
- 统一格式化工具模块 `src/utils/formatters.ts`
  - `formatCost()` - 成本显示（美元格式）
  - `formatCostByLocale()` - 🆕 多语言货币支持（中文显示人民币，其他显示美元）
  - `formatTokens()`, `formatPercentage()`, `formatDuration()` 等
- **统计格式化器** `src/services/statsFormatter.ts`
  - 整合统计系统 V2（Event Sourcing）和格式化工具
  - 提供 ready-to-display 数据（`FormattedStatsSummary`）
  - 支持多种视图：完整版、简洁版、调试版、多语言成本
- 设置页预设模型选择器（显示模型定价和参数）

### 优化
- 供应商配置统一管理（从 `PROVIDER_INFO_MAP` 动态生成，减少48行重复代码）
- 成本显示格式统一为美元（`$0.0023` 小金额4位小数，`$12.35` 大金额2位小数）
- AIWorkspace 统计面板应用统一格式化函数（6处）
- **StatsEngine 集成格式化器**：新增 `getFormattedSessionStats()` 和增强调试信息
- 累计统计区排版优化：「总计翻译-AI调用 / 记忆命中-去重命中」

### 修复
- 修正本次会话统计百分比计算逻辑：使用实际处理条目数（tm_hits + deduplicated + ai_translated）作为分母，而非文件总条目数
- API 参数名错误：`providerType` → `provider`（影响4个 AI 模型 API）

### 文档
- 更新 `docs/API.md` 统一格式化工具说明

