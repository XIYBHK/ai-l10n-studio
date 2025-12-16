import { ThemeConfig } from 'antd';

// 🎨 现代配色方案 (Tailwind Zinc/Slate/Blue 灵感)
const palette = {
  primary: '#3b82f6', // Blue 500
  success: '#22c55e', // Green 500
  warning: '#eab308', // Yellow 500
  error: '#ef4444', // Red 500
  info: '#3b82f6', // Blue 500

  // Light Mode Grays (Slate)
  light: {
    bgBase: '#ffffff',
    bgLayout: '#f8fafc', // Slate 50
    bgContainer: '#ffffff',
    border: '#e2e8f0', // Slate 200
    borderSecondary: '#f1f5f9', // Slate 100
    textPrimary: '#0f172a', // Slate 900
    textSecondary: '#475569', // Slate 600
    textTertiary: '#94a3b8', // Slate 400
  },

  // Dark Mode Grays (Zinc)
  dark: {
    bgBase: '#18181b', // Zinc 950
    bgLayout: '#09090b', // Zinc 950 (Darker)
    bgContainer: '#18181b', // Zinc 900
    bgElevated: '#27272a', // Zinc 800
    border: '#27272a', // Zinc 800
    borderSecondary: '#3f3f46', // Zinc 700
    textPrimary: '#f4f4f5', // Zinc 100
    textSecondary: '#a1a1aa', // Zinc 400
    textTertiary: '#52525b', // Zinc 600
  },
};

// 通用 Token 配置
const commonTokens = {
  colorPrimary: palette.primary,
  colorSuccess: palette.success,
  colorWarning: palette.warning,
  colorError: palette.error,
  colorInfo: palette.info,
  borderRadius: 6, // 更现代的圆角
  fontFamily:
    "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif",
  wireframe: false,
};

// ☀️ 亮色主题配置
export const lightTheme: ThemeConfig = {
  token: {
    ...commonTokens,
    colorBgBase: palette.light.bgBase,
    colorBgContainer: palette.light.bgContainer,
    colorBgLayout: palette.light.bgLayout,
    colorText: palette.light.textPrimary,
    colorTextSecondary: palette.light.textSecondary,
    colorTextTertiary: palette.light.textTertiary,
    colorBorder: palette.light.border,
    colorBorderSecondary: palette.light.borderSecondary,
    // 阴影优化
    boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05), 0 1px 3px 1px rgba(0, 0, 0, 0.1)',
    boxShadowSecondary: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
  },
  components: {
    Layout: {
      headerBg: palette.light.bgContainer,
      bodyBg: palette.light.bgLayout,
      siderBg: palette.light.bgLayout,
    },
    Button: {
      controlHeight: 32,
      borderRadius: 6,
      defaultShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
      primaryShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    },
    Input: {
      activeShadow: '0 0 0 2px rgba(59, 130, 246, 0.1)', // 细腻的 Focus Ring
    },
    Table: {
      headerBg: palette.light.bgLayout,
      headerColor: palette.light.textSecondary,
      borderColor: palette.light.borderSecondary,
    },
  },
};

// 🌙 暗色主题配置
export const darkTheme: ThemeConfig = {
  token: {
    ...commonTokens,
    colorBgBase: palette.dark.bgBase,
    colorBgContainer: palette.dark.bgContainer,
    colorBgLayout: palette.dark.bgLayout,
    colorBgElevated: palette.dark.bgElevated,
    colorText: palette.dark.textPrimary,
    colorTextSecondary: palette.dark.textSecondary,
    colorTextTertiary: palette.dark.textTertiary,
    colorBorder: palette.dark.border,
    colorBorderSecondary: palette.dark.borderSecondary,
    colorSplit: palette.dark.border, // 分割线颜色
  },
  components: {
    Layout: {
      headerBg: palette.dark.bgBase,
      bodyBg: palette.dark.bgLayout,
      siderBg: palette.dark.bgBase,
    },
    Modal: {
      contentBg: palette.dark.bgElevated,
      headerBg: palette.dark.bgElevated,
    },
    Table: {
      headerBg: palette.dark.bgElevated,
      headerColor: palette.dark.textSecondary,
      borderColor: palette.dark.border,
      rowHoverBg: palette.dark.bgElevated,
    },
    Input: {
      activeBg: 'transparent',
      activeShadow: '0 0 0 2px rgba(59, 130, 246, 0.2)',
    },
    Button: {
      defaultBg: palette.dark.bgElevated,
      defaultBorderColor: palette.dark.borderSecondary,
    },
  },
};

// 🎨 语义化颜色系统 - 用于自定义组件样式
export const semanticColors = {
  light: {
    // 背景色
    bgPrimary: palette.light.bgContainer,
    bgSecondary: palette.light.bgLayout,
    bgTertiary: '#f1f5f9', // Slate 100 - 用于表头、工具栏

    // 文本色
    textPrimary: palette.light.textPrimary,
    textSecondary: palette.light.textSecondary,
    textTertiary: palette.light.textTertiary,
    textDisabled: '#cbd5e1', // Slate 300

    // 边框色
    borderPrimary: palette.light.border,
    borderSecondary: palette.light.borderSecondary,

    // 状态色
    statusUntranslated: '#3b82f6', // Blue 500
    statusNeedsReview: '#f59e0b', // Amber 500 (更温和的橙色)
    statusTranslated: '#10b981', // Emerald 500 (更鲜艳的绿色)

    // 交互色
    hoverBg: '#f8fafc', // Slate 50
    activeBg: '#eff6ff', // Blue 50
    selectedBg: '#eff6ff', // Blue 50
    selectedBorder: '#3b82f6', // Blue 500
  },
  dark: {
    // 背景色
    bgPrimary: palette.dark.bgBase,
    bgSecondary: palette.dark.bgLayout,
    bgTertiary: palette.dark.bgElevated, // 用于表头、工具栏

    // 文本色
    textPrimary: palette.dark.textPrimary,
    textSecondary: palette.dark.textSecondary,
    textTertiary: palette.dark.textTertiary,
    textDisabled: '#52525b', // Zinc 600

    // 边框色
    borderPrimary: palette.dark.border,
    borderSecondary: palette.dark.borderSecondary,

    // 状态色
    statusUntranslated: '#60a5fa', // Blue 400
    statusNeedsReview: '#fbbf24', // Amber 400
    statusTranslated: '#34d399', // Emerald 400

    // 交互色
    hoverBg: '#27272a', // Zinc 800
    activeBg: 'rgba(59, 130, 246, 0.15)', // Blue with opacity
    selectedBg: 'rgba(59, 130, 246, 0.15)',
    selectedBorder: '#60a5fa', // Blue 400
  },
};
