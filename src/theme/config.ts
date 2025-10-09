import { ThemeConfig } from 'antd';

// 亮色主题
export const lightTheme: ThemeConfig = {
  token: {
    colorPrimary: '#1890ff',
    colorSuccess: '#52c41a',
    colorWarning: '#faad14',
    colorError: '#f5222d',
    colorInfo: '#1890ff',
    colorBgBase: '#ffffff',
    colorTextBase: '#000000',
    borderRadius: 4,
  },
  components: {
    Layout: {
      headerBg: '#ffffff',
      bodyBg: '#f0f2f5',
      siderBg: '#ffffff',
    },
  },
};

// 暗色主题
export const darkTheme: ThemeConfig = {
  token: {
    colorPrimary: '#1890ff',
    colorSuccess: '#52c41a',
    colorWarning: '#faad14',
    colorError: '#f5222d',
    colorInfo: '#1890ff',
    colorBgBase: '#141414',
    colorTextBase: '#ffffff',
    borderRadius: 4,
    // 优化暗色模式的背景和文字颜色
    colorBgContainer: '#1f1f1f',
    colorBgElevated: '#262626',
    colorBgLayout: '#141414',
    colorBorder: '#434343',
    colorBorderSecondary: '#303030',
  },
  components: {
    Layout: {
      headerBg: '#1f1f1f',
      bodyBg: '#141414',
      siderBg: '#1f1f1f',
    },
    Modal: {
      contentBg: '#1f1f1f',
      headerBg: '#1f1f1f',
    },
    Table: {
      headerBg: '#262626',
      rowHoverBg: '#262626',
    },
    Input: {
      activeBg: '#1f1f1f',
    },
  },
};

// 语义化颜色系统
export const semanticColors = {
  light: {
    // 背景色
    bgPrimary: '#ffffff',
    bgSecondary: '#f0f2f5',
    bgTertiary: '#fafafa',
    
    // 文本色
    textPrimary: 'rgba(0, 0, 0, 0.88)',
    textSecondary: 'rgba(0, 0, 0, 0.65)',
    textTertiary: 'rgba(0, 0, 0, 0.45)',
    textDisabled: 'rgba(0, 0, 0, 0.25)',
    
    // 边框色
    borderPrimary: '#d9d9d9',
    borderSecondary: '#f0f0f0',
    
    // 状态色
    statusUntranslated: '#1890ff',
    statusNeedsReview: '#faad14',
    statusTranslated: '#52c41a',
    
    // 交互色
    hoverBg: '#f5f5f5',
    activeBg: '#e6f7ff',
    selectedBg: '#e6f7ff',
    selectedBorder: '#1890ff',
  },
  dark: {
    // 背景色
    bgPrimary: '#141414',
    bgSecondary: '#1f1f1f',
    bgTertiary: '#262626',
    
    // 文本色
    textPrimary: 'rgba(255, 255, 255, 0.88)',
    textSecondary: 'rgba(255, 255, 255, 0.65)',
    textTertiary: 'rgba(255, 255, 255, 0.45)',
    textDisabled: 'rgba(255, 255, 255, 0.25)',
    
    // 边框色
    borderPrimary: '#434343',
    borderSecondary: '#303030',
    
    // 状态色
    statusUntranslated: '#1890ff',
    statusNeedsReview: '#faad14',
    statusTranslated: '#52c41a',
    
    // 交互色
    hoverBg: '#262626',
    activeBg: '#111b26',
    selectedBg: '#111b26',
    selectedBorder: '#1890ff',
  },
};

