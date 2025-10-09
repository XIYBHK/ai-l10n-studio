# Tauri Notification Plugin 使用指南

## 概述

Tauri Notification Plugin 提供了原生的系统通知功能，可以在翻译任务完成、错误发生等场景下提醒用户。

**优势**:
- ✅ 原生系统通知
- ✅ 跨平台支持 (Windows/macOS/Linux)
- ✅ 支持图标、声音、操作按钮
- ✅ 低功耗、高性能

---

## 安装

### 1. 前端依赖

```bash
npm install @tauri-apps/plugin-notification
```

### 2. 后端集成

已完成（无需额外操作）：
- ✅ `Cargo.toml` - 添加依赖
- ✅ `main.rs` - 初始化插件
- ✅ `capabilities/notification.json` - 配置权限

---

## 基础用法

### 请求通知权限

```typescript
import { 
  isPermissionGranted, 
  requestPermission 
} from '@tauri-apps/plugin-notification';

// 检查权限
let permissionGranted = await isPermissionGranted();

// 如果未授权，请求权限
if (!permissionGranted) {
  const permission = await requestPermission();
  permissionGranted = permission === 'granted';
}
```

### 发送简单通知

```typescript
import { sendNotification } from '@tauri-apps/plugin-notification';

// 最简单的通知
sendNotification('翻译完成！');

// 带标题的通知
sendNotification({
  title: 'PO Translator',
  body: '翻译已完成，共处理 100 个条目'
});
```

### 发送详细通知

```typescript
import { sendNotification } from '@tauri-apps/plugin-notification';

// 详细配置
sendNotification({
  title: '批量翻译完成',
  body: `成功翻译 ${count} 个条目\nToken 消耗: ${tokens}\n预计费用: ¥${cost}`,
  icon: 'icons/icon.png',  // 通知图标
  sound: 'default',         // 系统声音
});
```

---

## 实际应用场景

### 1. 翻译完成通知

```typescript
// 在批量翻译完成后通知
const onTranslationComplete = async (stats: TranslationStats) => {
  await sendNotification({
    title: '✅ 翻译完成',
    body: `共处理 ${stats.total} 个条目\n` +
          `AI 翻译: ${stats.ai_translated}\n` +
          `TM 命中: ${stats.tm_hits}\n` +
          `Token 消耗: ${stats.token_stats.total_tokens}`,
    icon: 'icons/success.png'
  });
};
```

### 2. 错误通知

```typescript
// 翻译错误时通知
const onTranslationError = async (error: string) => {
  await sendNotification({
    title: '❌ 翻译失败',
    body: `错误信息: ${error}\n请检查网络连接和 API 配置`,
    icon: 'icons/error.png',
    sound: 'default'
  });
};
```

### 3. 进度通知（大文件）

```typescript
// 大文件翻译进度通知
const onLargeFileProgress = async (processed: number, total: number) => {
  // 每处理 100 个条目通知一次
  if (processed % 100 === 0) {
    const percentage = ((processed / total) * 100).toFixed(1);
    await sendNotification({
      title: `翻译进行中 (${percentage}%)`,
      body: `已处理 ${processed}/${total} 个条目`,
      icon: 'icons/progress.png'
    });
  }
};
```

### 4. TM 学习通知

```typescript
// 翻译记忆库学习新条目时通知
const onTMLearned = async (learned: number) => {
  if (learned > 0) {
    await sendNotification({
      title: '📚 翻译记忆库更新',
      body: `学习了 ${learned} 个新翻译`,
      icon: 'icons/tm.png'
    });
  }
};
```

### 5. 文件保存通知

```typescript
// 文件保存成功时通知
const onFileSaved = async (filePath: string) => {
  await sendNotification({
    title: '💾 文件已保存',
    body: `文件已保存至:\n${filePath}`,
    icon: 'icons/save.png'
  });
};
```

---

## 高级特性

### 1. 带操作按钮的通知（部分平台支持）

```typescript
import { sendNotification, onAction } from '@tauri-apps/plugin-notification';

// 发送带操作的通知
await sendNotification({
  title: '翻译完成',
  body: '是否打开翻译后的文件？',
  actions: [
    { id: 'open', title: '打开' },
    { id: 'dismiss', title: '忽略' }
  ]
});

// 监听操作
const unlisten = await onAction((action) => {
  if (action.actionId === 'open') {
    // 打开文件
    openTranslatedFile();
  }
});
```

### 2. 静默通知（无声音）

```typescript
await sendNotification({
  title: '自动保存',
  body: '文件已自动保存',
  silent: true  // 静默通知，不播放声音
});
```

### 3. 持久通知（需要用户手动关闭）

```typescript
await sendNotification({
  title: '重要提示',
  body: 'API 配额即将用尽，请及时充值',
  requireInteraction: true  // macOS/Linux 支持
});
```

### 4. 通知组（同类通知分组）

```typescript
// Windows 支持通知组
await sendNotification({
  title: '翻译进度',
  body: `文件 1/5 已完成`,
  tag: 'translation-progress'  // 同 tag 的通知会合并
});

await sendNotification({
  title: '翻译进度',
  body: `文件 2/5 已完成`,
  tag: 'translation-progress'  // 替换上一条通知
});
```

---

## React Hook 封装

### 创建 useNotification Hook

