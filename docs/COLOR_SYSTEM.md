# 颜色系统最佳实践

## 核心原则

### 1. SSOT（单一真相源）

**所有设计 token 在 `src/index.css` 定义**。不得在 `App.css`、CSS 模块或组件内重复定义同名 token。

历史教训：曾经 `App.css` 和 `index.css` 都定义 `--radius-md`（一个 12px、一个 8px），CSS 加载顺序导致实际生效值不稳定，视觉出现"有时圆角大有时小"的飘移。2026-05 已统一到 `index.css`。

### 2. 使用 CSS 变量而非硬编码

**错误**：

```tsx
<div style={{ backgroundColor: '#e6e9ef', color: '#4c4f69' }}>
<button style={{ background: '#ff4d4f' }}>  {/* Ant Design 红，不属于 Catppuccin */}
```

**正确**：

```tsx
<div style={{ backgroundColor: CSS_COLORS.bgPrimary, color: CSS_COLORS.textPrimary }}>
<button style={{ background: CSS_COLORS.error }}>  {/* 使用 token */}
```

`CSS_COLORS` 常量从 `src/hooks/useCssColors.ts` 导入，每个字段都是 `var(--color-xxx)` 字符串。

### 3. 所有 `--color-*` token 清单

#### 基础层

| 分类 | Token | 说明 |
|---|---|---|
| 背景 | `--color-bgPrimary`、`--color-bgSecondary`、`--color-bgTertiary` | 三级背景层 |
| 文字 | `--color-textPrimary`、`--color-textSecondary`、`--color-textTertiary`、`--color-textDisabled` | 四级文字 |
| 边框 | `--color-borderPrimary`、`--color-borderSecondary` | 两级边框 |

#### 状态层

| Token | 颜色（浅色） | 颜色（暗色） | 用途 |
|---|---|---|---|
| `--color-statusUntranslated` | `#cba6f7` Mauve | `#cba6f7` | 未翻译（紫） |
| `--color-statusNeedsReview` | `#fab387` Peach | `#fab387` | **待确认（琥珀）**— 2026-05 从蓝改为琥珀，匹配"需关注"语义 |
| `--color-statusTranslated` | `#166534` 深绿 | `#a6e3a1` 亮绿 | 已翻译 |

#### 警示色（2026-05 新增）

| Token | 值（浅色） | 用途 |
|---|---|---|
| `--color-warning` | `#fab387` | 警告（与 needsReview 一致） |
| `--color-warningBg` | `rgba(250, 179, 135, 0.15)` | 警告背景 |
| `--color-error` | `#ed8796` Catppuccin Red | 错误 |
| `--color-errorBg` | `rgba(237, 135, 150, 0.15)` | 错误背景 |

#### 高亮闪烁（2026-05 新增）

用于虚拟列表条目"刚更新"动画，使用 Catppuccin Blue 不与 Ant Design 默认蓝冲突：

| Token | 值（浅色） | 值（暗色） |
|---|---|---|
| `--color-flashGlow` | `rgba(137, 180, 250, 0.4)` | `rgba(137, 180, 250, 0.5)` |
| `--color-flashGlowSoft` | `rgba(137, 180, 250, 0.3)` | `rgba(137, 180, 250, 0.4)` |

#### 交互状态

- `--color-selectedBg`、`--color-selectedBorder`
- `--color-hoverBg`、`--color-activeBg`

#### 品牌色

- `--color-brandPrimary`（Mauve `#cba6f7`）
- `--color-brandSecondary`（Blue `#89b4fa`）

#### 翻译来源（pill badges）

TM 绿 / Dedup 紫 / AI 橙，明暗两套：

- `--color-sourceTmBg` / `--color-sourceTmColor`
- `--color-sourceDedupBg` / `--color-sourceDedupColor`
- `--color-sourceAiBg` / `--color-sourceAiColor`

## 主题切换

切换通过 `<html data-theme="dark">` 属性触发，所有 token 同名不同值：

```css
:root {
  --color-bgPrimary: #e6e9ef;  /* light */
}
[data-theme='dark'] {
  --color-bgPrimary: #1e1e2e;  /* dark */
}
```

`useTheme` hook 设置 attribute；`ConfigProvider` 配合切换 Antd 主题。

## 过渡动画

全局在 `App.css` 定义：

```css
:root {
  --theme-transition-duration: 0.3s;
  --theme-transition-timing: cubic-bezier(0.645, 0.045, 0.355, 1);
}
```

Antd 组件和全局 `body/div/span/...` 都会平滑过渡颜色。组件**无需**手动写 `transition`。

例外：拖拽调整时可临时 `transition: none` 避免抖动。

## 硬编码禁区

| 历史出现 | 应该改为 |
|---|---|
| `#ff4d4f` Ant Design 红 | `CSS_COLORS.error` / `var(--color-error)` |
| `rgba(22, 119, 255, 0.4)` Ant 蓝 | `var(--color-flashGlow)` |
| `#fff` / `#000` 作为 text/bg | `CSS_COLORS.textPrimary` / `CSS_COLORS.bgPrimary` |
| `#e6e9ef` 等 Catppuccin 字面量 | `CSS_COLORS.bgPrimary` 等 |

## 对比度验收

关键文字对比度（WCAG AA 要求 ≥ 4.5:1）：

| 组合 | 对比度 | 等级 |
|---|---|---|
| `textPrimary` (`#4c4f69`) on `bgPrimary` (`#e6e9ef`) | 8.5:1 | AAA |
| `textSecondary` (`#5c5f77`) on `bgPrimary` | 7.2:1 | AAA |
| `brandPrimary` Mauve on white | 4.8:1 | AA |
| `warning` Peach + `#1e1e2e` 深色文字（unsavedBadge） | ~9:1 | AAA |
| `warning` Peach + `#ffffff` 白色文字 | 1.2:1 | **FAIL** — 故意回避（历史坑） |

## 检查清单

新组件或样式改动完成前：

- [ ] 是否全程使用 `CSS_COLORS.*` 或 `var(--color-*)`，没有硬编码色值？
- [ ] 是否避免了手动 `transition`（除非有拖拽等特殊需求）？
- [ ] 亮色/暗色模式都验证过？
- [ ] 文字对比度 ≥ 4.5:1？
- [ ] 图标按钮有 `aria-label`？

## 参考

- 设计系统 SSOT：`src/index.css`
- JS 常量导出：`src/hooks/useCssColors.ts`
- Ant Design 主题绑定：`src/theme/config.ts`
- 主题切换 hook：`src/hooks/useTheme.ts`
- WCAG AA 无障碍：`src/styles/accessibility.css`
