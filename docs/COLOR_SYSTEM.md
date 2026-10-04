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

Ant Design 组件使用 `src/theme/config.ts` 从同一份 CSS 解析生成的主题 token。不要在 JSX 或主题配置中重复写应用色板字面量，也不要用全局 CSS 覆盖组件库 token 来修正单个组件。

`src/index.css` 为 `:root` 和 `[data-theme='dark']` 提供浅色、暗色变量，包含状态、交互和翻译来源 token；具体值以源码为准。

新增或修改样式后，检查两套主题、键盘焦点、文字对比度和减少动画偏好。主题切换行为见 [`docs/THEME.md`](THEME.md)。

当前浅色主操作色为 `#0f766e`，深色为 `#5eead4`；这是一轮工具界面优化的设计选择，不是用户品牌定义。未翻译状态使用中性灰，待确认使用琥珀色，已翻译使用绿色，同时保留文字状态。翻译来源文字与各自底色在两套主题中均需达到 4.5:1；自动检查位于 `src/__tests__/theme/config.test.ts`。