```typescript
// src/hooks/useNotification.ts
import { useState, useEffect } from 'react';
import { 
  isPermissionGranted, 
  requestPermission,
  sendNotification as tauriNotify
} from '@tauri-apps/plugin-notification';

export const useNotification = () => {
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkPermission();
  }, []);

  const checkPermission = async () => {
    try {
      const granted = await isPermissionGranted();
      setPermissionGranted(granted);
    } catch (error) {
      console.error('检查通知权限失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const requestNotificationPermission = async () => {
    try {
      const permission = await requestPermission();
      const granted = permission === 'granted';
      setPermissionGranted(granted);
      return granted;
    } catch (error) {
      console.error('请求通知权限失败:', error);
      return false;
    }
  };

  const notify = async (
    title: string, 
    body: string, 
    options?: { icon?: string; sound?: string }
  ) => {
    if (!permissionGranted) {
      console.warn('通知权限未授予');
      return;
    }

    try {
      await tauriNotify({
        title,
        body,
        icon: options?.icon ?? 'icons/icon.png',
        sound: options?.sound,
      });
    } catch (error) {
      console.error('发送通知失败:', error);
    }
  };

  return {
    permissionGranted,
    loading,
    requestPermission: requestNotificationPermission,
    notify,
  };
};
```

### 使用 Hook

```typescript
// 在组件中使用
import { useNotification } from '@/hooks/useNotification';

const TranslatorComponent = () => {
  const { permissionGranted, requestPermission, notify } = useNotification();

  useEffect(() => {
    if (!permissionGranted) {
      requestPermission();
    }
  }, [permissionGranted, requestPermission]);

  const handleTranslate = async () => {
    try {
      // 执行翻译...
      
      // 完成后通知
      await notify(
        '翻译完成',
        `成功翻译 ${count} 个条目`
      );
    } catch (error) {
      await notify(
        '翻译失败',
        error.message,
        { icon: 'icons/error.png' }
      );
    }
  };

  return (
    <div>
      {/* UI 组件 */}
    </div>
  );
};
```

---

## 通知工具类

### 创建通知管理器

```typescript
// src/utils/notificationManager.ts
import { sendNotification } from '@tauri-apps/plugin-notification';

class NotificationManager {
  private enabled = true;

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }

  async success(title: string, body: string) {
    if (!this.enabled) return;
    
    await sendNotification({
      title: `✅ ${title}`,
      body,
      icon: 'icons/success.png',
    });
  }

  async error(title: string, body: string) {
    if (!this.enabled) return;
    
    await sendNotification({
      title: `❌ ${title}`,
      body,
      icon: 'icons/error.png',
      sound: 'default',
    });
  }

  async info(title: string, body: string) {
    if (!this.enabled) return;
    
    await sendNotification({
      title: `ℹ️ ${title}`,
      body,
      icon: 'icons/info.png',
    });
  }

  async warning(title: string, body: string) {
    if (!this.enabled) return;
    
    await sendNotification({
      title: `⚠️ ${title}`,
      body,
      icon: 'icons/warning.png',
      sound: 'default',
    });
  }

  async translationComplete(stats: TranslationStats) {
    if (!this.enabled) return;
    
    await this.success(
      '翻译完成',
      `共处理 ${stats.total} 个条目\n` +
      `AI 翻译: ${stats.ai_translated}\n` +
      `TM 命中: ${stats.tm_hits}`
    );
  }
}

export const notificationManager = new NotificationManager();
```

### 使用工具类

```typescript
import { notificationManager } from '@/utils/notificationManager';

// 翻译完成
await notificationManager.translationComplete(stats);

// 错误通知
await notificationManager.error('API 错误', error.message);

// 信息通知
await notificationManager.info('提示', '文件已自动保存');

// 禁用/启用通知
notificationManager.setEnabled(false);
```

---

## 最佳实践

### 1. 避免通知轰炸

```typescript
// ❌ 不好：每处理一个条目就通知
entries.forEach(async (entry) => {
  await translate(entry);
  await sendNotification('翻译完成', entry.msgid); // 太频繁！
});

// ✅ 好：批量处理后统一通知
const results = await translateBatch(entries);
await sendNotification('批量翻译完成', `共处理 ${results.length} 个条目`);
```

### 2. 仅在重要事件通知

```typescript
// ✅ 重要事件
- 批量翻译完成
- 严重错误
- API 配额警告
- 大文件处理完成

// ❌ 不需要通知
- 单个条目翻译
- 常规操作
- 轻微警告
- 自动保存
```

### 3. 根据用户偏好控制

```typescript
interface NotificationSettings {
  enabled: boolean;
  onComplete: boolean;
  onError: boolean;
  onProgress: boolean;
}

// 保存在 Store Plugin 中
const settings = await store.get<NotificationSettings>('notificationSettings');

if (settings.onComplete) {
  await notify('翻译完成', ...);
}
```

---

## 跨平台差异

| 特性 | Windows | macOS | Linux |
|------|---------|-------|-------|
| 基础通知 | ✅ | ✅ | ✅ |
| 通知图标 | ✅ | ✅ | ✅ |
| 通知声音 | ✅ | ✅ | ⚠️ 部分 |
| 操作按钮 | ⚠️ 有限 | ✅ | ⚠️ 部分 |
| 通知组 | ✅ | ✅ | ⚠️ 部分 |
| 持久通知 | ❌ | ✅ | ⚠️ 部分 |

---

## 相关资源

- [Tauri Notification Plugin 官方文档](https://v2.tauri.app/plugin/notification/)
- [Notification API 规范](https://notifications.spec.whatwg.org/)
- [项目优化计划](../TAURI_V2_OPTIMIZATION_PLAN.md)

---

**最后更新**: 2025-10-08  
**状态**: 已集成 ✅

