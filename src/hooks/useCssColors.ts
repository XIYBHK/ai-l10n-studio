/**
 * CSS 颜色常量
 * 
 * 优化：改为静态常量导出，避免 Hook 开销
 * 所有颜色值都是 CSS 变量引用字符串
 * 
 * @example
 * import { CSS_COLORS } from './useCssColors';
 * <div style={{ backgroundColor: CSS_COLORS.bgPrimary }}>
 */

export type CssColors = {
  bgPrimary: string;
  bgSecondary: string;
  bgTertiary: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  textDisabled: string;
  borderPrimary: string;
  borderSecondary: string;
  statusUntranslated: string;
  statusNeedsReview: string;
  statusTranslated: string;
  selectedBg: string;
  hoverBg: string;
  activeBg: string;
  selectedBorder: string;
  brandPrimary: string;
  brandSecondary: string;
  sourceTmBg: string;
  sourceTmColor: string;
  sourceDedupBg: string;
  sourceDedupColor: string;
  sourceAiBg: string;
  sourceAiColor: string;
  overlayBg: string;
  overlayText: string;
};

/**
 * CSS 颜色变量常量
 * 直接在组件中使用，无需 Hook 调用
 * 
 * 性能优势：
 * 1. 没有 Hook 调用开销
 * 2. 对象引用稳定，不会触发子组件重渲染
 * 3. 编译时确定，无需运行时计算
 */
export const CSS_COLORS: CssColors = {
  bgPrimary: 'var(--color-bgPrimary)',
  bgSecondary: 'var(--color-bgSecondary)',
  bgTertiary: 'var(--color-bgTertiary)',
  textPrimary: 'var(--color-textPrimary)',
  textSecondary: 'var(--color-textSecondary)',
  textTertiary: 'var(--color-textTertiary)',
  textDisabled: 'var(--color-textDisabled)',
  borderPrimary: 'var(--color-borderPrimary)',
  borderSecondary: 'var(--color-borderSecondary)',
  statusUntranslated: 'var(--color-statusUntranslated)',
  statusNeedsReview: 'var(--color-statusNeedsReview)',
  statusTranslated: 'var(--color-statusTranslated)',
  selectedBg: 'var(--color-selectedBg)',
  hoverBg: 'var(--color-hoverBg)',
  activeBg: 'var(--color-activeBg)',
  selectedBorder: 'var(--color-selectedBorder)',
  brandPrimary: 'var(--color-brandPrimary)',
  brandSecondary: 'var(--color-brandSecondary)',
  sourceTmBg: 'var(--color-sourceTmBg)',
  sourceTmColor: 'var(--color-sourceTmColor)',
  sourceDedupBg: 'var(--color-sourceDedupBg)',
  sourceDedupColor: 'var(--color-sourceDedupColor)',
  sourceAiBg: 'var(--color-sourceAiBg)',
  sourceAiColor: 'var(--color-sourceAiColor)',
  overlayBg: 'var(--color-overlayBg)',
  overlayText: 'var(--color-overlayText)',
};

/**
 * @deprecated 请使用 CSS_COLORS 常量替代
 * 保留此 Hook 以保持向后兼容，但内部使用 CSS_COLORS
 */
export const useCssColors = (): CssColors => CSS_COLORS;
