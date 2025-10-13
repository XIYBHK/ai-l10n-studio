# Tauri Updater Plugin 使用指南

## 概述

Tauri Updater Plugin 提供了应用自动更新功能，支持从 GitHub Releases、自建服务器等下载和安装更新。

**优势**:
- ✅ 自动检测更新
- ✅ 后台下载安装包
- ✅ 增量更新（仅下载差异部分）
- ✅ 签名验证（确保安全）
- ✅ 支持多平台

---

## 安装

### 1. 前端依赖

```bash
npm install @tauri-apps/plugin-updater
```

### 2. 后端集成

已完成（无需额外操作）：
- ✅ `Cargo.toml` - 添加依赖
- ✅ `main.rs` - 初始化插件
- ✅ `capabilities/updater.json` - 配置权限

---

## 配置更新服务器

### 方法 1: GitHub Releases（推荐）

在 `tauri.conf.json` 中配置：

```json
{
  "plugins": {
    "updater": {
      "active": true,
      "endpoints": [
        "https://github.com/{owner}/{repo}/releases/latest/download/latest.json"
      ],
      "dialog": true,
      "pubkey": "YOUR_PUBLIC_KEY_HERE"
    }
  }
}
```

### 方法 2: 自建服务器

```json
{
  "plugins": {
    "updater": {
      "active": true,
      "endpoints": [
        "https://your-server.com/updates/{{target}}/{{current_version}}"
      ],
      "dialog": false,
      "pubkey": "YOUR_PUBLIC_KEY_HERE"
    }
  }
}
```

---

## 生成更新签名

### 1. 生成密钥对

```bash
# 生成私钥和公钥
npm run tauri signer generate -- -w ~/.tauri/myapp.key

# 输出示例:
# Private key: ~/.tauri/myapp.key
# Public key: dW50cnVzdGVkIGNvbW1lbnQ...
```

### 2. 配置公钥

将公钥添加到 `tauri.conf.json`:

```json
{
  "plugins": {
    "updater": {
      "pubkey": "dW50cnVzdGVkIGNvbW1lbnQ..."
    }
  }
}
```

### 3. 签名更新包

```bash
# 构建应用
npm run tauri build

# 签名更新包（自动完成）
npm run tauri signer sign --private-key ~/.tauri/myapp.key
```

---

## 基础用法

### 检查更新

```typescript
import { check } from '@tauri-apps/plugin-updater';
import { ask } from '@tauri-apps/plugin-dialog';
import { relaunch } from '@tauri-apps/plugin-process';

async function checkForUpdates() {
  const update = await check();

  if (update) {
    console.log(
      `Update available: ${update.version}, ${update.date}, ${update.body}`
    );

    // 询问用户是否更新
    const yes = await ask(
      `Update to ${update.version} is available!\n\nRelease notes: ${update.body}`,
      {
        title: 'Update Available',
        type: 'info',
      }
    );

    if (yes) {
      // 下载并安装更新
      await update.downloadAndInstall();

      // 重启应用以应用更新
      await relaunch();
    }
  } else {
    console.log('No updates available');
  }
}
```

### 静默更新（后台自动）

```typescript
async function silentUpdate() {
  const update = await check();

  if (update) {
    console.log('Downloading update in background...');
    
    // 静默下载并安装
    await update.downloadAndInstall((event) => {
      switch (event.event) {
        case 'Started':
          console.log(`Started downloading ${event.data.contentLength} bytes`);
          break;
        case 'Progress':
          console.log(`Downloaded ${event.data.chunkLength} bytes`);
          break;
        case 'Finished':
          console.log('Download finished');
          break;
      }
    });

    // 下次启动时应用更新
    console.log('Update will be applied on next launch');
  }
}
```

---

## 实际应用场景

### 1. 启动时检查更新

```typescript
// src/App.tsx
import { useEffect } from 'react';
import { check } from '@tauri-apps/plugin-updater';
import { ask, message } from '@tauri-apps/plugin-dialog';
import { relaunch } from '@tauri-apps/plugin-process';

export function App() {
  useEffect(() => {
    // 启动 5 秒后检查更新（避免阻塞启动）
    const timer = setTimeout(async () => {
      try {
        const update = await check();
        
        if (update) {
          const yes = await ask(
            `发现新版本 ${update.version}！\n\n更新内容：\n${update.body}\n\n是否立即更新？`,
            { title: 'PO Translator 更新', type: 'info' }
          );

          if (yes) {
            await message('正在下载更新...', { title: 'PO Translator' });
            await update.downloadAndInstall();
            await relaunch();
          }
        }
      } catch (error) {
        console.error('检查更新失败:', error);
      }
    }, 5000);

    return () => clearTimeout(timer);
  }, []);

  return <div>{/* 应用内容 */}</div>;
}
```

