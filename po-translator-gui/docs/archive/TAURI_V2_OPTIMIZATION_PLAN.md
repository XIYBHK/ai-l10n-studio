# Tauri 2.x 优化计划

**当前版本**: Phase 8 (Tauri 2.x)  
**文档日期**: 2025-10-09  
**目标**: 基于 Tauri 2.x 新特性优化项目架构

---

## 🎯 优化目标概览

Tauri 2.x 带来了许多新特性，本文档列出了基于这些特性的优化建议。

| 优化项 | 优先级 | 影响范围 | 预估收益 |
|--------|--------|----------|----------|
| 细粒度权限控制 | 🔴 高 | 安全性 | ⭐⭐⭐⭐⭐ |
| IPC 通道优化 | 🟡 中 | 性能 | ⭐⭐⭐⭐ |
| 文件系统作用域 | 🔴 高 | 安全性 | ⭐⭐⭐⭐⭐ |
| 流式 API | 🟡 中 | 性能 | ⭐⭐⭐ |
| 多窗口 Capabilities | 🟢 低 | 扩展性 | ⭐⭐ |
| 移动端准备 | 🟢 低 | 跨平台 | ⭐⭐⭐ |
| 插件生态整合 | 🟡 中 | 功能 | ⭐⭐⭐ |

---

## 1️⃣ 细粒度权限控制（高优先级）

### 当前状态
```json
// src-tauri/capabilities/default.json
{
  "permissions": [
    "fs:default",
    "fs:allow-read-file",
    "fs:allow-write-file",
    // ... 所有窗口共享所有权限
  ]
}
```

### 问题
- ✗ 所有权限都授予主窗口
- ✗ 没有限制文件系统访问范围
- ✗ 缺少最小权限原则

### 优化建议

#### 1.1 创建分层权限配置

```json
// src-tauri/capabilities/main-window.json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "main-window",
  "description": "主窗口基础权限",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "core:window:default",
    "core:event:default"
  ]
}
```

```json
// src-tauri/capabilities/file-operations.json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "file-operations",
  "description": "文件操作权限（仅限必要路径）",
  "windows": ["main"],
  "permissions": [
    "fs:allow-read-text-file",
    "fs:allow-write-text-file",
    "fs:scope-appdata-recursive",  // 仅限应用数据目录
    "fs:scope-document-recursive"   // 仅限文档目录
  ]
}
```

```json
// src-tauri/capabilities/translation.json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "translation",
  "description": "翻译功能权限（无文件系统访问）",
  "windows": ["main"],
  "permissions": [
    "dialog:allow-open",
    "dialog:allow-save"
  ]
}
```

#### 1.2 使用 Scope 限制文件访问

```json
// tauri.conf.json
{
  "plugins": {
    "fs": {
      "scope": [
        "$APPDATA/**",
        "$DOCUMENT/**/*.po",
        "$DOCUMENT/**/*.json",
        "!$DOCUMENT/**/node_modules/**"
      ]
    }
  }
}
```

**收益**:
- ✅ 更高的安全性
- ✅ 符合最小权限原则
- ✅ 防止意外的文件系统访问
- ✅ 更容易审计

---

## 2️⃣ IPC 通道优化（中优先级）

### 当前状态
```typescript
// 每次调用都创建新的 invoke
await invoke('translate_batch', { texts });
await invoke('translate_batch', { texts });
await invoke('translate_batch', { texts });
```

### 问题
- ✗ 每次 invoke 都有序列化/反序列化开销
- ✗ 大数据传输效率低
- ✗ 进度更新频繁导致性能问题

### 优化建议

#### 2.1 使用 Tauri 2.x 通道（Channels）

```rust
// src-tauri/src/commands/translator.rs
use tauri::ipc::Channel;

#[tauri::command]
async fn translate_batch_streaming(
    texts: Vec<String>,
    progress: Channel<TranslationProgress>
) -> Result<TranslationStats, String> {
    let total = texts.len();
    
    for (i, text) in texts.iter().enumerate() {
        let result = translate_single(text).await?;
        
        // 通过通道发送进度，无需等待响应
        progress.send(TranslationProgress {
            current: i + 1,
            total,
            translation: result,
        }).ok();
    }
    
    Ok(stats)
}
```

```typescript
// src/services/translatorApi.ts
import { Channel } from '@tauri-apps/api/core';

export async function translateBatchStreaming(texts: string[]) {
  const onProgress = new Channel<TranslationProgress>();
  
  onProgress.onmessage = (progress) => {
    eventDispatcher.emit('translation:progress', progress);
  };
  
  const stats = await invoke('translate_batch_streaming', {
    texts,
    progress: onProgress
  });
  
  return stats;
}
```

