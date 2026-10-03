# 颜色系统

全局设计 token 的唯一来源是 [`src/index.css`](../src/index.css)。`App.css`、CSS module 和组件样式不得重复定义同名 `--color-*`、`--radius-*`、`--shadow-*` 或 `--duration-*`。

自定义组件使用 `CSS_COLORS`（[`src/hooks/useCssColors.ts`](../src/hooks/useCssColors.ts)）或 CSS 变量：

```tsx
<div style={{ backgroundColor: CSS_COLORS.bgPrimary }} />
```

```css
.card {
  color: var(--color-textPrimary);
  border-color: var(--color-borderPrimary);
}
```

Ant Design 组件使用 `src/theme/config.ts` 的主题 token。不要在 JSX 中重复写应用色板字面量，也不要用全局 CSS 覆盖组件库 token 来修正单个组件。

`src/index.css` 为 `:root` 和 `[data-theme='dark']` 提供浅色、暗色变量，包含状态、交互和翻译来源 token；具体值以源码为准。

新增或修改样式后，检查两套主题、键盘焦点、文字对比度和减少动画偏好。主题切换行为见 [`docs/THEME.md`](THEME.md)。
