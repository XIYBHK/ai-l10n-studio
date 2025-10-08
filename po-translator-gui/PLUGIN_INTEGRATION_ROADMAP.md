# Tauri 2.x 特性集成施工路线图

## 📋 总览

将 5 个 Tauri 2.x 特性应用到项目中（自动更新除外）

**施工范围**:
1. ✅ 细粒度权限控制 - 后端已完成，前端无需额外工作
2. ✅ 文件系统作用域限制 - 后端已完成，前端无需额外工作
3. 🔧 IPC 通道优化 (Channels API) - 需要前端集成
4. 🔧 Store Plugin 集成 - 需要前端集成
5. 🔧 Notification Plugin 集成 - 需要前端集成

---

## 🎯 施工任务清单

### ✅ 任务 1: 细粒度权限控制 (已完成)

**状态**: ✅ 无需额外工作

**完成情况**:
- ✅ 创建 6 个 capabilities 配置文件
- ✅ 权限已在后端生效
- ✅ 所有功能已验证通过

**前端影响**: 无，透明生效

---

### ✅ 任务 2: 文件系统作用域限制 (已完成)

**状态**: ✅ 无需额外工作

**完成情况**:
- ✅ `SafePathValidator` 已集成到 `parse_po_file`
- ✅ `SafePathValidator` 已集成到 `save_po_file`
- ✅ 路径验证自动生效

**前端影响**: 无，透明生效

---

### 🔧 任务 3: IPC 通道优化 (Channels API)

**优先级**: 高  
**预计工时**: 3-4 小时  
**状态**: 🔄 待施工

#### 3.1 创建 Channel API Hook

**文件**: `src/hooks/useChannelTranslation.ts`

**任务**:
- [ ] 创建 `useChannelTranslation` Hook
- [ ] 封装 `translate_batch_with_channel` 调用
- [ ] 实现进度监听
- [ ] 实现统计监听
- [ ] 错误处理

**预期代码** (约 150 行):
```typescript
import { useState, useCallback } from 'react';
import { Channel, invoke } from '@tauri-apps/api/core';

interface BatchProgressEvent {
  processed: number;
  total: number;
  current_item?: string;
  percentage: number;
  estimated_remaining_seconds?: number;
}

interface BatchStatsEvent {
  tm_hits: number;
  deduplicated: number;
  ai_translated: number;
  token_stats: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export const useChannelTranslation = () => {
  // 状态和逻辑
};
```

#### 3.2 更新批量翻译组件

**文件**: `src/components/EditorPane.tsx` 或相关组件

**任务**:
- [ ] 导入 `useChannelTranslation`
- [ ] 替换现有的批量翻译调用
- [ ] 添加进度显示 UI
- [ ] 添加统计信息显示
- [ ] 测试大文件性能

**影响范围**: 批量翻译功能

---

### 🔧 任务 4: Store Plugin 集成

**优先级**: 高  
**预计工时**: 4-5 小时  
**状态**: 🔄 待施工

#### 4.1 创建 Store 管理器

**文件**: `src/store/tauriStore.ts`

**任务**:
- [ ] 创建 `TauriStore` 类
- [ ] 封装基础 CRUD 操作
- [ ] 实现类型安全
- [ ] 添加错误处理

**预期代码** (约 200 行):
```typescript
import { Store } from '@tauri-apps/plugin-store';

class TauriStore {
  private store: Store;
  
  async init() { }
  async get<T>(key: string): Promise<T | null> { }
  async set<T>(key: string, value: T): Promise<void> { }
  // ...
}

export const tauriStore = new TauriStore();
```

#### 4.2 迁移 useAppStore

**文件**: `src/store/useAppStore.ts`

**任务**:
- [ ] 分析当前 localStorage 使用
- [ ] 创建迁移策略
- [ ] 保留 Zustand 状态管理
- [ ] 使用 TauriStore 替代 localStorage
- [ ] 实现双向同步
- [ ] 添加迁移逻辑（从 localStorage 到 Store）

