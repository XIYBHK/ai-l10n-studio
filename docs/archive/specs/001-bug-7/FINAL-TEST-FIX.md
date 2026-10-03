# 最终测试修复：api.ts 遗漏的转换逻辑

## 问题发现

首次测试时发现 AI 配置功能仍然失败：

```
[ERROR] [TauriInvoke] ❌ Tauri调用失败: test_ai_connection
{error: 'missing field `apiKey`'}

[ERROR] [TauriInvoke] ❌ Tauri调用失败: add_ai_config
{error: 'missing field `apiKey`'}
```

但日志显示：

```
[DEBUG] [API] 🔄 参数转换: add_ai_config {original: {…}, converted: {…}}
```

## 根因分析

虽然我们已经：

- ✅ 修改了 `tauriInvoke.ts` 默认值为 `false`
- ✅ 修改了 `apiClient.ts` 移除硬编码
- ✅ 清理了 `commands.ts` 等文件的配置

**但是遗漏了 `api.ts`**！

`src/services/api.ts` 第43行仍有：

```typescript
autoConvertParams = true, // 默认启用自动参数转换
```

并且第47-58行有完整的参数转换逻辑：

```typescript
// 🔄 自动参数转换：camelCase → snake_case
let processedArgs = args;
if (autoConvertParams && args) {
  processedArgs = convertKeysToSnakeCase(args as Record<string, any>);
  // ...
}
```

## 调用链分析

```
commands.ts
  ↓ invoke(command, params) - 无 autoConvertParams
api.ts
  ↓ autoConvertParams = true (默认值)
  ↓ 执行参数转换 { apiKey } → { api_key }
apiClient.ts
  ↓ 传递 { api_key } 到 tauriInvoke
tauriInvoke.ts
  ↓ autoConvertParams = false (不再转换)
  ↓ 直接发送 { api_key } 给后端
Tauri Backend
  ✗ 期望 { apiKey }（camelCase），收到 { api_key }
  ✗ 报错：missing field `apiKey`
```

## 修复方案

### 1. 移除默认值

```typescript
// 修改前
autoConvertParams = true, // 默认启用自动参数转换

// 修改后
autoConvertParams, // 🎯 不设默认值，让 apiClient → tauriInvoke 处理
```

### 2. 移除转换逻辑

```typescript
// 修改前
try {
  // 🔄 自动参数转换：camelCase → snake_case
  let processedArgs = args;
  if (autoConvertParams && args) {
    processedArgs = convertKeysToSnakeCase(args as Record<string, any>);
    log.debug(`🔄 参数转换: ${command}`, { ... });
  }

  const result = await apiClient.invoke<T>(command, processedArgs, {
    timeout, retry, ...
  });
}

// 修改后
try {
  if (!silent) {
    log.debug(`📤 API调用: ${command}`, args);
  }

  const result = await apiClient.invoke<T>(command, args, {
    timeout, retry, ...,
    autoConvertParams, // 🎯 透传给 apiClient
  });
}
```

### 3. 移除未使用的导入

```typescript
// 修改前
import { convertKeysToSnakeCase } from '../utils/paramConverter';

// 修改后
// 已删除
```

## 验证结果

```bash
✓ npm run build - 编译通过
✓ npm run format - 代码格式化完成
```

## 经验总结

### 为什么会遗漏？

1. **调用链层次多**：`commands.ts → api.ts → apiClient.ts → tauriInvoke.ts`
2. **中间层被忽视**：重点关注了最底层（`tauriInvoke`）和最上层（`commands`），忽略了中间层
3. **grep 不全面**：只搜索了 `autoConvertParams: false`，没搜索 `autoConvertParams = true`

### 改进方法

搜索时应该覆盖所有模式：

```bash
# ✅ 正确的搜索方式
grep -r "autoConvertParams" src/

# 而不只是
grep -r "autoConvertParams: false" src/
```

### 测试驱动修复

这次修复再次证明了**测试的重要性**：

1. ✅ 编译检查 - 发现类型错误
2. ✅ 手动测试 - 发现运行时错误
3. 🔍 日志分析 - 定位具体问题

如果没有手动测试，这个问题会在生产环境暴露！

## 最终状态

### 参数转换处理链（修复后）

```
commands.ts
  ↓ invoke(command, { apiKey }) - 无配置
api.ts
  ↓ autoConvertParams = undefined - 透传
apiClient.ts
  ↓ autoConvertParams = undefined - 透传
tauriInvoke.ts
  ↓ autoConvertParams = false (默认值)
  ↓ 保持 { apiKey } 不转换
Tauri Backend
  ✓ 收到 { apiKey }（camelCase）
  ✓ 成功反序列化
```

### 零配置，全链路统一

现在整个调用链只有 `tauriInvoke.ts` 一处定义默认值，其他层全部透传，实现了真正的**单一真相源**。

## 更新文档

- [x] `docs/CHANGELOG.md` - 添加补充修复说明
- [x] 新增本文档 - 记录测试发现的问题

## 下一步

重新启动开发服务器，再次测试 AI 配置功能。
