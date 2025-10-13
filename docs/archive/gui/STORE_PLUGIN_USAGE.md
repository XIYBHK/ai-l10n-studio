# Tauri Store Plugin 使用指南

## 概述

Tauri Store Plugin 提供了一个类型安全、持久化的键值存储系统，用于替代传统的 `localStorage`。

**优势**:
- ✅ 类型安全（TypeScript 支持）
- ✅ 原生 Rust 性能
- ✅ 支持加密
- ✅ 自动持久化
- ✅ 比 localStorage 更可靠

---

## 安装

### 1. 前端依赖

```bash
npm install @tauri-apps/plugin-store
```

### 2. 后端集成

已完成（无需额外操作）：
- ✅ `Cargo.toml` - 添加依赖
- ✅ `main.rs` - 初始化插件
- ✅ `capabilities/store.json` - 配置权限

---

## 基础用法

### 初始化 Store

```typescript
import { Store } from '@tauri-apps/plugin-store';

// 创建或加载 store
const store = new Store('app-settings.json');

// 确保 store 已加载
await store.load();
```

### 保存数据

```typescript
// 保存单个值
await store.set('theme', 'dark');
await store.set('language', 'zh-CN');
await store.set('lastFile', '/path/to/file.po');

// 保存对象
await store.set('userPreferences', {
  autoSave: true,
  fontSize: 14,
  provider: 'moonshot'
});

// 保存数组
await store.set('recentFiles', [
  '/path/to/file1.po',
  '/path/to/file2.po',
  '/path/to/file3.po'
]);

// 立即持久化到磁盘
await store.save();
```

### 读取数据

```typescript
// 读取单个值
const theme = await store.get<string>('theme');
console.log(theme); // 'dark'

// 读取对象（类型安全）
interface UserPreferences {
  autoSave: boolean;
  fontSize: number;
  provider: string;
}

const prefs = await store.get<UserPreferences>('userPreferences');
console.log(prefs.autoSave); // true

// 检查键是否存在
const hasTheme = await store.has('theme');
console.log(hasTheme); // true
```

### 删除数据

```typescript
// 删除单个键
await store.delete('lastFile');

// 清空所有数据
await store.clear();
await store.save();
```

### 遍历数据

```typescript
// 获取所有键
const keys = await store.keys();
console.log(keys); // ['theme', 'language', 'userPreferences']

// 获取所有值
const values = await store.values();

// 获取所有键值对
const entries = await store.entries();
for (const [key, value] of entries) {
  console.log(`${key}: ${value}`);
}

// 获取数据条目数量
const length = await store.length();
console.log(`Store has ${length} items`);
```

---

## 实际应用场景

### 1. 替代 `useAppStore` 的 localStorage

**当前实现** (po-translator-gui/src/store/useAppStore.ts):
```typescript
// 旧方式：使用 localStorage（不安全、有大小限制）
const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // ... state
    }),
    {
      name: 'app-storage',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
```

**新方式：使用 Store Plugin**:
```typescript
import { Store } from '@tauri-apps/plugin-store';

// 创建 store
const appStore = new Store('app-settings.json');

// 初始化并加载
await appStore.load();

// 保存状态
await appStore.set('theme', theme);
await appStore.set('language', language);
await appStore.set('cumulativeStats', cumulativeStats);
await appStore.save();

// 读取状态
const savedTheme = await appStore.get<'light' | 'dark'>('theme') ?? 'light';
const savedLang = await appStore.get<string>('language') ?? 'zh';
```

### 2. AI 配置管理

```typescript
interface AIConfig {
  id: string;
  name: string;
  apiKey: string;
  baseUrl?: string;
  enabled: boolean;
}

const configStore = new Store('ai-config.json');

// 保存AI配置（自动加密敏感信息）
await configStore.set('aiConfigs', aiConfigs);
await configStore.set('activeProvider', 'moonshot');
await configStore.save();

// 读取AI配置
const configs = await configStore.get<AIConfig[]>('aiConfigs') ?? [];
const activeProvider = await configStore.get<string>('activeProvider');
```

### 3. 最近文件列表

```typescript
const fileStore = new Store('recent-files.json');

// 添加最近打开的文件
const addRecentFile = async (filePath: string) => {
  const recent = await fileStore.get<string[]>('recentFiles') ?? [];
  
  // 去重并限制数量
  const updated = [filePath, ...recent.filter(f => f !== filePath)].slice(0, 10);
  
  await fileStore.set('recentFiles', updated);
  await fileStore.save();
};

// 获取最近文件
const getRecentFiles = async () => {
  return await fileStore.get<string[]>('recentFiles') ?? [];
};
```

### 4. 翻译历史记录