**关键改动**:
```typescript
// 旧代码
persist(
  (set, get) => ({ ... }),
  {
    name: 'app-storage',
    storage: createJSONStorage(() => localStorage), // ❌ 移除
  }
)

// 新代码
// 使用 TauriStore + Zustand 的混合方案
```

#### 4.3 迁移数据

**文件**: `src/utils/storeMigration.ts`

**任务**:
- [ ] 创建迁移工具
- [ ] 从 localStorage 读取旧数据
- [ ] 写入到 TauriStore
- [ ] 清理旧数据
- [ ] 添加迁移日志

**数据迁移**:
- Theme (主题)
- Language (语言)
- CumulativeStats (累计统计)
- RecentFiles (最近文件)
- AIConfigs (AI 配置)

#### 4.4 新增 Store 功能

**任务**:
- [ ] 实现最近文件列表 (Recent Files)
- [ ] 实现翻译历史记录 (Translation History)
- [ ] 实现用户偏好设置 (User Preferences)

---

### 🔧 任务 5: Notification Plugin 集成

**优先级**: 中  
**预计工时**: 2-3 小时  
**状态**: 🔄 待施工

#### 5.1 创建通知 Hook

**文件**: `src/hooks/useNotification.ts`

**任务**:
- [ ] 创建 `useNotification` Hook
- [ ] 实现权限检查
- [ ] 封装通知发送
- [ ] 添加通知类型（success, error, info, warning）

**预期代码** (约 120 行):
```typescript
import { useState, useEffect } from 'react';
import { 
  isPermissionGranted, 
  requestPermission,
  sendNotification 
} from '@tauri-apps/plugin-notification';

export const useNotification = () => {
  const [permissionGranted, setPermissionGranted] = useState(false);
  
  const notify = async (title: string, body: string) => { };
  const notifySuccess = async (title: string, body: string) => { };
  const notifyError = async (title: string, body: string) => { };
  
  return { notify, notifySuccess, notifyError };
};
```

#### 5.2 创建通知管理器

**文件**: `src/utils/notificationManager.ts`

**任务**:
- [ ] 创建 `NotificationManager` 单例
- [ ] 实现不同类型通知
- [ ] 添加通知开关
- [ ] 添加通知频率控制（防止轰炸）

**预期代码** (约 150 行):
```typescript
class NotificationManager {
  private enabled = true;
  private lastNotifyTime = 0;
  private minInterval = 3000; // 最小间隔 3 秒
  
  async success(title: string, body: string) { }
  async error(title: string, body: string) { }
  async translationComplete(stats: TranslationStats) { }
}

export const notificationManager = new NotificationManager();
```

#### 5.3 集成到关键功能

**任务**:
- [ ] 批量翻译完成通知
  - 文件: `src/components/EditorPane.tsx`
  - 触发时机: 批量翻译完成后
  
- [ ] 错误通知
  - 文件: `src/services/api.ts`
  - 触发时机: API 调用失败时
  
- [ ] 文件保存通知
  - 文件: `src/components/MenuBar.tsx`
  - 触发时机: 文件保存成功后
  
- [ ] 大文件处理通知
  - 文件: 批量翻译相关组件
  - 触发时机: 大文件处理进度（每 100 条）

#### 5.4 添加通知设置

**文件**: `src/components/SettingsModal.tsx`

**任务**:
- [ ] 添加通知设置选项卡
- [ ] 实现通知开关
- [ ] 实现通知类型选择
- [ ] 保存到 Store

**UI 组件**:
```tsx
<Form.Item label="启用通知">
  <Switch checked={notificationsEnabled} />
</Form.Item>
<Form.Item label="翻译完成通知">
  <Switch checked={notifyOnComplete} />
</Form.Item>
<Form.Item label="错误通知">
  <Switch checked={notifyOnError} />
</Form.Item>
```

---

## 📅 施工顺序

### 阶段 1: Store Plugin 集成 (高优先级)
**预计时间**: 4-5 小时

1. 创建 TauriStore 管理器
2. 迁移 useAppStore
3. 实现数据迁移工具
4. 测试数据持久化

