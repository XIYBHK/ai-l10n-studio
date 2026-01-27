# 颜色系统最佳实践

## 核心原则

### 1. 使用 CSS 变量而非硬编码值

**❌ 错误示例**：

```typescript
// 组件中使用硬编码颜色值
const style = {
  backgroundColor: colors.bgPrimary, // rgb(30, 30, 46)
  color: colors.textPrimary, // rgb(205, 214, 244)
};
```

**✅ 正确示例**：

```typescript
// 使用 CSS 变量引用
const style = {
  backgroundColor: 'var(--color-bgPrimary)',
  color: 'var(--color-textPrimary)',
};
```

### 2. 统一的颜色变量定义

所有颜色变量在 `useTheme` hook 中统一设置：

```typescript
// src/hooks/useTheme.ts
Object.entries(currentColors).forEach(([key, value]) => {
  root.style.setProperty(`--color-${key}`, value as string);
});
```

可用的颜色变量（以 `--color-` 开头）：

- `--color-bgPrimary` / `--color-bgSecondary` / `--color-bgTertiary`
- `--color-textPrimary` / `--color-textSecondary` / `--color-textTertiary` / `--color-textDisabled`
- `--color-borderPrimary` / `--color-borderSecondary`
- `--color-statusUntranslated` / `--color-statusNeedsReview` / `--color-statusTranslated`
- `--color-hoverBg` / `--color-selectedBg` / `--color-selectedBorder`

### 3. 过渡动画配置

**全局 CSS 规则**（App.css）：

```css
:root {
  --theme-transition-duration: 0.3s;
  --theme-transition-timing: cubic-bezier(0.645, 0.045, 0.355, 1);
}
```

**组件中无需设置 transition**：

- 使用 CSS 变量的元素会自动继承全局过渡配置
- 不需要手动添加 `transition` 样式
- 特殊情况（如拖拽调整）除外

## 实施指南

### 新组件开发

1. **创建 CSS 变量映射**：

```typescript
const cssColors = {
  bgPrimary: 'var(--color-bgPrimary)',
  textPrimary: 'var(--color-textPrimary)',
  // ... 其他需要的颜色
};
```

2. **在样式中使用**：

```typescript
<div style={{
  backgroundColor: cssColors.bgPrimary,
  color: cssColors.textPrimary,
}}>
```

### 现有组件迁移

1. 检查是否使用了 `themeData.colors` 或 `colors` 对象
2. 创建 `cssColors` 映射
3. 全局替换 `colors.xxx` → `cssColors.xxx`
4. 移除手动添加的 `transition` 样式（除非有特殊需求）

## 常见陷阱

### ❌ 不要这样做

```typescript
// 1. 直接使用 colors 对象
<div style={{ background: colors.bgPrimary }}>

// 2. 在每个元素上手动设置 transition
<div style={{ transition: 'background-color 0.3s' }}>

// 3. 混用硬编码值和 CSS 变量
<div style={{ background: '#fff', color: 'var(--color-text)' }}>
```

### ✅ 应该这样做

```typescript
// 1. 使用 CSS 变量映射
const cssColors = { bgPrimary: 'var(--color-bgPrimary)' };
<div style={{ background: cssColors.bgPrimary }}>

// 2. 依赖全局 CSS 过渡规则
<div style={{ background: cssColors.bgPrimary }}>  // 自动过渡

// 3. 统一使用 CSS 变量
<div style={{ background: cssColors.bg, color: cssColors.text }}>
```

## 特殊场景

### 需要禁用过渡的场景

如拖拽调整时需要禁用 width 过渡：

```typescript
<div style={{
  transition: isResizing
    ? 'none'  // 拖拽时禁用所有过渡
    : undefined,  // 否则使用全局规则
}>
```

### 动态颜色计算

某些颜色需要运行时计算（如透明度）：

```typescript
// 使用 CSS 变量 + 自定义属性
<div style={{
  backgroundColor: `var(--color-bgPrimary)80`,  // 50% 透明度
}>
```

## 检查清单

组件开发完成后，检查：

- [ ] 是否使用 CSS 变量而非硬编码颜色值？
- [ ] 是否移除了不必要的 `transition` 样式？
- [ ] 是否在主题切换时测试了过渡效果？
- [ ] 是否在亮色/暗色模式下都测试了？

## 工具函数

可以创建辅助函数简化 CSS 变量映射：

```typescript
// src/utils/cssVars.ts
export const createCssColors = (keys: string[]) => {
  return keys.reduce(
    (acc, key) => {
      acc[key] = `var(--color-${key})`;
      return acc;
    },
    {} as Record<string, string>
  );
};

// 使用
const cssColors = createCssColors(['bgPrimary', 'textPrimary', 'borderPrimary']);
```

## 参考资源

- [CSS Custom Properties (MDN)](https://developer.mozilla.org/en-US/docs/Web/CSS/Using_CSS_custom_properties)
- [CSS Transitions (MDN)](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Transitions)
- 项目主题配置：`src/theme/config.ts`
- 主题 Hook：`src/hooks/useTheme.ts`
