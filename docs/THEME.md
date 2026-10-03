# 主题配置指南

项目使用 Catppuccin 风格，并通过 Ant Design 6 `ConfigProvider` 提供组件主题。`src/theme/config.ts` 提供 Ant Design 主题对象和语义色，`src/index.css` 提供全局 CSS token。

## 修改入口

- Ant Design token：编辑 `src/theme/config.ts` 的 `lightTheme`、`darkTheme` 或组件级配置。
- 自定义组件颜色：使用 `CSS_COLORS`（`src/hooks/useCssColors.ts`）或 `var(--color-*)`。
- 全局 token：只在 `src/index.css` 修改；不要在 `App.css` 或组件 CSS 中重复定义同名 token。

## 切换行为

`useTheme` 从 Zustand 读取 `light`、`dark` 或 `system`，计算 `appliedTheme` 并返回主题配置和 actions。它没有全局副作用，菜单和设置控件可同时使用。

主窗口只在 `AppShell` 调用一次 `useThemeRuntime`：监听 `prefers-color-scheme`、更新 `<html>` 与 `<body>` 的 `data-theme`、更新根元素 class，并发送 `theme:changed`。独立开发工具窗口接收主题模式及实际明暗值；异步注册在卸载后完成时立即注销。

CSS 通过 `:root` 与 `[data-theme='dark']` 提供两套 `--color-*` 值；全局过渡和减少动画偏好也在 `src/index.css` 中定义。

## 约束

- 不在组件中硬编码色值或重复定义 `--color-*`、`--radius-*`、`--shadow-*`、`--duration-*`。
- Ant Design 组件使用组件库 token；自定义布局使用 CSS token。
- 新增颜色时检查浅色、暗色、对比度和键盘焦点。

相关文件：[颜色系统](COLOR_SYSTEM.md)、[`src/theme/config.ts`](../src/theme/config.ts)、[`src/hooks/useTheme.ts`](../src/hooks/useTheme.ts)、[`src/index.css`](../src/index.css)。
