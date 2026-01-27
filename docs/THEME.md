# 主题配置指南

## 概述

项目使用 Catppuccin 配色方案（GitHub 10k+ stars），所有颜色集中在 `src/theme/config.ts` 管理。

## 配置原则

### 1. 单一真相源

所有颜色定义在 `palette` 对象中，修改颜色只需改这一个地方：

```typescript
const palette = {
  primary: '#cba6f7', // Mauve
  light: {
    bgBase: '#e6e9ef', // Mantle
    bgContainer: '#e6e9ef',
    bgElevated: '#dce0e8', // Overlay 1
    // ...
  },
  dark: {
    bgBase: '#1e1e2e', // Base
    // ...
  },
};
```

### 2. 优先使用 Ant Design Token

**Ant Design 组件（Button、Input、Table 等）**通过 `ThemeConfig.components` 配置样式：

```typescript
export const lightTheme: ThemeConfig = {
  token: {
    colorBgContainer: palette.light.bgContainer,
    // ...
  },
  components: {
    Button: {
      defaultBg: palette.light.bgContainer,
      defaultColor: palette.light.textPrimary,
      // ...
    },
    Input: {
      colorBgContainer: palette.light.bgContainer,
      // ...
    },
  },
};
```

**优点**：

- 无需写 CSS
- 自动适配主题切换
- 支持所有状态（hover、active、disabled）

### 3. 自定义组件使用 semanticColors

对于需要特殊样式的自定义组件，使用 `semanticColors`：

```typescript
import { semanticColors } from '@/theme/config';
const { colors } = useTheme();

<div style={{ backgroundColor: colors.bgPrimary }}>
```

### 4. 禁止的做法

**不要**：

- 使用硬编码颜色值 `style={{ backgroundColor: '#fff' }}`
- 使用全局 CSS 覆盖（除非特殊场景）
- 在组件中直接定义颜色

## 配置层次

```
palette (原始颜色)
   ↓
lightTheme/darkTheme (Ant Design 主题配置)
   ↓ ConfigProvider
Ant Design 组件 (自动应用)
   ↓
semanticColors (自定义组件)
   ↓ useTheme hook
自定义组件 (手动应用)
```

## 常用组件配置

### Button 组件

```typescript
Button: {
  defaultBg: palette.light.bgContainer,
  defaultColor: palette.light.textPrimary,
  defaultBorderColor: palette.light.border,
  defaultHoverBg: palette.light.bgElevated,
  disabledBg: palette.light.bgContainer,
  disabledColor: palette.light.textTertiary,
}
```

### Input 组件

```typescript
Input: {
  colorBgContainer: palette.light.bgContainer,
  colorBorder: palette.light.border,
  hoverBorderColor: palette.light.border,
}
```

### Table 组件

```typescript
Table: {
  headerBg: palette.light.bgElevated,
  cellBg: palette.light.bgContainer,
  rowHoverBg: palette.light.bgElevated,
}
```

## 修改颜色的正确流程

1. 修改 `palette` 中的颜色值
2. 确认 `lightTheme` 和 `darkTheme` 引用了正确的 palette 值
3. 确认 `semanticColors` 引用了正确的 palette 值
4. 重启开发服务器查看效果

## 故障排查

### 颜色没有生效？

1. 检查组件是否被 `ConfigProvider` 包裹
2. 检查是否有内联样式覆盖
3. 检查是否有全局 CSS 覆盖
4. 清除浏览器缓存

### 不同组件颜色不一致？

1. 检查是否都使用 Ant Design 组件
2. 检查 `ThemeConfig.components` 配置是否完整
3. 检查 `semanticColors` 是否同步更新

## 参考

- [Catppuccin 官网](https://catppuccin.com/)
- [Ant Design 主题定制](https://ant.design/docs/react/customize-theme-cn)
- [Ant Design Token 文档](https://ant.design/docs/react/theme-token)
