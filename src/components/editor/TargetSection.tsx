import React from 'react';
import { TranslationOutlined } from '@ant-design/icons';
import { Input, Badge } from 'antd';
import { useTranslation } from 'react-i18next';
import { CSS_COLORS } from '../../hooks/useCssColors';
import { POEntry } from '../../types/tauri';
import styles from '../EditorPane.module.css';

const { TextArea } = Input;

// 获取翻译来源样式
function getSourceStyle(
  source: 'tm' | 'dedup' | 'ai' | undefined,
  colors: typeof CSS_COLORS,
  t: (key: string) => string
) {
  const styles = {
    tm: {
      bg: colors.sourceTmBg,
      color: colors.sourceTmColor,
      label: t('workspace.editor.sourceMemory'),
    },
    dedup: {
      bg: colors.sourceDedupBg,
      color: colors.sourceDedupColor,
      label: t('workspace.editor.sourceDedup'),
    },
    ai: { bg: colors.sourceAiBg, color: colors.sourceAiColor, label: t('editor.autoTranslate') },
  };
  return styles[source || 'ai'];
}

interface TargetSectionProps {
  entry: POEntry;
  translation: string;
  onTranslationChange: (value: string) => void;
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
  hasUnsavedChanges,
  saveStatusId,
}) => {
  const { t } = useTranslation();
  // 翻译来源标签
  const getSourceTag = () => {
    if (!entry.translationSource) return null;
    const style = getSourceStyle(entry.translationSource, CSS_COLORS, t);
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
    <div className={styles.targetArea}>
      <h3 className={styles.sectionHeader}>
        <TranslationOutlined aria-hidden="true" />
        {t('editor.translation')}
        {getSourceTag()}
      </h3>
      <div className={styles.targetContentContainer}>
        <TextArea
          value={translation}
          onChange={(e) => onTranslationChange(e.target.value)}
          placeholder={t('workspace.editor.translationPlaceholder')}
          className={`${styles.textArea} ${hasUnsavedChanges ? styles.unsaved : ''}`}
          aria-label={t('workspace.editor.translationEditor')}
          aria-describedby={saveStatusId}
          aria-multiline="true"
        />

        {/* 字符计数器 */}
        <div
          className={styles.charCounter}
          aria-label={t('workspace.editor.charCount', { count: translation.length })}
        >
          {t('workspace.editor.charCount', { count: translation.length })}
        </div>

        {/* 未保存提示 */}
        {hasUnsavedChanges && (
          <div className={styles.unsavedBadge} role="status" aria-live="polite" id={saveStatusId}>
            <span className={styles.unsavedDot} aria-hidden="true" />
            <span>{t('workspace.editor.unsaved')}</span>
          </div>
        )}
      </div>
    </div>
  );
};
