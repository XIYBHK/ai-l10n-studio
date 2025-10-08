# 配置同步架构设计文档

## 问题背景

在多需求实现完成后，发现严重的架构问题：**前端配置只是UI展示，后端使用的是旧的apiKey**，导致前后端逻辑不一致。

### 具体表现

1. 用户在前端添加/切换AI配置，但翻译仍使用旧配置
2. 前端显示"配置已启用"，后端却使用完全不同的配置
3. 敏感数据（API Key）在前端传递，违反安全原则

## 架构改进方案

### 核心原则

1. **单一数据源（Single Source of Truth）**
   - 配置只存在于后端（Rust ConfigManager）
   - 前端只读取配置状态，不持有敏感数据

2. **前端只读访问**
   - 前端不传递 `apiKey` 参数
   - 所有AI操作由后端从ConfigManager获取配置

3. **类型强约束**
   - TypeScript接口与Rust结构体严格对应
   - API调用参数通过类型系统约束

4. **配置版本控制**
   - 每次配置修改递增版本号
   - 前后端定期验证版本一致性

5. **启动时验证**
   - 应用启动时检查配置完整性
   - 配置不一致时自动同步

### 实现架构

```
┌─────────────────────────────────────────────────────────────┐
│                         Frontend (React + TS)                │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ ConfigSyncManager (只读访问)                        │  │
│  ├──────────────────────────────────────────────────────┤  │
│  │ • 初始化时从后端获取配置版本                         │  │
│  │ • 每5秒验证前后端配置一致性                          │  │
│  │ • 监听配置变更事件，自动同步                         │  │
│  │ • 检测到不一致时触发警告                             │  │
│  └──────────────────────────────────────────────────────┘  │
│           ↓ invoke('get_config_version')                    │
│           ↓ 事件监听: config:changed                        │
└───────────────────────┼─────────────────────────────────────┘
                        │
                  Tauri Commands
                        │
┌───────────────────────┼─────────────────────────────────────┐
│                       ↓          Backend (Rust)              │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ ConfigManager (唯一权威数据源)                      │  │
│  ├──────────────────────────────────────────────────────┤  │
│  │ AppConfig {                                           │  │
│  │   ai_configs: Vec<AIConfig>,                          │  │
│  │   active_config_index: Option<usize>,                 │  │
│  │   system_prompt: Option<String>,                      │  │
│  │   config_version: u64,        // 新增：版本号        │  │
│  │   last_modified: String,      // 新增：时间戳        │  │
│  │ }                                                      │  │
│  ├──────────────────────────────────────────────────────┤  │
│  │ 方法：                                                │  │
│  │ • get_active_ai_config() -> AIConfig                  │  │
│  │ • save_with_version_increment()                       │  │
│  │ • get_config_version_info() -> ConfigVersionInfo      │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                               │
│  所有翻译命令直接从ConfigManager获取配置：                │
│  • translate_entry(text, target_lang)                       │
│  • translate_batch(texts, target_lang)                      │
│  • translate_batch_with_stats(texts, target_lang)           │
│  • contextual_refine(requests, target_lang)                 │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## 关键实现

### 1. 后端配置版本管理

**文件**: `src-tauri/src/services/config_manager.rs`

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    // ... 现有字段 ...
    
    // 新增：配置版本控制
    #[serde(default)]
    pub config_version: u64,
    #[serde(default)]
    pub last_modified: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConfigVersionInfo {
    pub version: u64,
    pub timestamp: String,
    pub active_config_index: Option<usize>,
    pub config_count: usize,
}

impl ConfigManager {
    /// 保存配置并自动递增版本号
    fn save_with_version_increment(&mut self) -> Result<()> {
        self.config.config_version = self.config.config_version.wrapping_add(1);
        self.config.last_modified = Some(chrono::Local::now().to_rfc3339());
        self.save()
    }
    
    /// 获取配置版本信息（用于前后端同步）
    pub fn get_config_version_info(&self) -> ConfigVersionInfo {
        ConfigVersionInfo {
            version: self.config.config_version,
            timestamp: self.config.last_modified.clone().unwrap_or_default(),
            active_config_index: self.config.active_config_index,
            config_count: self.config.ai_configs.len(),
        }
    }
}
```

### 2. 前端配置同步管理器

**文件**: `src/services/configSync.ts`

```typescript
class ConfigSyncManager {
  private currentVersion: ConfigVersion | null = null;
  private validationInterval: number | null = null;
  
  async initialize(): Promise<void> {
    // 1. 从后端同步初始版本
    await this.syncFromBackend();
    
    // 2. 启动定期验证（每5秒）
    this.startValidation();
    
    // 3. 监听配置变更事件
    this.subscribeToConfigChanges();
  }
  
  async validate(): Promise<ConfigValidationResult> {
    const backendVersion = await invoke<ConfigVersion>('get_config_version');
    
    // 检查版本号、配置数量、启用配置索引
    // 不一致时自动同步并触发警告
  }
}
```

### 3. API参数移除

**修改**: 所有翻译API移除 `apiKey` 参数

**Before**:
```typescript
await translatorApi.translateBatchWithStats(texts, apiKey, targetLanguage);
```

