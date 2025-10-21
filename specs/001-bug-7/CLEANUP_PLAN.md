# 系统性清理计划：移除冗余的 `autoConvertParams: false`

## 背景

架构决策：`tauriInvoke.ts` 默认值已改为 `false`，所有手动设置的 `autoConvertParams: false` 都是冗余代码。

## 清理清单

### 文件1: `src/services/commands.ts` (13处)

- [ ] Line 159: `aiConfigCommands.setActive`
- [ ] Line 171: `aiConfigCommands.add`
- [ ] Line 183: `aiConfigCommands.update`
- [ ] Line 200: `aiConfigCommands.delete`
- [ ] Line 227: `aiConfigCommands.testConnection`
- [ ] Line 407: `poFileCommands.parse`
- [ ] Line 418: `poFileCommands.save`
- [ ] Line 434: `fileFormatCommands.detect`
- [ ] Line 445: `fileFormatCommands.getMetadata`
- [ ] Line 498: `translatorCommands.contextualRefine`
- [ ] Line 591: `i18nCommands.getDefaultTargetLanguage`

### 文件2: `src/services/api.ts` (1处)

- [ ] Line 72: `invoke` 调用

### 文件3: `src/hooks/useChannelTranslation.ts` (1处)

- [ ] Line 182: `translate_batch_with_channel` 调用

### 文件4: `src/services/swr.ts` (2处)

- [ ] Line 20: `tauriFetcher` - isTauriKey 分支
- [ ] Line 28: `tauriFetcher` - string 分支

### 文件5: `src/services/configSync.ts` (1处)

- [ ] Line 104: `get_config_version` 调用

## 清理原则

1. **完全移除**：删除整个 `autoConvertParams: false` 行
2. **保留注释**：保留解释为什么使用 camelCase 的注释
3. **简化代码**：如果 options 对象只剩下一个属性，考虑简化格式

### 清理前：

```typescript
invoke(command, params, {
  errorMessage: '错误消息',
  autoConvertParams: false, // 🔧 禁用转换
});
```

### 清理后：

```typescript
invoke(command, params, {
  errorMessage: '错误消息',
  // camelCase 格式已是默认行为
});
```

## 验证步骤

清理完成后：

1. `npm run build` - 确保前端编译通过
2. `cargo check` - 确保后端编译通过
3. 手动测试关键功能（AI配置、翻译、文件操作）

## 预期成果

- 减少代码行数：约 20 行
- 提高代码可读性：移除重复的架构说明
- 统一架构约定：默认行为一目了然
