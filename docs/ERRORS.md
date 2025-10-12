# 常见错误与解决方案

本文档记录开发过程中遇到的典型错误及其解决方案，用于避免重复问题。

---

## 2025-10-13 - 架构重构后的编译错误

### 问题概述

架构重构（统一命令层 + Draft 模式 + AppDataProvider）后出现 19 个 TypeScript 编译错误和 1 个 Rust 编译错误。

### 错误类型与解决方案

#### 1. 命令层 API 名称不一致

**错误**:
```typescript
// TS2339: Property 'getAll' does not exist
termLibraryCommands.getAll()
```

**原因**: 重构后命令名称统一为 `get()`，但部分代码仍使用旧名称

**解决**:
```typescript
// 旧
termLibraryApi.getAll()
logApi.getLogs()

// 新
termLibraryCommands.get()
logCommands.get()
```

**预防措施**:
- 重构时使用全局搜索确保所有调用点都已更新
- 在 `commands.ts` 中明确标注已废弃的 API 命名

---

#### 2. SWR Hook 缺少 Fetcher 函数

**错误**:
```typescript
// TS2347: Untyped function calls may not accept type arguments
const { data } = useSWR<string>(KEY, { ... });
```

**原因**: SWR 需要显式提供 fetcher 函数才能进行类型推断

**解决**:
```typescript
// 错误
const { data } = useSWR<string>(KEY, { refreshInterval: 2000 });

// 正确
const { data } = useSWR(
  KEY,
  () => logCommands.get() as Promise<string>,
  { refreshInterval: 2000 }
);
```

**预防措施**:
- 所有 `useSWR` 调用都应提供 fetcher 函数
- 使用 ESLint 规则检测缺少 fetcher 的 SWR 调用

---

#### 3. 事件参数结构不匹配

**错误**:
```typescript
// TS2353: Object literal may only specify known properties
eventDispatcher.emit('term:updated', { reason: 'manual_save' });
```

**原因**: 事件系统重构后，EventMap 定义的参数结构已变更

**解决**:
```typescript
// 旧
eventDispatcher.emit('term:updated', { reason: 'manual_save' });

// 新（参考 EventMap）
eventDispatcher.emit('term:updated', { source: 'manual_save' });
```

**预防措施**:
- 所有事件发送前检查 `src/services/eventDispatcher.ts` 中的 `EventMap` 定义
- 考虑使用辅助函数封装常用事件，提供类型安全保障

---

#### 4. 类型返回值不一致

**错误**:
```typescript
// TS2322: Type 'undefined' is not assignable to type 'T | null'
return value;  // value: T | undefined
```

**原因**: Tauri Store 的 `get()` 方法可能返回 `undefined`，但接口声明为 `T | null`

**解决**:
```typescript
// 错误
async get<K>(key: K): Promise<T[K] | null> {
  const value = await this.store!.get<T[K]>(key);
  return value;
}

// 正确
async get<K>(key: K): Promise<T[K] | null> {
  const value = await this.store!.get<T[K]>(key);
  return value ?? null;
}
```

**预防措施**:
- 启用 TypeScript `strictNullChecks`
- 对外部库返回值使用 `??` 运算符规范化类型

---

#### 5. 可选字段访问未加保护

**错误**:
```typescript
// TS18048: 'stats.total' is possibly 'undefined'
sessionCount: stats.total > 0 ? 1 : 0
```

**原因**: 未检查字段是否存在就直接访问

**解决**:
```typescript
// 错误
sessionCount: stats.total > 0 ? 1 : 0

// 正确
sessionCount: (stats.total ?? 0) > 0 ? 1 : 0
```

**预防措施**:
- 所有来自外部的数据使用可选链 `?.` 或空值合并 `??`
- 在类型定义中明确标注可选字段

---

#### 6. 后端返回类型变更未同步

**错误**:
```typescript
// TS2339: Property 'response_time_ms' does not exist
message.success(`... (响应时间: ${result.response_time_ms}ms)`);
```

