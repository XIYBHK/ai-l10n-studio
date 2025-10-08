# API 快速参考

> 简洁版本 - 完整文档见 `API_REFERENCE.md`

---

## 🚀 前端 API（13个模块）

```typescript
import {
  termLibraryApi,          // 术语库
  translationMemoryApi,    // 翻译记忆
  poFileApi,               // PO文件操作
  configApi,               // 配置管理
  dialogApi,               // 文件对话框
  logApi,                  // 日志系统
  promptLogApi,            // 提示词日志
  translatorApi,           // 翻译核心
  aiConfigApi,             // AI配置
  fileFormatApi,           // 文件格式
  systemPromptApi,         // 系统提示词
  languageApi,             // 语言检测
  systemApi                // 系统信息
} from '@/services/api';
```

### 常用操作

```typescript
// 1. 打开并解析 PO 文件
const filePath = await dialogApi.openFile();
const entries = await poFileApi.parse(filePath);

// 2. 翻译文本
const result = await translatorApi.translateBatchWithStats(texts);

// 3. 保存文件
await poFileApi.save(filePath, entries);

// 4. 添加术语
await termLibraryApi.addTerm({ source, userTranslation, aiTranslation });

// 5. 配置 AI
await aiConfigApi.add(config);
await aiConfigApi.setActive(index);
```

---

## 📡 Tauri 命令（52个）

### 核心功能（14个）
```
parse_po_file                 解析PO文件
save_po_file                  保存PO文件
translate_entry               单条翻译
translate_batch               批量翻译
translate_batch_with_stats    带统计批量翻译
contextual_refine             精翻
get_translation_memory        获取翻译记忆
get_term_library              获取术语库
get_all_ai_configs            获取AI配置
test_ai_connection            测试AI连接
get_system_prompt             获取系统提示词
detect_text_language          检测语言
open_file_dialog              打开文件
save_file_dialog              保存文件
```

### 完整列表
见 `API_REFERENCE.md` 的 "Tauri 命令" 章节

---

## 🎯 事件系统

```typescript
import { eventDispatcher } from '@/services/eventDispatcher';

// 订阅
const unsubscribe = eventDispatcher.on('translation:progress', (data) => {
  console.log(data.index, data.translation);
});

// 发送
eventDispatcher.emit('translation:stats', stats);

// 取消
unsubscribe();
```

### 常用事件
```
translation:progress    翻译进度
translation:stats       翻译统计
translation:error       翻译错误
file:loaded            文件加载
config:updated         配置更新
term:added             术语添加
```

---

## 💾 状态管理

```typescript
// 会话状态（不持久化）
import { useSessionStore } from '@/store';
const { entries, currentEntry, setEntries } = useSessionStore();

// 用户设置（持久化）
import { useSettingsStore } from '@/store';
const { theme, language, toggleTheme } = useSettingsStore();

// 累计统计（持久化）
import { useStatsStore } from '@/store';
const { cumulativeStats, updateCumulativeStats } = useStatsStore();
```

---

## ⚠️ 架构问题摘要

| 问题 | 严重程度 | 建议 |
|------|---------|------|
| 命令冗余 (`get_config` vs `get_app_config`) | 🟡 中 | 合并 |
| 参数不一致 (`translate_batch` vs `translate_batch_with_stats`) | 🟡 中 | 统一 |
| 旧 Store 未移除 (`useAppStore`) | 🟡 中 | 清理 |
| 事件命名不统一 (`:` vs `-`) | 🟢 低 | 规范化 |
| 命名风格不一致 | 🟢 低 | 统一 |

**详细分析**: 见 `API_REFERENCE.md` 的 "不合理之处及改进建议" 章节

---

## 📝 类型定义

所有类型自动生成于 `src/types/generated/`（16个）：

```typescript
import type { 
  AIConfig, 
  POEntry, 
  TranslationStats 
} from '@/types/generated/';
```

**生成命令**: `cd src-tauri && cargo test --features ts-rs`

---

## 🎨 最佳实践

```typescript
// ✅ 使用 API 封装
await translatorApi.translateBatch(texts);

// ❌ 避免直接 invoke
// await invoke('translate_batch', { texts });

// ✅ 使用新 Stores
const { entries } = useSessionStore();

// ❌ 避免旧 Store
// const { entries } = useAppStore();

// ✅ 记得取消订阅
useEffect(() => {
  const unsub = eventDispatcher.on('event', handler);
  return () => unsub();
}, []);
```

---

**完整文档**: `API_REFERENCE.md` | **迁移指南**: `STORE_MIGRATION_GUIDE.md` | **框架改进**: `FRAMEWORK_IMPROVEMENTS_SUMMARY.md`

