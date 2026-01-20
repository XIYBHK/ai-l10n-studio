# 常见错误与解决方案

本文档记录开发过程中遇到的典型错误及其解决方案，用于避免重复问题。

---

## 2026-01-20 - 日志系统无法生成文件问题

### 问题概述

日志功能无法生成日志文件，导致调试困难，无法追踪系统运行状态。

### 问题表现

- 应用运行后 `logs/` 目录下没有生成任何 `.log` 文件
- 重启应用后日志完全丢失
- 无法进行问题排查和性能分析

### 问题根源

1. **缺少 WriteMode 配置**:
   - `flexi_logger` 默认可能使用缓冲模式
   - 日志积压在内存中，无法及时写入磁盘
   - 程序退出时日志可能丢失

2. **配置依赖风险**:
   - 日志初始化依赖 `ConfigDraft` 读取配置
   - 如果配置文件损坏或加载失败，日志初始化失败
   - 导致没有任何日志文件生成

3. **Logger Handle 丢失**:
   - `logger.start()` 返回的 handle 被直接丢弃
   - handle 对于管理日志生命周期很重要（如强制刷新缓冲区）

### 解决方案

**修改文件**: `src-tauri/src/utils/init.rs`

#### 1. 添加必要导入和全局变量

```rust
use flexi_logger::{Cleanup, Criterion, Duplicate, FileSpec, LogSpecBuilder, Logger, WriteMode};
use std::sync::OnceLock;
use tokio::time::{timeout, Duration};

pub static LOGGER_HANDLE: OnceLock<flexi_logger::LoggerHandle> = OnceLock::new();
```

#### 2. 修改配置加载逻辑（添加超时保护）

```rust
// 尝试从配置读取参数，失败则使用默认值（解耦依赖风险）
let (log_max_size, log_max_count) = match timeout(Duration::from_millis(500), ConfigDraft::global()).await {
    Ok(draft) => {
        let config = draft.data();
        (
            config.log_max_size.unwrap_or(128) * 1024, // KB -> Bytes
            config.log_max_count.unwrap_or(8),
        )
    }
    Err(_) => {
        eprintln!("⚠️ 日志初始化: 配置加载超时，使用默认值");
        (128 * 1024, 8) // 默认 128KB, 8个文件
    }
};
```

#### 3. 添加 WriteMode 配置

```rust
let logger = Logger::with(spec)
    .log_to_file(FileSpec::default().directory(&log_dir).basename("app"))
    // 关键修复: 显式设置写入模式，确保立即写入文件
    .write_mode(WriteMode::BufferAndFlush)
    .duplicate_to_stdout(Duplicate::Info)
    // ... 其他配置 ...
```

#### 4. 保存 Logger Handle

```rust
let handle = logger.start()?;
LOGGER_HANDLE.set(handle).ok(); // 保存 handle 防止被 drop

log::info!("日志系统初始化完成，路径: {:?}", log_dir);
```

### 影响范围

- ✅ 日志文件立即写入磁盘（BufferAndFlush 模式）
- ✅ 即使配置加载失败，日志系统仍能正常初始化（默认值保护）
- ✅ Logger handle 保持在内存中，确保日志系统正常运行
- ✅ 在启动时会输出初始化成功消息，便于调试

### 验证方法

**开发环境测试**:

```bash
npm run tauri:dev
```

- 检查控制台是否输出 "日志系统初始化完成"
- 检查 `<项目根目录>\src-tauri\target\debug\logs\` 是否生成日志文件

**生产环境测试**:

```bash
npm run tauri:build
```

- 运行构建后的应用
- 检查 `%APPDATA%\com.potranslator.gui\logs\` 是否生成日志文件

### 预防措施

1. **初始化顺序**: 日志系统应在所有其他系统之前初始化
2. **错误隔离**: 日志初始化失败不应影响其他功能启动
3. **默认值策略**: 配置依赖系统必须有合理的默认值
4. **生命周期管理**: 长生命周期资源（如 Logger）必须正确持有 handle

---

## 2025-12-16 - Phase 10 CI 质量与类型安全问题

### 问题概述

Phase 10 性能优化阶段发现了两个关键的代码质量问题：CI 检查被静默通过（P1 优先级）和 TypeScript 类型安全完全丢失（P2 优先级）。这两个问题导致代码质量无法得到保障，运行时错误风险增加。

### 错误类型与解决方案

#### 1. lint:all 静默通过问题 (P1 优先级)

**错误**:

```yaml
# .github/workflows/check.yml
- name: Run linters
  run: npm run lint:all || true
