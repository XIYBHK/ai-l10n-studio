import { theme } from 'antd';
import tokenCss from '../../index.css?inline';
import { darkTheme, lightTheme } from '../../theme/config';

const hex = (value: unknown): [number, number, number] => {
  if (typeof value !== 'string' || !/^#[\da-f]{3}(?:[\da-f]{3})?$/i.test(value)) {
    throw new Error(`Expected a hex color, got ${String(value)}`);
  }
  const digits = value.slice(1);
  const expanded =
    digits.length === 3
      ? digits
          .split('')
          .map((digit) => digit + digit)
          .join('')
      : digits;
  return [0, 2, 4].map((offset) => Number.parseInt(expanded.slice(offset, offset + 2), 16)) as [
    number,
    number,
    number,
  ];
};

const luminance = (value: unknown) =>
  hex(value)
    .map((channel) => channel / 255)
    .map((channel) => (channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4))
    .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);

const contrast = (foreground: unknown, background: unknown) => {
  const light = luminance(foreground);
  const dark = luminance(background);
  return (Math.max(light, dark) + 0.05) / (Math.min(light, dark) + 0.05);
};

const cssValues = (mode: 'light' | 'dark') => {
  const root = tokenCss.match(/:root\s*\{([\s\S]*?)\}/)?.[1] ?? '';
  const dark = tokenCss.match(/\[data-theme=['"]?dark['"]?\]\s*\{([\s\S]*?)\}/)?.[1] ?? '';
  return new Map(
    Array.from(
      `${root};${mode === 'dark' ? dark : ''}`.matchAll(/--([\w-]+):\s*([^;]+)(?:;|$)/g),
      ([, name, value]) => [name, value.trim()] as const
    )
  );
};

const tokenMap = {
  colorBgBase: 'color-bgSecondary',
  colorBgContainer: 'color-bgPrimary',
  colorText: 'color-textPrimary',
  colorTextSecondary: 'color-textSecondary',
  colorTextTertiary: 'color-textTertiary',
  colorPrimary: 'color-brandPrimary',
} as const;

describe('theme token bridge', () => {
  it.each([
    ['light', lightTheme],
    ['dark', darkTheme],
  ] as const)('%s tokens resolve the CSS source values', (mode, config) => {
    const values = cssValues(mode);
    for (const [tokenName, cssName] of Object.entries(tokenMap)) {
      expect(config.token?.[tokenName as keyof typeof config.token]).toBe(values.get(cssName));
      expect(String(config.token?.[tokenName as keyof typeof config.token])).not.toContain('var(');
    }
    expect(config.components?.Button?.primaryColor).toBe(values.get('color-onBrand'));
    expect(theme.getDesignToken(config).colorPrimary).toMatch(/^#[\da-f]{6}$/i);
  });

  it.each([
    ['light', lightTheme],
    ['dark', darkTheme],
  ] as const)('%s normal text and translation source colors meet contrast', (mode, config) => {
    const values = cssValues(mode);
    for (const text of ['color-textPrimary', 'color-textSecondary', 'color-textTertiary']) {
      expect(contrast(values.get(text), values.get('color-bgPrimary'))).toBeGreaterThanOrEqual(4.5);
      expect(contrast(values.get(text), values.get('color-bgSecondary'))).toBeGreaterThanOrEqual(
        4.5
      );
    }
    for (const source of ['Tm', 'Dedup', 'Ai']) {
      expect(
        contrast(values.get(`color-source${source}Color`), values.get(`color-source${source}Bg`))
      ).toBeGreaterThanOrEqual(4.5);
    }
    expect(
      contrast(config.components?.Button?.primaryColor, config.token?.colorPrimary)
    ).toBeGreaterThanOrEqual(4.5);
  });
});
