# 前后端架构迁移计划

## 迁移原则
- ✅ 小步快跑：每次迁移一个模块
- ✅ 测试先行：每步完成后立即测试
- ✅ 可回滚：保留旧实现直到新实现稳定
- ✅ 零停机：应用始终可用

---

## Phase 1: 前端统一命令层迁移（低风险）

### 目标
将 `api.ts` 直接调用改为 `commands.ts` 封装调用

### 策略
1. **保留 api.ts**：不删除，作为底层实现
2. **逐个文件迁移**：每迁移一个文件就测试
3. **命令对等映射**：确保功能完全一致

### 迁移列表（按依赖顺序）

#### 🟢 Step 1.1: 配置相关 Hook (2 files) ✅ **已完成**
- [x] `src/hooks/useConfig.ts` - 配置管理 Hook
- [x] 修正 `commands.ts` 命令名称不一致
- [x] 修复 `config_draft.rs` 编译错误

**测试点**：
- 打开设置页面
- 修改配置并保存
- 切换语言

**编译验证**：✅ 前端+后端编译通过

---

#### 🟢 Step 1.2: UI 组件（简单） (3 files)
- [ ] `src/components/LanguageSelector.tsx` - 语言选择器
- [ ] `src/components/TermLibraryManager.tsx` - 术语库管理
- [ ] `src/components/MemoryManager.tsx` - 记忆库管理

**测试点**：
- 添加/删除术语
- 查看翻译记忆
- UI 交互正常

---

#### 🟢 Step 1.3: 核心组件（复杂） (3 files)
- [ ] `src/components/MenuBar.tsx` - 菜单栏（文件操作）
- [ ] `src/components/SettingsModal.tsx` - 设置对话框
- [ ] `src/components/DevToolsModal.tsx` - 开发工具

**测试点**：
- 打开/保存文件
- 修改所有设置项
- 查看日志和调试信息

---

#### 🟢 Step 1.4: 主应用组件 (1 file)
- [ ] `src/App.tsx` - 主应用（批量翻译等）

**测试点**：
- 完整翻译流程
- 文件拖放
- 批量翻译

---

#### 🟢 Step 1.5: 清理工作
- [ ] 标记 `api.ts` 为已废弃（添加注释）
- [ ] 验证无直接引用 `api.ts`
- [ ] 文档更新

---

## Phase 2: 后端 Draft 配置管理迁移（高风险）

### 目标
将 `ConfigManager` 改为 `ConfigDraft` 模式

### 策略
1. **创建适配层**：在 commands 中封装 ConfigDraft
2. **影子运行**：ConfigDraft 和 ConfigManager 并行运行
3. **渐进切换**：一个命令一个命令迁移
4. **验证一致性**：确保数据同步

### 迁移列表

#### 🟡 Step 2.1: 准备工作
- [ ] 添加 ConfigDraft 单元测试
- [ ] 创建配置迁移工具
- [ ] 备份配置文件

**测试点**：
- Draft 模式基本功能
- 配置文件兼容性

---

#### 🟡 Step 2.2: 只读命令迁移 (低风险)
- [ ] `get_app_config` - 读取配置
- [ ] `get_all_ai_configs` - 读取 AI 配置列表
- [ ] `get_active_ai_config` - 读取当前配置

**策略**：使用 `ConfigDraft::latest_ref()`，只读不写

**测试点**：
- 打开应用，配置正常显示
- 切换 AI 配置

---

#### 🟡 Step 2.3: 写入命令迁移（中风险）
- [ ] `update_app_config` - 更新配置
- [ ] `add_ai_config` - 添加 AI 配置
- [ ] `update_ai_config` - 更新 AI 配置

**策略**：使用 `ConfigDraft::draft() + apply()` 模式

**测试点**：
- 修改配置并保存
- 添加新 AI 配置
- 更新现有配置
- 验证配置文件正确写入

---

#### 🟡 Step 2.4: 删除命令迁移（高风险）
- [ ] `delete_ai_config` - 删除 AI 配置

**策略**：先备份，使用 Draft 事务

**测试点**：
- 删除配置
- 验证索引调整正确
- 回滚功能

---

#### 🟡 Step 2.5: 批量翻译器迁移
- [ ] `src-tauri/src/services/batch_translator.rs`

**策略**：使用 `ConfigDraft::global().latest_ref()`

**测试点**：
- 批量翻译功能
- 配置读取正确

---

#### 🟡 Step 2.6: 清理工作
- [ ] 移除 ConfigManager 所有引用
- [ ] 删除 `config_manager.rs`（保留备份）
- [ ] 更新文档

---

## Phase 3: 验证和优化

### 🔵 Step 3.1: 集成测试
- [ ] 完整工作流测试
- [ ] 压力测试（大文件、并发）
- [ ] 配置迁移测试

### 🔵 Step 3.2: 性能优化
- [ ] 分析 Draft 锁竞争
- [ ] 优化事件发送频率
- [ ] 减少不必要的 mutate

### 🔵 Step 3.3: 文档完善
- [ ] API 文档更新
- [ ] 架构图更新
- [ ] 迁移经验总结

---

## 回滚计划

### 如果 Phase 1 出问题
```bash
# 恢复单个文件
git checkout HEAD -- src/components/XXX.tsx

# 验证
npm run build
npm run test
```

### 如果 Phase 2 出问题
```rust
// 临时回退：在命令中切换回 ConfigManager
use crate::services::ConfigManager; // 恢复旧实现
```

---

## 测试检查清单

### 每次迁移后必做
- [ ] `npm run build` - 编译通过
- [ ] `npm run test` - 测试通过
- [ ] 手动测试核心功能
- [ ] 检查控制台无错误

### 关键测试场景
- [ ] 启动应用
- [ ] 打开 PO 文件
- [ ] 翻译单条
- [ ] 批量翻译
- [ ] 修改配置
- [ ] 添加术语
- [ ] 切换语言
- [ ] 切换主题

---

## 风险评估

| Phase | 风险等级 | 预计时间 | 回滚难度 |
|-------|---------|---------|---------|
| Phase 1 | 🟢 低 | 2-3 小时 | 容易 |
| Phase 2 | 🟡 中 | 3-4 小时 | 中等 |
| Phase 3 | 🔵 低 | 1-2 小时 | 容易 |

---

## 开始迁移

执行顺序：
1. ✅ 创建此迁移计划
2. ⏭️ Phase 1.1 开始
3. 每完成一步，更新进度
4. 遇到问题立即停止，分析后再继续

