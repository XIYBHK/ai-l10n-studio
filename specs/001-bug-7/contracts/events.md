# Event Contracts: BUG修复相关事件

**Feature**: 关键用户界面和功能问题修复  
**Date**: 2025-10-14  
**Protocol**: Tauri Event System

## 事件清单

修复过程中涉及的事件定义和触发时机。

---

## 1. 配置更新事件

### 1.1 config:updated

**触发时机**: 配置保存成功后自动触发

**发送方**: Rust Backend (`ConfigDraft::apply()`)

**Payload**:
```typescript
interface ConfigUpdatedPayload {
  config: AppConfig; // 完整的更新后配置
}
```

**前端处理**:
```typescript
// AppDataProvider 自动监听
useTauriEventBridgeEnhanced([
  CommonEventConfigs.configUpdated(500), // 节流500ms
]);

// 触发 SWR 缓存失效
mutate('app-config');
```

**用途**:
- AI配置添加/更新/删除后刷新界面
- 系统提示词修改后同步
- 日志配置变更后通知

---

### 1.2 ai-config:added

**触发时机**: 添加新AI配置后（可选，当前通过 `config:updated` 实现）

**Payload**:
```typescript
interface AIConfigAddedPayload {
  config: AIConfig; // 新添加的配置
}
```

**说明**: 当前实现中未单独触发，通过 `config:updated` 统一处理。

---

### 1.3 ai-config:activated

**触发时机**: 切换活动AI配置后

**Payload**:
```typescript
interface AIConfigActivatedPayload {
  configId: string; // 新激活的配置ID
}
```

**说明**: 当前通过 `config:updated` 实现。

---

## 2. 主题变更事件

### 2.1 theme:changed

**触发时机**: 用户切换主题或系统主题变化时

**发送方**: Frontend (`useAppStore`)

**Payload**:
```typescript
interface ThemeChangedPayload {
  theme: 'light' | 'dark'; // 实际生效的主题
  mode: 'light' | 'dark' | 'system'; // 用户选择的模式
}
```

**前端处理**:
```typescript
// Zustand store 自动持久化
useAppStore.getState().setTheme(newTheme);

// 应用主题到 DOM
document.documentElement.setAttribute('data-theme', theme);
```

**用途**:
- 通知所有组件更新主题相关样式
- 触发主题切换动画（如果有）

---

## 3. 语言切换事件

### 3.1 language:changed

**触发时机**: 用户切换界面语言后

**发送方**: Frontend (`i18n.changeLanguage()`)

**Payload**:
```typescript
interface LanguageChangedPayload {
  language: 'zh-CN' | 'en-US'; // 新语言代码
  previousLanguage: string; // 之前的语言
}
```

**前端处理**:
```typescript
// i18next 自动刷新所有 t() 调用
await i18n.changeLanguage(lng);

// 持久化到 Tauri Store
await useSettingsStore.getState().setLanguage(lng);

// 可选：发送自定义事件
eventDispatcher.emit('language:changed', { language: lng });
```

**用途**:
- 通知组件重新渲染界面文本
- 触发动态内容的重新加载

---

## 4. 系统事件（新增）

### 4.1 log-directory:opened

**触发时机**: 用户点击"打开日志目录"后成功打开文件管理器

**发送方**: Rust Backend (`open_log_directory` 成功后)

**Payload**:
```typescript
interface LogDirectoryOpenedPayload {
  path: string; // 日志目录路径
}
```

**前端处理**:
```typescript
eventDispatcher.on('log-directory:opened', (data) => {
  message.success(`已打开日志目录: ${data.path}`);
});
```

**用途**:
- 用户反馈
- 调试和日志记录

---

## 事件流图

### AI配置保存流程

```
用户点击"保存" (SettingsModal.tsx)
  ↓
aiConfigCommands.add(newConfig)
  ↓ IPC
Rust: add_ai_config(config)
  ↓
ConfigDraft::global().await
  ↓
{ let mut cfg = draft.draft(); cfg.ai_configs.push(config); }
  ↓
draft.apply()? 
  ↓ 保存到磁盘
  ↓ 发送事件
emit('config:updated', updated_config)
  ↓
useTauriEventBridgeEnhanced (节流500ms)
  ↓
eventDispatcher.emit('config:updated')
  ↓
AppDataProvider 监听
  ↓
mutate('app-config') → SWR 重新验证
  ↓
useAppData() 返回新配置
  ↓
SettingsModal 重新渲染（显示新配置）
```

---

### 主题切换流程