```

**问题表现**:

- CI 工作流显示"通过"，但实际存在 lint 错误
- 代码质量问题无法在 PR 阶段被检测
- 团队成员可能提交不符合规范的代码
- 代码质量持续退化

**原因**:

`|| true` 操作符强制命令总是返回成功退出码（0），即使 `npm run lint:all` 失败也会被 CI 标记为通过。这是一个严重的质量保障漏洞。

**解决**:

```yaml
# 修复后：移除 || true，让 lint 真正生效
- name: Run linters
  run: npm run lint:all
```

**影响范围**:

- ✅ CI 现在能真实反映代码质量
- ✅ 强制所有 PR 通过 lint 检查
- ✅ 防止代码质量退化
- ✅ 提升代码一致性和可维护性

**预防措施**:

1. **审查 CI 配置**:
   - 定期检查 GitHub Actions 工作流文件
   - 禁止使用 `|| true` 绕过错误检查
   - 使用 `set -e` 确保任何错误都会终止流程

2. **建立质量门禁**:
   - 要求至少一次代码审查
   - 禁止合并失败的 PR
   - 设置分支保护规则

3. **文档化 CI 配置**:
   - 在 `workflows/README.md` 中说明每个步骤的目的
   - 标注关键质量检查步骤
   - 定期审查和更新 CI 流程

---

#### 2. SWR 类型安全完全丢失 (P2 优先级)

**错误**:

```typescript
// src/types/swr-shim.d.ts (已删除)
declare module 'swr' {
  const SWR: any; // 💥 所有类型变为 any
  export default SWR;
  export const SWRConfig: any;
  export type SWRConfiguration = any;
  export function mutate(...args: any[]): any;
  export function useSWR<T = any>(
    key: any,
    ...rest: any[]
  ): {
    data: T | undefined;
    error: any;
    isLoading: boolean;
    isValidating: boolean;
    mutate: (data?: any, opts?: any) => Promise<any>;
  };
}
```

**问题表现**:

- TypeScript 类型推断完全失效
- IDE 智能提示丢失，开发体验急剧下降
- 编译时类型检查无法生效
- 增加运行时类型错误风险
- 代码重构时缺少安全保障

**原因**:

这个类型定义文件（shim）将所有 SWR 的类型定义覆盖为 `any`，完全破坏了 SWR 2.3.6 官方提供的精确类型定义。这是为了"快速修复"某个类型错误而创建的临时方案，但最终成为了技术债务。

**解决**:

完全删除 `src/types/swr-shim.d.ts` 文件，依赖 SWR 官方类型定义：

```bash
# 删除错误的类型定义文件
rm src/types/swr-shim.d.ts
```

修复后的正确类型推断：

```typescript
// ✅ 完整的类型推断（来自 SWR 官方定义）
import useSWR from 'swr';

