# 主题配置指南

项目使用中性的石墨灰、柔和的浅色背景与青绿色操作强调色，通过 Ant Design 6 `ConfigProvider` 提供组件主题。早期紫色是 AI 的设计选择，不是用户指定的品牌约束；2026-10-04 按用户要求重新优化界面。

`src/index.css` 是颜色、字体、圆角、阴影和时长 token 的唯一来源。`src/theme/config.ts` 通过 Vite 的 `?inline` 导入同一份 CSS，解析浅深主题变量，为 Ant Design 色板算法提供实际值；不读取或修改 DOM，也不维护第二份色板。

## 修改入口

- 配色及设计 token：编辑 `src/index.css`。两种 Ant Design 主题从这些值生成；不要在 `config.ts` 复制色板。
- Ant Design 组件映射：编辑 `src/theme/config.ts` 的组件级配置。
- 自定义组件颜色：使用 `CSS_COLORS`（`src/hooks/useCssColors.ts`）或 `var(--color-*)`。
- 全局 token：只在 `src/index.css` 修改；不要在 `App.css` 或组件 CSS 中重复定义同名 token。

## 切换行为

`useTheme` 从 Zustand 读取 `light`、`dark` 或 `system`，计算 `appliedTheme` 并返回主题配置和 actions。它没有全局副作用，菜单和设置控件可同时使用。

主窗口只在 `AppShell` 调用一次 `useThemeRuntime`：监听 `prefers-color-scheme` 并发送 `theme:changed`。每个窗口通过 `useThemeDocument` 在 layout effect 中同步 `<html>`、`<body>` 的 `data-theme` 和根元素 class，在浏览器绘制前保持 React token 与 CSS token 一致。独立开发工具窗口只读加载持久化偏好，接收主题和语言事件，不向磁盘回写；异步注册在卸载后完成时立即注销。

CSS 通过 `:root` 与 `[data-theme='dark']` 提供两套 `--color-*` 值。主题切换的两个绘制帧内统一禁用 CSS transition，避免文字/背景经过不同的中间颜色；普通按钮 hover 动画仍保留。减少动画偏好也在 `src/index.css` 中定义。

`darkTheme` 使用 Ant Design 的 `darkAlgorithm`，再映射项目 token；亮暗主题都明确设置占位文字颜色及主按钮前景色。主窗口和开发工具的 `ConfigProvider` 都传入 `getStyleCsp()` 返回的 Tauri nonce 和当前语言的 Ant Design locale，使动态组件样式通过生产 CSP，表单反馈与界面语言一致。消息提示必须使用 `App.useApp()`，不能使用会创建独立 React 根的静态 `message` API。原生验证和截图见 [UIRuntimeAudit.md](UIRuntimeAudit.md) 与 [UIRefinement.md](UIRefinement.md)。

## 约束

- 不在组件中硬编码色值或重复定义 `--color-*`、`--radius-*`、`--shadow-*`、`--duration-*`。
- Ant Design 组件使用组件库 token；自定义布局使用 CSS token。
- 新增颜色时检查浅色、暗色、对比度和键盘焦点。

相关文件：[颜色系统](COLOR_SYSTEM.md)、[`src/theme/config.ts`](../src/theme/config.ts)、[`src/hooks/useTheme.ts`](../src/hooks/useTheme.ts)、[`src/index.css`](../src/index.css)。