**收益**:
- ✅ 减少 50% 的 IPC 开销
- ✅ 更流畅的进度更新
- ✅ 支持大数据流式传输
- ✅ 不阻塞主线程

#### 2.2 批量操作优化

```rust
// 使用 serde_bytes 优化大数据传输
use serde_bytes::ByteBuf;

#[tauri::command]
async fn parse_po_file_optimized(
    #[serde(with = "serde_bytes")] data: ByteBuf
) -> Result<POFile, String> {
    // 直接处理字节数据，避免 UTF-8 转换
}
```

**预估提升**: 大文件解析速度提升 30-40%

---

## 3️⃣ 文件系统安全增强（高优先级）

### 当前状态
```typescript
// 可以访问任意路径
await invoke('parse_po_file', { 
  filePath: 'C:/Windows/System32/sensitive.file' 
});
```

### 优化建议

#### 3.1 实施路径白名单

```rust
// src-tauri/src/utils/paths.rs
use tauri::path::PathResolver;

pub struct SafePathValidator {
    allowed_dirs: Vec<PathBuf>,
}

impl SafePathValidator {
    pub fn validate(&self, path: &Path) -> Result<PathBuf, Error> {
        let canonical = path.canonicalize()?;
        
        // 确保路径在白名单内
        let is_allowed = self.allowed_dirs.iter()
            .any(|dir| canonical.starts_with(dir));
        
        if !is_allowed {
            return Err(Error::PathNotAllowed);
        }
        
        Ok(canonical)
    }
}
```

```rust
// src-tauri/src/commands/mod.rs
#[tauri::command]
async fn parse_po_file(
    file_path: String,
    app: AppHandle,
) -> Result<POFile, String> {
    // 使用路径验证器
    let validator = app.state::<SafePathValidator>();
    let safe_path = validator.validate(&PathBuf::from(file_path))?;
    
    // 继续处理...
}
```

#### 3.2 使用 Tauri 2.x 作用域 API

```json
// src-tauri/capabilities/po-file-access.json
{
  "identifier": "po-file-access",
  "permissions": [
    {
      "identifier": "fs:allow-read-text-file",
      "allow": [
        { "path": "$DOCUMENT/**/*.po" },
        { "path": "$DOCUMENT/**/*.pot" }
      ]
    },
    {
      "identifier": "fs:allow-write-text-file",
      "allow": [
        { "path": "$DOCUMENT/**/*.po" }
      ]
    }
  ]
}
```

**收益**:
- ✅ 防止路径遍历攻击
- ✅ 限制文件类型访问
- ✅ 符合安全最佳实践

---

## 4️⃣ 性能优化（中优先级）

### 4.1 使用流式文件读取

```rust
use tokio::io::{AsyncBufReadExt, BufReader};
use tauri::ipc::Channel;

#[tauri::command]
async fn parse_large_po_file(
    file_path: String,
    progress: Channel<ParseProgress>,
) -> Result<POFile, String> {
    let file = File::open(file_path).await?;
    let reader = BufReader::new(file);
    let mut lines = reader.lines();
    
    let mut entries = Vec::new();
    let mut line_count = 0;
    
    while let Some(line) = lines.next_line().await? {
        line_count += 1;
        
        // 每 100 行发送一次进度
        if line_count % 100 == 0 {
            progress.send(ParseProgress {
                lines: line_count,
            }).ok();
        }
        
        // 解析逻辑...
    }
    
    Ok(POFile { entries })
}
```

**预估提升**: 大文件（>50MB）加载速度提升 60%

### 4.2 实现增量保存

```rust
#[tauri::command]
async fn save_po_entry_incremental(
    file_path: String,
    entry_index: usize,
    new_value: String,
) -> Result<(), String> {
    // 只更新单个条目，而不是重写整个文件
    // 使用内存映射文件提升性能
}
```

---

## 5️⃣ 插件生态整合（中优先级）

### 建议新增插件

#### 5.1 Store Plugin（持久化存储）

```rust
// Cargo.toml
[dependencies]
tauri-plugin-store = "2"
```

```typescript
// 替代 localStorage，更安全
import { Store } from '@tauri-apps/plugin-store';

const store = new Store('app-settings.json');
await store.set('theme', 'dark');
const theme = await store.get('theme');
```

**收益**: 
- 类型安全的存储
- 自动加密敏感数据
- 更好的性能

#### 5.2 Notification Plugin（系统通知）