function useAppConfig() {
  // ✅ data 类型完全推断为 AppConfig | undefined
  // ✅ error 类型推断为 Error | undefined
  // ✅ mutate 类型安全，有完整的参数和返回值类型
  const { data, error, mutate } = useSWR('app_config', () => configCommands.get());

  return {
    config: data, // ✅ AppConfig | undefined (完整类型推断)
    error, // ✅ Error | undefined
    mutate, // ✅ 完整类型签名
  };
}
```

**类型安全对比**:

| 方面            | 修复前 (swr-shim.d.ts) | 修复后 (官方定义) |
| --------------- | ---------------------- | ----------------- |
| TypeScript 推断 | 全部 any               | 完整类型推断      |
| IDE 智能提示    | 无                     | 完整提示          |
| 编译时检查      | 无效                   | 完全生效          |
| 运行时安全      | 低                     | 高                |
| 开发体验        | 差                     | 优秀              |
| 类型错误检测    | 无                     | 编译时发现        |

**影响范围**:

受益的文件和功能：

- `src/hooks/useConfig.ts` - 配置相关 hooks
- `src/hooks/useTermLibrary.ts` - 术语库 hooks
- `src/hooks/useTranslationMemory.ts` - 翻译记忆库 hooks
- 所有使用 `useSWR` 的组件和 hooks

恢复的类型推断：

- ✅ `AppConfig` 类型完全推断
- ✅ `AIConfig[]` 类型完全推断
- ✅ `TranslationMemory` 类型完全推断
- ✅ `TermLibrary` 类型完全推断
- ✅ 所有 SWR 返回值类型推断

**预防措施**:

1. **避免类型覆盖**:
   - 不要创建第三方库的 shim 类型定义
   - 如果类型不匹配，修复实际问题而非隐藏类型
   - 使用 `@ts-expect-error` 注释临时问题，而非全局覆盖类型

2. **类型审查流程**:
   - PR 审查时检查 `*.d.ts` 文件的新增和修改
   - 禁止使用 `any` 类型（通过 ESLint 规则）
   - 定期运行 `tsc --noEmit` 验证类型完整性

3. **依赖官方类型**:
   - 优先使用 `@types/*` 包提供的官方类型
   - 检查库是否已内置 TypeScript 类型（如 SWR 2.x）
   - 如需扩展类型，使用 `declare module` 的 augmentation 而非覆盖

4. **建立类型质量门禁**:

   ```json
   // tsconfig.json
   {
     "compilerOptions": {
       "strict": true,
       "noImplicitAny": true,
       "strictNullChecks": true,
       "noUncheckedIndexedAccess": true
     }
   }
   ```

5. **ESLint 规则**:
   ```json
   // .eslintrc.json
   {
     "rules": {
       "@typescript-eslint/no-explicit-any": "error",
       "@typescript-eslint/ban-types": "error"
     }
   }
   ```

---

### 总结与反思

这两个问题暴露了代码质量保障体系中的重大漏洞：

**P1 问题（CI 静默通过）的教训**:

- CI/CD 是最后一道防线，不能被绕过
- "临时绕过"往往会变成永久性问题
- 质量门禁需要定期审查和验证

**P2 问题（类型安全丢失）的教训**:

- 不要为了快速修复而破坏类型系统
- TypeScript 的价值在于编译时检查，`any` 使其失效
- 技术债务的代价远高于正确修复问题的成本

**改进措施**:

1. 建立 CI 配置审查机制
2. 强制类型安全检查
3. 定期进行代码质量审计
4. 记录并跟踪技术债务

---

## 2025-10-13 - 架构重构后的编译错误

### 问题概述

架构重构（统一命令层 + Draft 模式 + AppDataProvider）后出现 19 个 TypeScript 编译错误和 1 个 Rust 编译错误。

### 错误类型与解决方案

#### 0. Vite 扫描参考项目代码 (运行时错误)

**错误**:

```
X [ERROR] No matching export in "src/services/api.ts" for import "getAxios"
ref/clash-verge-rev/src/pages/_layout.tsx:35:9
```

**原因**: Vite 依赖扫描默认会扫描整个项目目录，包括 `ref/` 参考项目目录

**解决**:

```typescript
// vite.config.ts
export default defineConfig({
  server: {
    watch: {
      ignored: ['**/src-tauri/**', '**/ref/**'], // 排除参考项目
    },
  },
  optimizeDeps: {
    exclude: ['src-tauri', 'ref'],
    entries: ['index.html', 'src/**/*.{ts,tsx}'], // 明确指定源码目录
  },
});
```

**预防措施**:

- 参考项目或示例代码应放在 `ref/` 或 `examples/` 目录
- 在 `.gitignore` 和 `vite.config.ts` 中同时排除这些目录
- 使用 `entries` 明确指定需要扫描的文件模式

---

#### 1. 命令层 API 名称不一致

**错误**:

```typescript
// TS2339: Property 'getAll' does not exist
termLibraryCommands.getAll();
```

**原因**: 重构后命令名称统一为 `get()`，但部分代码仍使用旧名称

**解决**:

```typescript
// 旧
termLibraryApi.getAll();
logApi.getLogs();

// 新
termLibraryCommands.get();
logCommands.get();
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
const { data } = useSWR(KEY, () => logCommands.get() as Promise<string>, { refreshInterval: 2000 });
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
return value; // value: T | undefined
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
sessionCount: stats.total > 0 ? 1 : 0;
```

**原因**: 未检查字段是否存在就直接访问

**解决**:

```typescript
// 错误
sessionCount: stats.total > 0 ? 1 : 0;

// 正确
sessionCount: (stats.total ?? 0) > 0 ? 1 : 0;
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
