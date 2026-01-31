import React, { CSSProperties } from 'react';
import { TranslationOutlined } from '@ant-design/icons';
import { Input, Badge } from 'antd';
import { CSS_COLORS } from '../hooks/useCssColors';
import { SectionHeader } from '../ui/SectionHeader';
import { POEntry } from '../../types/tauri';

const { TextArea } = Input;

// 获取翻译来源样式
function getSourceStyle(source: 'tm' | 'dedup' | 'ai' | undefined, colors: typeof CSS_COLORS) {
  const styles = {
    tm: { bg: colors.sourceTmBg, color: colors.sourceTmColor, label: '记忆库' },
    dedup: { bg: colors.sourceDedupBg, color: colors.sourceDedupColor, label: '去重' },
    ai: { bg: colors.sourceAiBg, color: colors.sourceAiColor, label: 'AI翻译' },
  };
  return styles[source || 'ai'];
}

interface TargetSectionProps {
  entry: POEntry;
  translation: string;
  onTranslationChange: (value: string) => void;
  onBlur: () => void;
  hasUnsavedChanges: boolean;
  saveStatusId?: string;
}

/**
 * 目标语编辑区域组件
 */
export const TargetSection: React.FC<TargetSectionProps> = ({
  entry,
  translation,
  onTranslationChange,
  onBlur,
  hasUnsavedChanges,
  saveStatusId,
}) => {
  const containerStyles: CSSProperties = {
    flex: '1 1 60%',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: CSS_COLORS.bgPrimary,
  };

  const contentStyles: CSSProperties = {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
    padding: 'var(--space-4)',
  };

  const textAreaStyles: CSSProperties = {
    flex: 1,
    fontSize: 'var(--font-size-md)',
    lineHeight: 1.6,
    padding: 'var(--space-4)',
    resize: 'none',
    backgroundColor: CSS_COLORS.bgSecondary,
    border: `1px solid ${hasUnsavedChanges ? CSS_COLORS.statusUntranslated : CSS_COLORS.borderSecondary}`,
    borderRadius: 'var(--radius-md)',
    boxShadow: hasUnsavedChanges
      ? `0 0 0 2px ${CSS_COLORS.statusUntranslated}20`
      : 'var(--shadow-sm)',
    transition: 'all var(--duration-base) var(--ease-out)',
    fontFamily: 'var(--mono-font)',
  };

  const charCountStyles: CSSProperties = {
    position: 'absolute',
    bottom: 'var(--space-5)',
    right: 'var(--space-5)',
    fontSize: 'var(--font-size-xs)',
    color: CSS_COLORS.textTertiary,
    backgroundColor: CSS_COLORS.bgTertiary,
    padding: 'var(--space-1) var(--space-2)',
    borderRadius: 'var(--radius-sm)',
    border: `1px solid ${CSS_COLORS.borderSecondary}`,
    fontFamily: 'var(--mono-font)',
  };

  const unsavedBadgeStyles: CSSProperties = {
    position: 'absolute',
    bottom: 'var(--space-5)',
    left: 'var(--space-5)',
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-1)',
    padding: 'var(--space-1) var(--space-3)',
    backgroundColor: CSS_COLORS.statusUntranslated,
    color: '#ffffff',
    borderRadius: 'var(--radius-full)',
    fontSize: 'var(--font-size-xs)',
    fontWeight: 'var(--font-weight-semibold)',
    animation: hasUnsavedChanges ? 'pulse-badge 2s ease-in-out infinite' : undefined,
    boxShadow: 'var(--shadow-md)',
    zIndex: 10,
  };

  // 翻译来源标签
  const getSourceTag = () => {
    if (!entry.translationSource) return null;
    const style = getSourceStyle(entry.translationSource, CSS_COLORS);
    return (
      <Badge
        count={style.label}
        style={{
          backgroundColor: style.bg,
          color: style.color,
          fontSize: 'var(--font-size-xs)',
          fontWeight: 'var(--font-weight-medium)',
          border: `1px solid ${style.color}`,
        }}
      />
    );
  };

  return (
    <div style={containerStyles}>
      <SectionHeader
        title="译文 (Translation)"
        icon={<TranslationOutlined />}
        extra={getSourceTag()}
        bordered={false}
        style={{
          padding: 'var(--space-3) var(--space-4)',
          marginBottom: 0,
          backgroundColor: CSS_COLORS.bgTertiary,
          borderBottom: `1px solid ${CSS_COLORS.borderSecondary}`,
        }}
      />
      <div style={contentStyles}>
        <TextArea
          value={translation}
          onChange={(e) => onTranslationChange(e.target.value)}
          onBlur={onBlur}
          placeholder="在此输入翻译内容..."
          style={textAreaStyles}
          aria-label="译文编辑"
          aria-describedby={saveStatusId}
          aria-multiline="true"
        />

        {/* 字符计数器 */}
        <div style={charCountStyles} aria-label={`${translation.length} 个字符`}>
          {translation.length} 字符
        </div>

        {/* 未保存提示 */}
        {hasUnsavedChanges && (
          <div style={unsavedBadgeStyles} role="status" aria-live="polite" id={saveStatusId}>
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                backgroundColor: '#ffffff',
                display: 'inline-block',
              }}
              aria-hidden="true"
            />
            <span>未保存</span>
          </div>
        )}
      </div>
    </div>
  );
};
