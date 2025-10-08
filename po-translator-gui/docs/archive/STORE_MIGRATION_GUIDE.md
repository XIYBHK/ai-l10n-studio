# Store 架构迁移指南

## ✅ 迁移完成

应用已成功从单一 `useAppStore` 迁移到分离式 store 架构。

---

## 新的 Store 架构

### 三个独立的 Stores

```typescript
// 1. 会话状态（不持久化）
import { useSessionStore } from './store';

// 2. 用户设置（持久化）
import { useSettingsStore } from './store';

// 3. 累计统计（持久化）
import { useStatsStore } from './store';
```

---

## Store 职责划分

### 1. `useSessionStore` - 会话状态

**用途**: 仅在当前会话中有效的瞬态数据

**包含的状态**:
```typescript
{
  entries: POEntry[];           // 当前加载的条目
  currentEntry: POEntry | null; // 当前选中的条目
  currentIndex: number;         // 当前索引
  currentFilePath: string | null; // 当前文件路径
  isTranslating: boolean;       // 是否正在翻译
  progress: number;             // 翻译进度
  report: TranslationReport | null; // 翻译报告
}
```

**使用示例**:
```typescript
const { entries, setEntries, currentEntry, setCurrentEntry } = useSessionStore();
```

---

### 2. `useSettingsStore` - 用户设置

**用途**: 需要跨会话保留的用户偏好设置

**包含的状态**:
```typescript
{
  theme: 'light' | 'dark';     // 主题模式
  language: 'zh-CN' | 'en-US'; // 界面语言
}
```

**使用示例**:
```typescript
const { theme, toggleTheme, language, setLanguage } = useSettingsStore();
```

**持久化**: 使用 `localStorage` (key: `po-translator-settings`)

---

### 3. `useStatsStore` - 累计统计

**用途**: 跨会话累计的翻译统计数据

**包含的状态**:
```typescript
{
  cumulativeStats: {
    total: number;
    tm_hits: number;
    deduplicated: number;
    ai_translated: number;
    tm_learned: number;
    token_stats: {
      input_tokens: number;
      output_tokens: number;
      total_tokens: number;
      cost: number;
    };
  }
}
```

**使用示例**:
```typescript
const { cumulativeStats, updateCumulativeStats, resetCumulativeStats } = useStatsStore();
```

**持久化**: 使用 `localStorage` (key: `po-translator-cumulative-stats`)

---

## 迁移步骤

### App.tsx 已完成的迁移

#### ❌ 旧代码（已废弃）
```typescript
import { useAppStore } from './store/useAppStore';

const {
  entries,
  currentEntry,
  // ... 所有状态混在一起
  setConfig,
  cumulativeStats,
} = useAppStore();
```

#### ✅ 新代码（已实施）
```typescript
import { useSessionStore } from './store';

const {
  entries,
  currentEntry,
  currentIndex,
  // ... 只包含会话状态
  setEntries,
  setCurrentEntry,
  updateEntry,
  setTranslating,
  setProgress,
} = useSessionStore();

// 如果需要其他状态，按需引入：
// const { theme, language } = useSettingsStore();
// const { cumulativeStats } = useStatsStore();
```

---

## 架构优势

### 1. **清晰的关注点分离**
- 瞬态数据（会话）vs 持久化数据（设置/统计）分离
- 每个 store 有明确的职责范围

### 2. **减少不必要的持久化**
- 会话状态不会写入 localStorage
- 减少 I/O 操作，提升性能

### 3. **更容易维护和测试**
- 模块化设计，每个 store 独立
- 可以单独测试每个 store 的逻辑

### 4. **向后兼容**
- 旧的 `useAppStore` 保留（标记为 deprecated）
- 可以逐步迁移其他组件

---

## 下一步计划

### 可选的进一步优化

1. **迁移其他组件**:
   - `MenuBar.tsx`
   - `EntryList.tsx`
   - `EditorPane.tsx`
   - 其他使用 `useAppStore` 的组件

2. **添加统计功能**:
   ```typescript
   // 在翻译完成时更新累计统计
   const { updateCumulativeStats } = useStatsStore();
   
   useEffect(() => {
     if (translationStats) {
       updateCumulativeStats(translationStats);
     }
   }, [translationStats]);
   ```

3. **完全移除旧 Store**:
   - 所有组件迁移完成后
   - 删除 `useAppStore.ts`
   - 清理 localStorage 中的旧数据

---

## 注意事项

⚠️ **不要混用旧新 Store**:
- 同一组件内应统一使用新的分离式 store
- 避免 `useAppStore` 和新 stores 同时使用

✅ **推荐模式**:
```typescript
// ✅ 好的做法
const { entries } = useSessionStore();
const { theme } = useSettingsStore();

// ❌ 避免
const { entries } = useAppStore();
const { theme } = useSettingsStore();
```

---

## 总结

新的 store 架构已成功实施，提供了更好的代码组织和性能。所有核心功能保持不变，同时为未来的扩展奠定了坚实的基础。