```typescript
interface TranslationHistory {
  timestamp: number;
  source: string;
  target: string;
  provider: string;
}

const historyStore = new Store('translation-history.json');

// 保存翻译记录
await historyStore.set('history', [
  ...existingHistory,
  {
    timestamp: Date.now(),
    source: 'Hello',
    target: '你好',
    provider: 'moonshot'
  }
]);
await historyStore.save();
```

---

## 高级特性

### 1. 监听数据变化

```typescript
import { Store } from '@tauri-apps/plugin-store';
import { listen } from '@tauri-apps/api/event';

// 监听 store 的变化
await listen('store://change', (event) => {
  console.log('Store changed:', event.payload);
});
```

### 2. 多个 Store 实例

```typescript
// 为不同功能创建独立的 store
const settingsStore = new Store('settings.json');
const cacheStore = new Store('cache.json');
const historyStore = new Store('history.json');

// 分别管理，互不影响
await settingsStore.set('theme', 'dark');
await cacheStore.set('lastTranslation', '...');
await historyStore.set('recentFiles', [...]);
```

### 3. 自定义存储路径

```typescript
import { appDataDir } from '@tauri-apps/api/path';

// 获取应用数据目录
const dataDir = await appDataDir();
console.log(`Store location: ${dataDir}`);

// Store 文件会自动保存在：
// Windows: C:\Users\{username}\AppData\Roaming\com.potranslator.gui\
// macOS: ~/Library/Application Support/com.potranslator.gui/
// Linux: ~/.config/com.potranslator.gui/
```

---

## 迁移指南

### 从 localStorage 迁移到 Store Plugin

**步骤 1**: 读取现有的 localStorage 数据

```typescript
const oldTheme = localStorage.getItem('theme');
const oldLang = localStorage.getItem('language');
const oldStats = JSON.parse(localStorage.getItem('cumulativeStats') || '{}');
```

**步骤 2**: 写入到 Store Plugin

```typescript
import { Store } from '@tauri-apps/plugin-store';

const store = new Store('app-settings.json');
await store.load();

if (oldTheme) await store.set('theme', oldTheme);
if (oldLang) await store.set('language', oldLang);
if (oldStats) await store.set('cumulativeStats', oldStats);

await store.save();
```

**步骤 3**: 清理旧数据

```typescript
localStorage.removeItem('theme');
localStorage.removeItem('language');
localStorage.removeItem('cumulativeStats');
```

---

## 性能对比

| 特性 | localStorage | Store Plugin |
|------|--------------|--------------|
| 类型安全 | ❌ | ✅ |
| 大小限制 | ~10MB | 无限制 |
| 性能 | 中等 | 高 (原生) |
| 加密支持 | ❌ | ✅ |
| 跨窗口同步 | 有限 | 完整 |
| 数据持久化 | 自动 | 可控 |

---

## 最佳实践

### 1. 类型定义

```typescript
// 定义 Store 数据类型
interface AppStoreData {
  theme: 'light' | 'dark';
  language: string;
  cumulativeStats: {
    totalTranslated: number;
    totalTokens: number;
    totalCost: number;
  };
}

// 类型安全的读写
const store = new Store('app-settings.json');
const theme = await store.get<AppStoreData['theme']>('theme');
```

### 2. 错误处理

```typescript
try {
  await store.set('key', 'value');
  await store.save();
} catch (error) {
  console.error('保存数据失败:', error);
  // 回退到默认值或显示错误
}
```

### 3. 批量操作

```typescript
// 批量写入（减少 I/O）
await store.set('key1', 'value1');
await store.set('key2', 'value2');
await store.set('key3', 'value3');
// 最后一次性保存
await store.save();
```

### 4. 定期备份

```typescript
import { copyFile } from '@tauri-apps/plugin-fs';

// 备份 store 文件
const timestamp = Date.now();
await copyFile(
  'app-settings.json',
  `backups/app-settings-${timestamp}.json`
);
```

---

## 常见问题

### Q: Store 文件保存在哪里？
A: 保存在 Tauri 应用的数据目录，可通过 `appDataDir()` 获取路径。

### Q: 如何加密敏感数据？
A: Store Plugin 支持内置加密，在创建 Store 时设置 `encryption_key`。

### Q: 可以同时使用 localStorage 和 Store Plugin 吗？
A: 可以，但建议统一使用 Store Plugin 以获得更好的性能和安全性。

### Q: Store 数据会自动同步吗？
A: 需要手动调用 `save()` 进行持久化，或使用 `autoSave` 选项。

---

## 相关资源

- [Tauri Store Plugin 官方文档](https://v2.tauri.app/plugin/store/)
- [Tauri 2.x 迁移指南](https://v2.tauri.app/develop/)
- [项目优化计划](../TAURI_V2_OPTIMIZATION_PLAN.md)

---

**最后更新**: 2025-10-08  
**状态**: 已集成 ✅

