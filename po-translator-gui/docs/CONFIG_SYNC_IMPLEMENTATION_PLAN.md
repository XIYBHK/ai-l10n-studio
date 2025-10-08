# 配置同步机制实施计划

## 已完成工作 ✅

### 1. 后端配置版本管理
- ✅ `AppConfig` 添加 `config_version` 和 `last_modified` 字段
- ✅ `ConfigManager::save_with_version_increment()` 方法
- ✅ `ConfigManager::get_config_version_info()` 方法
- ✅ `ConfigVersionInfo` 结构体定义
- ✅ 修改 `update_config()` 使用版本递增保存

**文件**: `src-tauri/src/services/config_manager.rs`

### 2. Tauri命令添加
- ✅ `get_config_version` 命令实现
- ✅ 命令在 `main.rs` 中注册

**文件**:
- `src-tauri/src/commands/config_sync.rs`
- `src-tauri/src/commands/mod.rs`
- `src-tauri/src/main.rs`

### 3. 前端配置同步管理器
- ✅ `ConfigSyncManager` 类实现
- ✅ 定期验证机制（5秒间隔）
- ✅ 事件驱动同步
- ✅ 前后端一致性检查

**文件**: `src/services/configSync.ts`

### 4. API参数简化
- ✅ 所有翻译命令移除 `api_key` 参数
- ✅ 前端API移除 `apiKey` 传递
- ✅ 后端直接从 `ConfigManager` 获取配置

**影响的文件**:
- `src-tauri/src/commands/translator.rs`
- `src/services/api.ts`
- `src/App.tsx`

### 5. 文档编写
- ✅ 完整的架构设计文档

**文件**: `docs/CONFIG_SYNC_ARCHITECTURE.md`

## 待完成工作 ⏳

### 1. 前端集成
- [ ] 在 `App.tsx` 中初始化 `ConfigSyncManager`
- [ ] 添加配置不一致警告UI
- [ ] 订阅 `config:out-of-sync` 事件

**代码示例**:
```typescript
// App.tsx
useEffect(() => {
  configSyncManager.initialize().catch(error => {
    log.error('配置同步管理器初始化失败', { error });
  });
  
  return () => {
    configSyncManager.destroy();
  };
}, []);

// 监听配置不一致
useEffect(() => {
  const unsubscribe = eventDispatcher.on('config:out-of-sync', ({ issues }) => {
    message.warning(`配置已自动同步: ${issues.join(', ')}`, 3);
  });
  
  return unsubscribe;
}, []);
```

### 2. 配置变更事件触发
- [ ] 在 `SettingsModal` 中配置保存后触发 `config:changed` 事件

**代码示例**:
```typescript
// SettingsModal.tsx - handleSaveConfig
await aiConfigApi.updateConfig(editingIndex!, config);
eventDispatcher.emit('config:changed', { index: editingIndex });
```

### 3. TypeScript类型定义
- [ ] 添加 `ConfigVersion` 接口
- [ ] 添加 `ConfigValidationResult` 接口

**文件**: `src/types/tauri.ts`

```typescript
export interface ConfigVersion {
  version: number;
  timestamp: string;
  activeConfigIndex: number | null;
  configCount: number;
}

export interface ConfigValidationResult {
  isValid: boolean;
  frontendVersion?: ConfigVersion;
  backendVersion?: ConfigVersion;
  issues: string[];
}
```

### 4. 测试
- [ ] 配置切换测试
- [ ] 版本同步测试
- [ ] 配置删除后翻译失败测试
- [ ] 并发配置修改测试

### 5. 用户体验优化
- [ ] 配置版本显示在设置界面
- [ ] 最后修改时间显示
- [ ] 配置同步状态指示器
- [ ] 配置不一致时的修复建议

## 实施步骤

### 步骤1: 编译验证
```bash
cd po-translator-gui
cargo check
npm run build
```

### 步骤2: 添加TypeScript类型
编辑 `src/types/tauri.ts`，添加配置同步相关类型

### 步骤3: 前端集成
编辑 `src/App.tsx`，初始化配置同步管理器

### 步骤4: 事件触发
编辑 `src/components/SettingsModal.tsx`，触发配置变更事件

### 步骤5: 测试验证
- 手动测试配置切换
- 验证版本号递增
- 测试配置不一致警告

### 步骤6: UI优化（可选）
- 在设置界面显示配置版本
- 添加同步状态指示器

## 回归测试清单

- [ ] 批量翻译功能正常
- [ ] 精翻功能正常
- [ ] 翻译选中功能正常
- [ ] 配置添加/编辑/删除功能正常
- [ ] 配置切换后翻译使用新配置
- [ ] 配置为空时提示正确
- [ ] 提示词日志功能正常
- [ ] 系统提示词生效
- [ ] 术语库提示生效

## 预期效果

✅ **配置切换立即生效**: 切换AI配置后，下次翻译使用新配置  
✅ **无效配置阻止**: 无配置或配置无效时，翻译被阻止并提示  
✅ **自动同步**: 配置变更自动同步，无需手动刷新  
✅ **安全性**: API Key不在前端传递  
✅ **可维护性**: 配置逻辑集中，易于维护

## 风险与缓解

### 风险1: 配置迁移兼容性
- **风险**: 旧配置文件缺少新字段导致加载失败
- **缓解**: 使用 `#[serde(default)]` 提供默认值

### 风险2: 并发配置修改
- **风险**: 多窗口同时修改配置导致冲突
- **缓解**: 定期验证机制自动检测并同步

### 风险3: 版本号溢出
- **风险**: `u64` 版本号理论上可能溢出
- **缓解**: 使用 `wrapping_add()` 循环递增，实际不会达到上限

## 后续迭代

### v2.0: 配置历史
- 记录配置变更历史
- 支持配置回滚

### v2.1: 配置导入导出
- JSON格式导入导出
- 配置模板分享

### v2.2: 配置验证增强
- 保存前验证配置有效性
- API连接性测试

---

**计划制定**: 2025-10-08  
**预计完成**: 2025-10-09  
**优先级**: P0（高优先级）