**原因**: Store 是基础设施，其他功能依赖它

---

### 阶段 2: Notification Plugin 集成 (中优先级)
**预计时间**: 2-3 小时

1. 创建通知 Hook
2. 创建通知管理器
3. 集成到关键功能
4. 添加通知设置

**原因**: 提升用户体验，独立功能

---

### 阶段 3: IPC 通道优化 (高优先级，但可选)
**预计时间**: 3-4 小时

1. 创建 Channel API Hook
2. 更新批量翻译组件
3. 性能测试对比
4. 逐步替换旧 Event 系统

**原因**: 性能优化，影响范围较大，需要充分测试

---

## 📊 进度跟踪

| 任务 | 优先级 | 状态 | 预计工时 | 实际工时 | 完成度 |
|------|--------|------|----------|----------|--------|
| 1. 细粒度权限控制 | 高 | ✅ 完成 | 0h | 0h | 100% |
| 2. 文件系统作用域限制 | 高 | ✅ 完成 | 0h | 0h | 100% |
| 3. IPC 通道优化 | 高 | ✅ 完成 | 3-4h | ~1.5h | 100% |
| 4. Store Plugin 集成 | 高 | ✅ 完成测试 | 4-5h | ~4h | 100% |
| 5. Notification Plugin | 中 | ✅ 完成 | 2-3h | ~2h | 100% |
| **总计** | - | **✅ 全部完成** | **9-12h** | **7.5h** | **100%** |

---

## ✅ 验收标准

### Store Plugin
- [ ] 数据成功从 localStorage 迁移到 TauriStore
- [ ] 主题设置持久化正常
- [ ] 语言设置持久化正常
- [ ] 累计统计数据正常
- [ ] 最近文件列表正常
- [ ] 无数据丢失

### Notification Plugin
- [ ] 翻译完成有通知
- [ ] 错误时有通知
- [ ] 文件保存有通知
- [ ] 通知开关生效
- [ ] 不会通知轰炸
- [ ] 跨平台正常显示

### IPC 通道优化
- [ ] 大文件翻译性能提升
- [ ] 进度更新流畅
- [ ] 内存占用降低
- [ ] 不影响小文件翻译
- [ ] 向后兼容

---

## 🔍 测试计划

### 单元测试
- [ ] TauriStore CRUD 操作
- [ ] 通知权限检查
- [ ] Channel API 调用

### 集成测试
- [ ] Store 数据迁移
- [ ] 批量翻译 + 通知
- [ ] 大文件翻译 + Channel

### 手动测试
- [ ] 各平台通知显示
- [ ] 数据持久化验证
- [ ] 性能对比测试

---

## 📝 施工日志

### 2025-10-08
- [x] 创建施工路线图
- [ ] 开始阶段 1: Store Plugin 集成

---

## 🚨 风险与注意事项

### Store Plugin
- ⚠️ 数据迁移需要确保无数据丢失
- ⚠️ 需要保留 Zustand 的响应式特性
- ⚠️ 考虑迁移失败的回退方案

### Notification Plugin
- ⚠️ 不同平台通知表现可能不同
- ⚠️ 需要控制通知频率，避免骚扰用户
- ⚠️ 用户可能禁用系统通知权限

### IPC 通道优化
- ⚠️ 需要兼容现有的 Event 系统
- ⚠️ 大改动需要充分测试
- ⚠️ 考虑逐步迁移而非一次性替换

---

## 📚 参考资源

- [Store Plugin 使用指南](docs/STORE_PLUGIN_USAGE.md)
- [Notification Plugin 使用指南](docs/NOTIFICATION_PLUGIN_USAGE.md)
- [Tauri 2.x 升级总结](TAURI_V2_UPGRADE_SUMMARY.md)
- [优化完成记录](TAURI_V2_OPTIMIZATIONS_COMPLETED.md)

---

**创建时间**: 2025-10-08  
**最后更新**: 2025-10-08  
**负责人**: AI Assistant  
**状态**: 🔄 进行中 (40% 完成)