**After**:
```typescript
await translatorApi.translateBatchWithStats(texts, targetLanguage);
```

**Rust Commands** 从ConfigManager获取配置:
```rust
#[tauri::command]
pub async fn translate_batch(texts: Vec<String>, target_language: Option<String>) 
    -> Result<Vec<String>, String> 
{
    let config_manager = ConfigManager::new(None)?;
    let ai_config = config_manager.get_config().get_active_ai_config()
        .ok_or("未找到启用的AI配置")?
        .clone();
    
    let mut translator = AITranslator::new_with_config(
        ai_config, true, None, target_language
    )?;
    
    translator.translate_batch(texts, None).await
}
```

## 配置变更流程

### 添加/修改配置

```
1. 前端: 用户在SettingsModal中添加/修改配置
   ↓
2. 前端: 调用 aiConfigApi.addConfig(config)
   ↓
3. 后端: ConfigManager.add_ai_config()
   ↓
4. 后端: save_with_version_increment() // 版本号 +1
   ↓
5. 前端: 触发事件 config:changed
   ↓
6. ConfigSyncManager: 自动调用 syncFromBackend()
   ↓
7. 前端: 版本号已同步，配置已是最新
```

### 执行翻译

```
1. 前端: 用户点击"批量翻译"
   ↓
2. 前端: 调用 translatorApi.translateBatchWithStats(texts, targetLang)
   ↓
3. 后端: translate_batch_with_stats命令
   ↓
4. 后端: ConfigManager::new().get_active_ai_config()
   ↓
5. 后端: 使用最新的AI配置创建翻译器
   ↓
6. 翻译执行，使用的是用户设置的正确配置
```

## 验证机制

### 定期验证（每5秒）

```typescript
async validate() {
  const backend = await invoke('get_config_version');
  
  if (this.currentVersion.version !== backend.version) {
    console.warn('配置版本不一致，自动同步');
    this.currentVersion = backend;
    eventDispatcher.emit('config:out-of-sync', { backend });
  }
}
```

### 配置变更即时同步

```typescript
eventDispatcher.on('config:changed', async () => {
  await this.syncFromBackend(); // 立即同步
});
```

## 安全性改进

1. **API Key不再在前端传递**
   - 前端API调用不包含敏感数据
   - API Key始终保留在Rust后端

2. **配置状态只读**
   - 前端只能读取配置状态（版本号、数量等）
   - 不能直接访问完整配置（包含API Key）

3. **类型安全**
   - TypeScript类型系统防止错误参数
   - Rust类型系统确保配置结构正确

## 迁移指南

### 前端代码迁移

**需要修改的地方**:

1. **移除apiKey参数传递**
   ```diff
   - await translatorApi.translateEntry(text, apiKey, targetLang);
   + await translatorApi.translateEntry(text, targetLang);
   ```

2. **初始化配置同步**
   ```typescript
   useEffect(() => {
     configSyncManager.initialize();
     return () => configSyncManager.destroy();
   }, []);
   ```

3. **监听配置不一致**
   ```typescript
   eventDispatcher.on('config:out-of-sync', ({ issues }) => {
     message.warning(`配置已自动同步: ${issues.join(', ')}`);
   });
   ```

### 后端代码迁移

**需要修改的地方**:

1. **移除apiKey参数**
   ```diff
   - pub async fn translate_batch(texts: Vec<String>, api_key: String, target_lang: Option<String>)
   + pub async fn translate_batch(texts: Vec<String>, target_lang: Option<String>)
   ```

2. **从ConfigManager获取配置**
   ```rust
   let config_manager = ConfigManager::new(None)?;
   let ai_config = config_manager.get_config().get_active_ai_config()?;
   ```

3. **配置修改时递增版本**
   - 已自动处理：`update_config()` 内部调用 `save_with_version_increment()`

## 测试验证

### 测试场景

1. **配置切换测试**
   - 添加多个AI配置
   - 切换启用配置
   - 执行翻译，验证使用的是正确配置

2. **版本同步测试**
   - 修改配置
   - 检查前端版本号是否自动更新
   - 验证定期验证机制

3. **配置不一致检测**
   - 模拟前后端版本不一致
   - 验证是否触发警告和自动同步

4. **无效配置测试**
   - 删除所有配置
   - 执行翻译应该提示"未找到启用的AI配置"

## 优势总结

✅ **架构清晰**: 单一数据源，职责明确  
✅ **安全性提升**: 敏感数据不在前端传递  
✅ **类型安全**: TypeScript + Rust双重保障  
✅ **自动同步**: 配置变更自动检测和同步  
✅ **易于维护**: 配置逻辑集中管理  
✅ **可扩展性**: 未来添加配置项无需修改API

## 后续优化

1. **配置快照**: 支持配置版本回滚
2. **配置导入导出**: JSON格式导入导出
3. **配置预检查**: 添加配置前验证有效性
4. **配置加密**: 敏感配置字段加密存储
5. **配置审计**: 记录配置变更历史

---

**编写日期**: 2025-10-08  
**版本**: v1.0  
**作者**: AI配置同步架构设计团队

