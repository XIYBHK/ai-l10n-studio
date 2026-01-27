import { useMemo } from 'react';

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
 * 获取 CSS 变量颜色引用
 *
 * 返回所有颜色的 CSS 变量引用（如 'var(--color-bgPrimary)'），
 * 支持主题切换时的平滑过渡动画。
 *
 * @example
 * ```tsx
 * const cssColors = useCssColors();
 * <div style={{ backgroundColor: cssColors.bgPrimary }}>
 * ```
 */
export const useCssColors = (): CssColors =>
  useMemo(
    () => ({
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
    }),
    []
  );
