# 🚀 PO Translator GUI - 快速参考卡

**版本**: Phase 8 v2.0 | **日期**: 2025-10-08

---

## 📊 一分钟了解

| 项目 | 数量 |
|------|------|
| Tauri 命令 | 40 |
| API 模块 | 13 |
| 事件类型 | 20+ |
| 测试覆盖 | 73 测试 |
| 架构评分 | ⭐⭐⭐⭐☆ (4.7/5) |

---

## 📚 文档速查

| 需求 | 文档 | 时长 |
|------|------|------|
| 🏃 **快速了解** | [ARCHITECTURE_SUMMARY](ARCHITECTURE_SUMMARY.md) | 2 分钟 |
| 📖 **查 API** | [API_REFERENCE_V2](API_REFERENCE_V2.md) | 5 分钟 |
| 🏗️ **看架构** | [ARCHITECTURE_OVERVIEW](ARCHITECTURE_OVERVIEW.md) | 15 分钟 |
| ✅ **看改进** | [IMPROVEMENTS_COMPLETED](IMPROVEMENTS_COMPLETED.md) | 3 分钟 |

---

## 🔑 核心 API（Top 5）

```typescript
// 1. 翻译
const { translations, stats } = await translatorApi.translateBatch(texts);

// 2. AI 配置
const config = await aiConfigApi.getActive();

// 3. 解析 PO
const entries = await poFileApi.parse(filePath);

// 4. 事件订阅
eventDispatcher.on('translation:progress', handler);

// 5. 状态管理
const { entries } = useSessionStore();
```

---

## 📁 项目结构

```
po-translator-gui/
├── src/               前端 (React + TS)
│   ├── components/    8 核心组件
│   ├── services/      13 API 模块
│   ├── store/         3 Zustand Stores
│   └── hooks/         自定义 Hooks
├── src-tauri/         后端 (Rust)
│   ├── commands/      Tauri 命令
│   └── services/      10 核心服务
└── docs/              8 核心文档 ⭐
```

---

## ⚡ 常用命令

```bash
# 开发
npm run tauri:dev

# 构建
npm run tauri:build

# 测试
cargo test --features ts-rs

# 生成类型
cargo test --features ts-rs
```

---

## 🎯 最佳实践

### ✅ 推荐
```typescript
// 使用 API 模块
await translatorApi.translateBatch(texts);

// 分离的 Stores
const { entries } = useSessionStore();

// 类型安全事件
eventDispatcher.on('refine:start', handler);
```

### ❌ 避免
```typescript
// 直接 invoke
await invoke('translate_batch', { texts });

// 旧 Store
const { entries } = useAppStore();

// 硬编码事件名
listen('contextual-refine-start', ...);
```

---

## 📞 快速帮助

- 💬 **问题**: 查看 [DOCUMENTATION_INDEX](DOCUMENTATION_INDEX.md)
- 🐛 **Bug**: 创建 Issue
- 💡 **建议**: 提交 PR

---

**架构优秀 · 文档齐全 · 生产就绪** ✅