### 2. 菜单栏检查更新

```typescript
// src/components/MenuBar.tsx
import { check } from '@tauri-apps/plugin-updater';
import { message, ask } from '@tauri-apps/plugin-dialog';
import { relaunch } from '@tauri-apps/plugin-process';

export function MenuBar() {
  const handleCheckUpdate = async () => {
    try {
      const update = await check();

      if (update) {
        const yes = await ask(
          `新版本 ${update.version} 可用！\n\n${update.body}\n\n是否更新？`,
          { title: '更新可用' }
        );

        if (yes) {
          await message('正在下载更新，请稍候...', { title: '下载中' });
          await update.downloadAndInstall();
          await relaunch();
        }
      } else {
        await message('当前已是最新版本！', { title: 'PO Translator' });
      }
    } catch (error) {
      await message(`检查更新失败: ${error}`, { title: '错误', type: 'error' });
    }
  };

  return (
    <Menu>
      <Menu.Item onClick={handleCheckUpdate}>检查更新</Menu.Item>
    </Menu>
  );
}
```

### 3. 带进度条的更新

```typescript
import { check } from '@tauri-apps/plugin-updater';
import { useState } from 'react';
import { Progress } from 'antd';

export function UpdateManager() {
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [totalBytes, setTotalBytes] = useState(0);
  const [downloadedBytes, setDownloadedBytes] = useState(0);

  const handleUpdate = async () => {
    const update = await check();

    if (!update) {
      message.info('当前已是最新版本');
      return;
    }

    setDownloading(true);
    
    await update.downloadAndInstall((event) => {
      switch (event.event) {
        case 'Started':
          setTotalBytes(event.data.contentLength);
          setDownloadedBytes(0);
          break;
        
        case 'Progress':
          setDownloadedBytes(prev => prev + event.data.chunkLength);
          const percent = (downloadedBytes / totalBytes) * 100;
          setProgress(percent);
          break;
        
        case 'Finished':
          setProgress(100);
          setDownloading(false);
          message.success('更新下载完成，重启应用以应用更新');
          break;
      }
    });

    await relaunch();
  };

  return (
    <div>
      {downloading && (
        <Progress
          percent={progress}
          status="active"
          format={() => `${(downloadedBytes / 1024 / 1024).toFixed(2)}MB / ${(totalBytes / 1024 / 1024).toFixed(2)}MB`}
        />
      )}
      <Button onClick={handleUpdate} loading={downloading}>
        检查更新
      </Button>
    </div>
  );
}
```

### 4. 定时检查更新（每天一次）

```typescript
import { useEffect } from 'react';
import { check } from '@tauri-apps/plugin-updater';
import { Store } from '@tauri-apps/plugin-store';

export function useAutoUpdate() {
  useEffect(() => {
    const checkDaily = async () => {
      const store = new Store('app-settings.json');
      await store.load();

      const lastCheck = await store.get<number>('lastUpdateCheck') ?? 0;
      const now = Date.now();
      const dayInMs = 24 * 60 * 60 * 1000;

      // 如果距离上次检查超过 24 小时
      if (now - lastCheck > dayInMs) {
        try {
          const update = await check();
          
          if (update) {
            // 通知用户有更新
            sendNotification({
              title: '更新可用',
              body: `新版本 ${update.version} 已发布！`,
            });
          }

          // 更新检查时间
          await store.set('lastUpdateCheck', now);
          await store.save();
        } catch (error) {
          console.error('定时检查更新失败:', error);
        }
      }
    };

    checkDaily();

    // 每小时检查一次是否需要更新检查
    const interval = setInterval(checkDaily, 60 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);
}
```

---

## 发布更新

### 1. 准备更新文件

构建应用后，Tauri 会生成以下文件：

```
src-tauri/target/release/bundle/
├── windows/
│   ├── PO-Translator_1.0.0_x64_en-US.msi
│   └── PO-Translator_1.0.0_x64_en-US.msi.sig
├── macos/
│   ├── PO Translator.app.tar.gz
│   └── PO Translator.app.tar.gz.sig
└── linux/
    ├── po-translator_1.0.0_amd64.AppImage
    └── po-translator_1.0.0_amd64.AppImage.sig
```

### 2. 创建 latest.json

在更新服务器上创建 `latest.json` 文件：

