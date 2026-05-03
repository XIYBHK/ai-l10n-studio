# 主题配置指南

## 概述

项目使用 [Catppuccin](https://catppuccin.com/) 配色方案（Latte 浅 + Mocha 暗），所有颜色集中在 `src/theme/config.ts` 管理，通过 Ant Design `ConfigProvider` 分发到所有组件。

## 架构分层

```
palette (原始色)
  │
  ├─ lightTheme / darkTheme  →  Ant Design ConfigProvider  →  Antd 组件（Button/Input/Table...）
  │
  └─ semanticColors          →  useCssColors / CSS_COLORS  →  自定义组件（内联样式）
  │
  └─ (CSS 镜像)              →  src/index.css :root        →  CSS 模块 / 全局样式
```

## palette 结构（src/theme/config.ts）

```typescript
const palette = {
  primary: '#cba6f7',        // Mauve — 品牌主色
  accent: '#89b4fa',         // Blue  — 强调色（链接、非状态高亮）
  needsReview: '#fab387',    // Peach — 待确认状态色（2026-05 新增，从 accent 解耦）
  successLight: '#166534',   // 深绿（浅色模式已翻译）
  successDark:  '#a6e3a1',   // 亮绿（暗色模式已翻译）
  warning: '#f9e2af',        // Yellow
  error:   '#ed8796',        // Red
  info:    '#89b4fa',

  light: {
    bgBase:      '#e6e9ef',  // Mantle
    bgContainer: '#e6e9ef',
    bgElevated:  '#dce0e8',  // Overlay 1
    border:      '#ccd0da',
    textPrimary: '#4c4f69',
    // ...
  },
  dark: {
    bgBase:      '#1e1e2e',  // Base
    bgContainer: '#313244',  // Surface 0
    bgElevated:  '#45475a',  // Surface 1
    // ...
  },
};
```

### 为什么 `needsReview` 从 `accent` 解耦

历史：`semanticColors.statusNeedsReview` 直接绑定 `palette.accent`（蓝色）。

问题：蓝色视觉语义是"正常/稳定"，但"待确认"意味着**需人工审核**。用户看到蓝色标记误以为一切 OK。

修复：新增 `palette.needsReview: '#fab387'` Peach（琥珀桃色），`semanticColors` 引用这个独立字段。`accent` 保留给链接、特殊强调等场景。

## 使用指南

### 1. Antd 组件（首选）

直接使用 Antd 组件，主题自动应用：

```tsx
import { Button, Input, Table } from 'antd';

<Button type="primary">主按钮</Button>  {/* 自动使用 palette.primary */}
<Input placeholder="..." />            {/* 自动使用 palette.xxx.bgContainer */}
```

**优点**：

- 无需写 CSS
- 自动适配主题切换
- 自动处理 hover/active/disabled 状态

### 2. 自定义组件

```tsx
import { CSS_COLORS } from '../hooks/useCssColors';

<div style={{
  backgroundColor: CSS_COLORS.bgPrimary,
  color: CSS_COLORS.textPrimary,
  border: `1px solid ${CSS_COLORS.borderPrimary}`,
}}>
```

或在 CSS 模块中：

```css
.card {
  background: var(--color-bgPrimary);
  color: var(--color-textPrimary);
  border: 1px solid var(--color-borderPrimary);
}
```

### 3. 禁止的做法

- 硬编码颜色：`style={{ backgroundColor: '#fff' }}`
- 全局 CSS 覆盖（除非特殊场景如 scrollbar）
- 在组件内定义 `--color-*` token

## 修改颜色的正确流程

1. 改 `src/theme/config.ts` 的 `palette` 字段
2. 确认 `lightTheme` / `darkTheme` / `semanticColors` 都引用新值
3. **同步** `src/index.css` 对应的 `--color-*` CSS 变量（如果是新增 token）
4. 同步更新 `src/hooks/useCssColors.ts` 的 `CssColors` 类型和 `CSS_COLORS` 对象（如果是新增）
5. 重启开发服务器验证

## 组件级 Antd Token 配置

```typescript
export const lightTheme: ThemeConfig = {
  token: {
    colorPrimary: palette.primary,
    borderRadius: 8,
    fontFamily: 'var(--body-font)',
    motionDurationFast: '0.1s',
    motionDurationMid: '0.2s',
    motionDurationSlow: '0.3s',
  },
  components: {
    Button: {
      controlHeight: 32,
      defaultBg: palette.light.bgContainer,
      defaultHoverBg: palette.light.bgElevated,
    },
    Input: {
      colorBgContainer: palette.light.bgContainer,
      hoverBorderColor: palette.light.border,
    },
    Table: {
      headerBg: palette.light.bgElevated,
      rowHoverBg: palette.light.bgElevated,
    },
    Modal: {
      contentBg: palette.light.bgContainer,
    },
    // ...
  },
};
```

## 主题切换机制

1. 用户切换 → `useTheme` hook 更新 Zustand store `theme` 字段
2. `useTheme` 在 `<html>` 设 `data-theme="dark"` 属性
3. CSS `:root` 和 `[data-theme='dark']` 块的 `--color-*` 自动切换
4. `ConfigProvider` 收到新 `theme` prop → Antd 组件重新渲染
5. 全局 CSS transition 使颜色平滑过渡（0.3s cubic-bezier）

## 故障排查

### 颜色没有生效

- 检查组件是否被 `ConfigProvider` 包裹（在 `AppShell.tsx`）
- 检查是否有内联样式硬编码覆盖
- 检查是否误用了旧的 `themeData.colors` 对象（迁移至 `CSS_COLORS`）

### 不同组件颜色不一致

- 检查是否都使用 Antd 组件或 `CSS_COLORS` 常量
- 检查 `ThemeConfig.components` 配置是否覆盖某些子 token
- 确认没有在 `App.css` 或 CSS 模块里重复定义同名 token（SSOT 原则）

## 参考

- Catppuccin 官网：<https://catppuccin.com/>
- Ant Design 主题定制：<https://ant.design/docs/react/customize-theme-cn>
- Ant Design Token 文档：<https://ant.design/docs/react/theme-token>
- 项目色彩详细规范：`docs/COLOR_SYSTEM.md`
