import type { ThemeConfig } from 'antd';
import { theme } from 'antd';
import tokenCss from '../index.css?inline';

// Ant Design's palette algorithm needs resolved values, not CSS var() references.
// Read the bundled token stylesheet so both systems share one source of truth.
function createTheme(mode: 'light' | 'dark'): ThemeConfig {
  const root = tokenCss.match(/:root\s*\{([\s\S]*?)\}/)?.[1] ?? '';
  const dark = tokenCss.match(/\[data-theme=['"]?dark['"]?\]\s*\{([\s\S]*?)\}/)?.[1] ?? '';
  const values = new Map(
    Array.from(
      `${root};\n${mode === 'dark' ? dark : ''}`.matchAll(/--([\w-]+):\s*([^;]+)(?:;|$)/g),
      ([, name, value]) => [name, value.trim()] as const
    )
  );
  const token = (name: string): string => {
    const value = values.get(name);
    if (!value) throw new Error(`Missing design token: --${name}`);
    return value;
  };
  const color = (name: string) => token(`color-${name}`);
  return {
    algorithm: mode === 'dark' ? theme.darkAlgorithm : theme.defaultAlgorithm,
    token: {
      colorPrimary: color('brandPrimary'),
      colorSuccess: color('statusTranslated'),
      colorWarning: color('warning'),
      colorError: color('error'),
      colorInfo: color('brandSecondary'),
      colorBgBase: color('bgSecondary'),
      colorBgContainer: color('bgPrimary'),
      colorBgElevated: color('bgPrimary'),
      colorBgLayout: color('bgSecondary'),
      colorText: color('textPrimary'),
      colorTextSecondary: color('textSecondary'),
      colorTextTertiary: color('textTertiary'),
      colorTextDisabled: color('textDisabled'),
      colorTextPlaceholder: color('textTertiary'),
      colorBorder: color('borderPrimary'),
      colorBorderSecondary: color('borderSecondary'),
      colorSplit: color('borderSecondary'),
      colorBgMask: color('overlayBg'),
      borderRadius: Number.parseFloat(token('radius-md')),
      fontFamily: token('body-font'),
      fontSize: Number.parseFloat(token('font-size-base')),
      controlHeight: 34,
      controlHeightSM: 28,
      boxShadow: token('shadow-md'),
      boxShadowSecondary: token('shadow-lg'),
      motionDurationFast: token('duration-fast'),
      motionDurationMid: token('duration-base'),
      motionDurationSlow: token('duration-slow'),
      motionEaseOut: token('ease-out'),
      motionEaseInOut: token('ease-in-out'),
    },
    components: {
      Button: {
        primaryColor: color('onBrand'),
        primaryShadow: 'none',
        defaultShadow: 'none',
        defaultBg: color('bgPrimary'),
        defaultColor: color('textPrimary'),
        defaultBorderColor: color('borderPrimary'),
        defaultHoverBg: color('hoverBg'),
        defaultActiveBg: color('activeBg'),
      },
      Input: {
        activeShadow: token('shadow-focus'),
        hoverBorderColor: color('brandPrimary'),
      },
      Select: { optionSelectedBg: color('selectedBg') },
      Table: {
        headerBg: color('bgSecondary'),
        headerColor: color('textSecondary'),
        rowHoverBg: color('hoverBg'),
      },
      Modal: { contentBg: color('bgPrimary'), headerBg: color('bgPrimary') },
      Drawer: { colorBgElevated: color('bgPrimary') },
      Layout: { headerBg: color('bgSecondary'), bodyBg: color('bgSecondary') },
    },
  };
}

export const lightTheme = createTheme('light');
export const darkTheme = createTheme('dark');