```json
{
  "version": "1.0.1",
  "notes": "- 新增批量翻译功能\n- 修复 API 连接问题\n- 性能优化",
  "pub_date": "2025-10-08T10:00:00Z",
  "platforms": {
    "windows-x86_64": {
      "signature": "dW50cnVzdGVkIGNvbW1lbnQ...",
      "url": "https://github.com/yourname/po-translator/releases/download/v1.0.1/PO-Translator_1.0.1_x64_en-US.msi.zip"
    },
    "darwin-x86_64": {
      "signature": "dW50cnVzdGVkIGNvbW1lbnQ...",
      "url": "https://github.com/yourname/po-translator/releases/download/v1.0.1/PO.Translator.app.tar.gz"
    },
    "darwin-aarch64": {
      "signature": "dW50cnVzdGVkIGNvbW1lbnQ...",
      "url": "https://github.com/yourname/po-translator/releases/download/v1.0.1/PO.Translator.app.tar.gz"
    },
    "linux-x86_64": {
      "signature": "dW50cnVzdGVkIGNvbW1lbnQ...",
      "url": "https://github.com/yourname/po-translator/releases/download/v1.0.1/po-translator_1.0.1_amd64.AppImage.tar.gz"
    }
  }
}
```

### 3. 上传到 GitHub Releases

```bash
# 创建 GitHub Release
gh release create v1.0.1 \
  --title "v1.0.1" \
  --notes "新功能和修复" \
  src-tauri/target/release/bundle/windows/*.msi \
  src-tauri/target/release/bundle/macos/*.tar.gz \
  src-tauri/target/release/bundle/linux/*.AppImage \
  latest.json
```

---

## 高级特性

### 1. 增量更新

Tauri 支持增量更新（仅下载差异部分）：

```json
{
  "plugins": {
    "updater": {
      "active": true,
      "endpoints": ["..."],
      "windows": {
        "installMode": "passive",
        "installerArgs": ["/S"]
      }
    }
  }
}
```

### 2. 更新通道（Beta/Stable）

```typescript
// 检查 Beta 版本
const betaUpdate = await check({
  endpoint: 'https://example.com/beta/latest.json'
});

// 检查 Stable 版本
const stableUpdate = await check({
  endpoint: 'https://example.com/stable/latest.json'
});
```

### 3. 自定义更新流程

```typescript
import { check, Update } from '@tauri-apps/plugin-updater';

async function customUpdateFlow() {
  const update = await check();
  
  if (!update) return;

  // 1. 显示更新日志
  showUpdateDialog(update.version, update.body);

  // 2. 下载更新（带进度）
  await update.download((progress) => {
    updateProgressBar(progress);
  });

  // 3. 安装更新
  await update.install();

  // 4. 提示用户重启
  const restart = await ask('更新已准备就绪，是否立即重启？');
  
  if (restart) {
    await relaunch();
  }
}
```

---

## 安全最佳实践

### 1. 始终验证签名

```json
{
  "plugins": {
    "updater": {
      "pubkey": "必须配置公钥"
    }
  }
}
```

### 2. 使用 HTTPS

```json
{
  "plugins": {
    "updater": {
      "endpoints": [
        "https://secure-server.com/updates"  // ✅ HTTPS
      ]
    }
  }
}
```

### 3. 验证版本号

```typescript
import { getVersion } from '@tauri-apps/api/app';

const currentVersion = await getVersion();
const update = await check();

if (update && isNewerVersion(update.version, currentVersion)) {
  // 执行更新
}

function isNewerVersion(newVer: string, oldVer: string): boolean {
  const newParts = newVer.split('.').map(Number);
  const oldParts = oldVer.split('.').map(Number);

  for (let i = 0; i < 3; i++) {
    if (newParts[i] > oldParts[i]) return true;
    if (newParts[i] < oldParts[i]) return false;
  }

  return false;
}
```

---

## 故障排除

### 问题 1: 更新检查失败

```typescript
try {
  const update = await check();
} catch (error) {
  console.error('更新检查失败:', error);
  // 检查：
  // - 网络连接
  // - 更新服务器状态
  // - tauri.conf.json 配置
}
```

### 问题 2: 签名验证失败

```
Error: Invalid signature
```

**解决方案**:
- 确保 `pubkey` 与签名密钥匹配
- 重新生成签名文件
- 检查更新包是否损坏

### 问题 3: 更新下载慢

```typescript
// 使用 CDN 加速
{
  "plugins": {
    "updater": {
      "endpoints": [
        "https://cdn.example.com/updates/{{target}}/{{current_version}}"
      ]
    }
  }
}
```

---

## 相关资源

- [Tauri Updater Plugin 官方文档](https://v2.tauri.app/plugin/updater/)
- [Tauri 签名指南](https://v2.tauri.app/develop/signing/)
- [GitHub Actions 自动发布](https://tauri.app/v1/guides/distribution/updater/#github-actions)

---

**最后更新**: 2025-10-08  
**状态**: 已集成 ✅

