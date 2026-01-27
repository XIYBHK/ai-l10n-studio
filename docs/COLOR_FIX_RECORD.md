# 硬编码颜色值修复记录

## 修复时间

2026-01-27

## 问题根源

使用硬编码的颜色值（RGB/HEX）作为内联样式，导致主题切换时无法产生 CSS 过渡动画。

```typescript
// ❌ 错误：React 直接赋值，无法产生过渡
<div style={{ backgroundColor: colors.bgPrimary }}>  // rgb(30, 30, 46)

// ✅ 正确：CSS 变量，可以产生过渡
<div style={{ backgroundColor: 'var(--color-bgPrimary)' }}>
```

## 修复的组件列表

### 1. **EntryList.tsx** ✅

- 添加 `cssColors` 映射（18 个颜色变量）
- 替换所有 `colors.xxx` 为 `cssColors.xxx`
- 移除临时修复的 `THEME_TRANSITION` 常量

### 2. **TranslationWorkspace.tsx** ✅

- 添加 `cssColors` 映射（2 个颜色变量）
- 替换所有 `themeData.colors.xxx` 为 `cssColors.xxx`

### 3. **MenuBar.tsx** ✅

- 添加 `useMemo` 导入
- 添加 `cssColors` 映射（8 个颜色变量）
- 替换所有 `colors.xxx` 为 `cssColors.xxx`

### 4. **EditorPane.tsx** ✅

- 添加 `useMemo` 导入
- 添加 `cssColors` 映射（9 个颜色变量）
- 批量替换所有 `colors.xxx` 为 `cssColors.xxx`

### 5. **TermLibraryManager.tsx** ✅

- 添加 `useMemo` 导入
- 添加 `cssColors` 映射（6 个颜色变量）
- 批量替换所有 `colors.xxx` 为 `cssColors.xxx`

### 6. **TruncatedText.tsx** ✅

- 移除 `useTheme()` 调用
- 直接使用 `'var(--color-textPrimary)'`

### 7. **FileInfoBar.tsx** ✅

- 移除 `useTheme()` 调用
- 直接使用 CSS 变量

### 8. **AIWorkspace.tsx** ✅

- 添加 `useMemo` 导入
- 添加 `cssColors` 映射（10 个颜色变量）
- 批量替换所有 `colors.xxx` 为 `cssColors.xxx`

### 9. **DevToolsThemeProvider.tsx** ✅

- 替换 `themeData.colors.bgPrimary` 为 `'var(--color-bgPrimary)'`

## 修复模式

### 模式 1：复杂组件（多个颜色使用）

```typescript
// 1. 添加 useMemo 导入
import React, { useState, useEffect, useMemo } from 'react';

// 2. 创建 cssColors 映射
const cssColors = useMemo(() => ({
  bgPrimary: 'var(--color-bgPrimary)',
  textPrimary: 'var(--color-textPrimary)',
  // ... 其他颜色
}), []);

// 3. 替换所有 colors.xxx 为 cssColors.xxx
<div style={{ backgroundColor: cssColors.bgPrimary }}>
```

### 模式 2：简单组件（少量颜色使用）

```typescript
// 直接使用 CSS 变量字符串
<div style={{ color: 'var(--color-textPrimary)' }}>
```

## 验证结果

✅ 所有组件已迁移到 CSS 变量系统
✅ 主题切换时所有 UI 区域过渡动画统一为 0.3s
✅ 代码更简洁，移除了冗余的 transition 样式
✅ 不再有硬编码颜色值的问题

## 预防措施

1. **代码审查检查点**：
   - ❌ 不要使用 `colors.xxx` 或 `themeData.colors.xxx`
   - ✅ 使用 `'var(--color-xxx)'` 或 `cssColors.xxx`

2. **新组件开发**：
   - 参考 `docs/COLOR_SYSTEM.md`
   - 优先使用 CSS 变量
   - 避免直接依赖颜色对象

3. **ESLint 规则**（可选）：
   - 可以添加规则禁止 `colors\.\w+` 模式
   - 强制使用 CSS 变量引用

## 相关文档

- `docs/COLOR_SYSTEM.md` - 颜色系统最佳实践
- `docs/THEME.md` - 主题配置指南
- `CHANGELOG.md` - 更新日志

---

## 后续修复记录

### 2026-01-27 - 修复全局过渡规则缺失问题

**问题描述**：

- 代码审查建议优化过于宽泛的全局选择器（`body, div, span, p`）
- 移除这些选择器后，使用内联样式的普通元素失去过渡动画
- Ant Design 组件有过渡（专门的 CSS 规则），但普通 div 元素没有

**解决方案**：

- 保留 `body, div, span, p` 的全局过渡规则
- 原因：大部分组件使用内联样式设置 CSS 变量，需要全局规则支持过渡
- 性能影响可控，优先保证功能完整性

**修改文件**：

- `src/App.css` (第 14-60 行) - 恢复全局元素过渡规则

**经验总结**：

- ⚠️ 代码审查建议需要结合实际情况调整
- ⚠️ 内联样式 + CSS 变量系统需要全局过渡支持
- ⚠️ 审查建议中的"Minor"级别问题可以根据实际情况忽略
