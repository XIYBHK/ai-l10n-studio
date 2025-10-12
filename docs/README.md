## 文档索引（简版）

目标：提供尽量简短、可快速定位的信息入口。详尽内容请查看对应"长文档"。

- **快速上手**: 查看 `docs/archive/gui/QUICK_START.md`
- **用户手册**: 查看 `docs/gui/USER_MANUAL.md`
- **架构概览（简版）**: 查看 `docs/Architecture.md`
- **API 索引（简版）**: 查看 `docs/API.md`
- **数据契约（简版）**: 查看 `docs/DataContract.md`
- **完整架构与阶段总结（长文）**: 见 `docs/archive/gui/` 目录
- **变更记录**: 见仓库根 `API_REFERENCE_V2.md`、`FEATURES_STATUS.md`、`README.md`

---

## 🆕 AI供应商架构升级（2025-10-10）

基于 Roo-Code 优秀实践的架构重构，统一 API，提供精确成本计算。

### 📄 核心文档

- [`AI_INTEGRATION_SUMMARY.md`](./AI_INTEGRATION_SUMMARY.md) - **完整集成总结**
- [`API_UNIFICATION_REPORT.md`](./API_UNIFICATION_REPORT.md) - **API统一性检查**
- [`AI_ARCHITECTURE_CHANGELOG.md`](./AI_ARCHITECTURE_CHANGELOG.md) - 后端架构升级日志
- [`AI_FRONTEND_INTEGRATION.md`](./AI_FRONTEND_INTEGRATION.md) - 前端集成指南

### ✅ 完成内容

**后端 (Phase 1-3)**:

- ✅ **统一 API** - 移除旧版 API，单一入口
- ✅ **ModelInfo 管理** - 统一模型信息（参数、定价、能力）
- ✅ **精确成本计算** - 支持缓存成本（节省高达90%）
- ✅ **价格标准化** - USD per million tokens
- ✅ **10个模型** - OpenAI (4), Moonshot (4), DeepSeek (2)
- ✅ **Nextest 集成** - 测试加速 13 倍（8.5s → 0.6s）

**前端 (Phase 4)**:

- ✅ **TypeScript 类型** - 自动生成（ModelInfo, CostBreakdown）
- ✅ **API 服务层** - aiModelApi（5个接口）
- ✅ **UI 组件** - ModelInfoCard + CostEstimator
- ✅ **集成文档** - 详细的实施指南和示例

### 📊 亮点

- **DeepSeek V3** 性价比之王 - $0.14/M（比 GPT-4o-mini 便宜93%）
- **缓存优化** - 30%命中率节省27%成本
- **测试极速** - Nextest 加速 92.5%
- **类型安全** - Rust/TS 类型自动生成

---

维护约定：

- 简版文档保持 1 页内即可读完；必要时链接到长文档。
- 长文档集中存放在 `docs/gui/`（或后续归档到 `docs/archive/gui/`）。