**原因**: 后端 Tauri command 返回类型简化，移除了 `response_time_ms` 字段

**解决**:
```typescript
// 旧
message.success(`${result.message} (响应时间: ${result.response_time_ms}ms)`);

// 新
message.success(result.message);
```

**预防措施**:
- 使用 `ts-rs` 自动生成 Rust → TypeScript 类型绑定
- 后端 API 变更时同步更新前端类型定义
- 添加集成测试覆盖关键 API 调用路径

---

#### 7. Rust 模块导入路径错误

**错误**:
```rust
// E0432: unresolved import `crate::utils::logging_types`
use crate::utils::logging_types::NoModuleFilter;
```

**原因**: 重构时使用了 `logging as logging_types` 别名，但忘记更新导入路径

**解决**:
```rust
// 错误
use crate::utils::{logging as logging_types, paths};
use crate::utils::logging_types::NoModuleFilter;

// 正确
use crate::utils::paths;
use crate::utils::logging::{Type as LogType, NoModuleFilter};
```

**预防措施**:
- 避免使用模块别名（`as`），容易造成混淆
- 直接导入需要的类型，使用 `Type as LogType` 避免命名冲突
- 重构后运行 `cargo check` 验证所有导入

---

#### 8. 测试数据结构不完整

**错误**:
```typescript
// TS2739: Type '{ enabled: false; onComplete: false; }' is missing properties
notifications: {
  enabled: false,
  onComplete: false,
}
```

**原因**: 接口定义新增字段后，测试数据未同步更新

**解决**:
```typescript
// 错误
notifications: {
  enabled: false,
  onComplete: false,
}

// 正确
notifications: {
  enabled: false,
  onComplete: false,
  onError: false,
  onProgress: false,
}
```

**预防措施**:
- 使用 TypeScript 的 `Required<T>` 或 `Partial<T>` 明确标注测试数据的完整性
- 测试文件应与主代码同步重构

---

## 总结与最佳实践

### 重构流程

1. **计划阶段**
   - 列出所有需要修改的 API/接口
   - 使用全局搜索找出所有调用点
   - 创建迁移清单（如 `MIGRATION_PLAN.md`）

2. **实现阶段**
   - 先修改底层（utils/services）
   - 再修改中间层（hooks/commands）
   - 最后修改上层（components）
   - 每个阶段完成后运行编译检查

3. **验证阶段**
   - 运行 `npm run build` 检查前端
   - 运行 `cargo check` 检查后端
   - 运行 `npm run test` 检查测试
   - 手动测试关键功能路径

4. **清理阶段**
   - 删除已废弃的代码
   - 更新文档和注释
   - 确保无新旧代码共存

### 类型安全建议

1. **前端**
   - 启用 `strictNullChecks` 和 `strictFunctionTypes`
   - 使用 `useSWR` 必须提供 fetcher 函数
   - 事件发送前检查 `EventMap` 定义
   - 可选字段使用 `?.` 和 `??` 操作符

2. **后端**
   - 使用 `Result<T, E>` 而非 `Option<T>` 传递错误信息
   - 避免模块别名，直接导入类型
   - 公共 API 变更时更新前端类型绑定

3. **测试**
   - 测试数据结构与主代码接口保持同步
   - 使用工厂函数生成测试数据，避免重复定义

### 工具推荐

- **ESLint 规则**: 
  - `@typescript-eslint/no-unused-imports` - 检测未使用的导入
  - `@typescript-eslint/no-explicit-any` - 禁止使用 `any`
  
- **Git Hook**: 提交前自动运行 `npm run build` 和 `cargo check`

- **CI/CD**: GitHub Actions 中添加编译检查步骤

---

## 参考文档

- 架构说明: `docs/Architecture.md`
- API 文档: `docs/API.md`
- 数据契约: `docs/DataContract.md`
- 变更日志: `docs/CHANGELOG.md`