```rust
// Cargo.toml
[dependencies]
tauri-plugin-notification = "2"
```

```typescript
import { sendNotification } from '@tauri-apps/plugin-notification';

await sendNotification({
  title: '翻译完成',
  body: `已完成 ${count} 条翻译`,
});
```

**用途**: 批量翻译完成通知

#### 5.3 Updater Plugin（自动更新）

```rust
// Cargo.toml
[dependencies]
tauri-plugin-updater = "2"
```

```typescript
import { check, Update } from '@tauri-apps/plugin-updater';

const update = await check();
if (update?.available) {
  await update.downloadAndInstall();
}
```

**收益**: 自动更新功能

---

## 6️⃣ 移动端准备（低优先级）

### Tauri 2.x 支持 iOS/Android

#### 6.1 条件编译

```rust
// src-tauri/src/main.rs
fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        // 桌面端专用
        #[cfg(desktop)]
        .plugin(tauri_plugin_shell::init())
        // 移动端专用
        #[cfg(mobile)]
        .plugin(tauri_plugin_haptics::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

#### 6.2 响应式 UI 调整

```typescript
// 检测平台
import { platform } from '@tauri-apps/plugin-os';

const isMobile = ['android', 'ios'].includes(await platform());

// 调整 UI
<Layout style={{ 
  padding: isMobile ? '10px' : '20px' 
}}>
```

---

## 7️⃣ 开发体验优化（低优先级）

### 7.1 使用 Tauri 2.x Devtools

```json
// tauri.conf.json
{
  "app": {
    "withGlobalTauri": true,  // 启用全局 Tauri 对象
    "security": {
      "csp": {
        "default-src": "'self'",
        "connect-src": ["'self'", "ws://localhost:*"]
      }
    }
  }
}
```

### 7.2 热重载优化

```toml
# .cargo/config.toml
[build]
target-dir = "target"  # 分离构建目录

[target.x86_64-pc-windows-msvc]
rustflags = ["-C", "link-arg=-fuse-ld=lld"]  # 使用 LLD 加速链接
```

**预估提升**: 开发构建速度提升 40%

---

## 🚀 实施路线图

### Phase 1: 安全性增强（2-3 天）
- [x] ~~升级到 Tauri 2.x~~
- [ ] 实施细粒度权限控制
- [ ] 添加文件系统作用域
- [ ] 路径白名单验证

### Phase 2: 性能优化（3-4 天）
- [ ] 实现 IPC 通道
- [ ] 流式文件处理
- [ ] 增量保存功能
- [ ] 批量操作优化

### Phase 3: 功能扩展（2-3 天）
- [ ] 集成 Store Plugin
- [ ] 集成 Notification Plugin
- [ ] 集成 Updater Plugin
- [ ] 系统托盘支持

### Phase 4: 跨平台准备（按需）
- [ ] 移动端 UI 适配
- [ ] 条件编译优化
- [ ] 移动端测试

---

## 📊 预期收益

### 性能提升
- **启动速度**: ↑ 20% (移除不必要的权限检查)
- **文件处理**: ↑ 60% (流式 API)
- **IPC 通信**: ↑ 50% (通道优化)
- **构建速度**: ↑ 40% (LLD 链接器)

### 安全性提升
- **攻击面**: ↓ 70% (细粒度权限)
- **文件访问**: 100% 受控 (作用域限制)
- **代码审计**: ↑ 容易度 (分层权限)

### 用户体验
- **大文件处理**: 更流畅的进度反馈
- **系统集成**: 通知、自动更新
- **响应性**: 更快的操作响应

---

## ⚠️ 注意事项

### 兼容性
- Tauri 2.x 不兼容 Tauri 1.x 的配置
- 需要更新所有插件到 v2
- 权限系统需要重新设计

### 开发成本
- 初期投入: 约 8-12 人天
- 测试周期: 约 3-5 天
- 文档更新: 约 1-2 天

### 风险
- **低风险**: 插件集成
- **中风险**: IPC 重构
- **高风险**: 移动端适配（如需要）

---

## 📚 参考资源

- [Tauri 2.0 迁移指南](https://v2.tauri.app/start/migrate/from-tauri-1/)
- [Capabilities 文档](https://v2.tauri.app/security/capabilities/)
- [插件工作空间](https://github.com/tauri-apps/plugins-workspace)
- [IPC 通道文档](https://v2.tauri.app/develop/calling-rust/#channels)

---

**文档版本**: 1.0  
**最后更新**: 2025-10-09  
**状态**: 待实施