```
用户点击主题切换按钮 (ThemeModeSwitch.tsx)
  ↓
useAppStore.getState().setTheme(newTheme)
  ↓
Zustand middleware 自动持久化 → Tauri Store
  ↓
useEffect 监听 theme 变化
  ↓
document.documentElement.setAttribute('data-theme', theme)
  ↓
CSS 变量自动应用新主题
  ↓
界面立即刷新
```

---

### 跟随系统主题流程

```
用户选择"跟随系统" (SettingsModal.tsx)
  ↓
useAppStore.getState().setTheme('system')
  ↓
useTheme hook 监听 theme 变化
  ↓
const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
  ↓
mediaQuery.addEventListener('change', (e) => {
  const systemTheme = e.matches ? 'dark' : 'light';
  applyTheme(systemTheme);
})
  ↓
操作系统主题变化时
  ↓
自动应用新主题（无需用户操作）
```

---

### 语言切换流程

```
用户选择语言 (SettingsModal.tsx)
  ↓
await i18n.changeLanguage(lng)
  ↓
i18next 加载语言包 (locales/{lng}.json)
  ↓
所有 useTranslation() hooks 自动重新渲染
  ↓
await useSettingsStore.getState().setLanguage(lng)
  ↓
持久化到 Tauri Store
  ↓
message.success(t('settings.languageChanged'))
```

---

## 事件监听最佳实践

### 1. 使用增强事件桥接

```typescript
// ✅ 推荐：通过 AppDataProvider 自动启用
<AppDataProvider>
  <App />
</AppDataProvider>

// AppDataProvider 内部自动调用
useDefaultTauriEventBridge();
```

### 2. 节流和防抖

```typescript
// ✅ 推荐：配置节流避免高频更新
CommonEventConfigs.configUpdated(500); // 500ms节流
```

### 3. 组件卸载时清理

```typescript
// ✅ 增强事件桥接自动清理
// 无需手动 removeListener
```

### 4. 避免事件循环

```typescript
// ❌ 错误：在事件处理中再次触发相同事件
eventDispatcher.on('config:updated', async () => {
  await configCommands.update(config); // 导致无限循环
});

// ✅ 正确：使用条件判断或单独的更新逻辑
eventDispatcher.on('config:updated', (newConfig) => {
  // 仅更新 UI，不再触发保存
  setLocalConfig(newConfig);
});
```

---

## 事件调试

### 查看事件历史

```typescript
import { eventDispatcher } from '@/services/eventDispatcher';

// 获取最近100个事件
const history = eventDispatcher.getEventHistory();
console.table(history);
```

### 监听所有事件

```typescript
// 开发模式下监听所有事件
if (import.meta.env.DEV) {
  eventDispatcher.onAll((eventName, payload) => {
    console.log(`[Event] ${eventName}`, payload);
  });
}
```

---

## 事件命名约定

### 格式
```
{domain}:{action}
```

### 示例
- `config:updated` - 配置已更新
- `config:saved` - 配置已保存到磁盘
- `ai-config:added` - AI配置已添加
- `theme:changed` - 主题已变更
- `language:changed` - 语言已切换
- `log-directory:opened` - 日志目录已打开

### 动作类型
- `*:updated` - 数据已更新（通用）
- `*:added` - 新增条目
- `*:removed` - 删除条目
- `*:changed` - 状态变更
- `*:opened` - 打开操作
- `*:closed` - 关闭操作

---

## 向后兼容性

本次修复的事件系统与现有系统完全兼容：

- ✅ 不删除现有事件
- ✅ 不更改现有事件的 payload 结构
- ✅ 新增事件（如有）使用新的命名空间

---

## 测试覆盖

每个事件应有以下测试：

### 单元测试
- ✅ 事件触发时机正确
- ✅ Payload 结构正确
- ✅ 订阅者能正确接收

### 集成测试
- ✅ 完整的用户操作 → 事件触发 → UI更新流程
- ✅ 并发事件处理
- ✅ 事件节流/防抖效果

---

## 性能考虑

### 事件节流配置

| 事件类型 | 节流间隔 | 理由 |
|---------|---------|------|
| `config:updated` | 500ms | 配置更新通常由用户操作触发，不需要实时响应 |
| `theme:changed` | 100ms | 主题切换需要快速反馈 |
| `language:changed` | 无节流 | 语言切换是低频操作 |
| `log-directory:opened` | 无节流 | 低频操作 |

### 内存管理

- ✅ 使用 `WeakMap` 存储事件监听器（自动垃圾回收）
- ✅ 组件卸载时自动清理监听器
- ✅ 事件历史记录限制为最近100条

