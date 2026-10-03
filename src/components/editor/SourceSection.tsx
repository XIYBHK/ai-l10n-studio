import React from 'react';
import { GlobalOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { POEntry } from '../../types/tauri';
import styles from '../EditorPane.module.css';

interface SourceSectionProps {
  entry: POEntry;
}

/**
 * 源码展示区域组件
 */
export const SourceSection: React.FC<SourceSectionProps> = ({ entry }) => {
  const { t } = useTranslation();
  const hasContext = entry.msgctxt || (entry.comments && entry.comments.length > 0);

  return (
    <div
      className={styles.sourceArea}
      role="region"
      aria-label={t('workspace.editor.sourceRegion')}
    >
      <h3 className={styles.sectionHeader}>
        <GlobalOutlined aria-hidden="true" />
        {t('editor.original')}
      </h3>
      <div className={styles.sourceContent}>
        <div
          className={styles.sourceText}
          role="textbox"
          aria-label={t('workspace.editor.sourceContent')}
          aria-readonly="true"
          tabIndex={0}
        >
          {entry.msgid ? (
            entry.msgid
          ) : (
            <span className={styles.emptyText}>{t('workspace.editor.empty')}</span>
          )}
        </div>

        {/* 上下文和注释 */}
        {hasContext && <ContextInfo msgctxt={entry.msgctxt} comments={entry.comments} />}
      </div>
    </div>
  );
};

interface ContextInfoProps {
  msgctxt?: string;
  comments?: string[];
}

/**
 * 上下文信息展示组件
 */
export const ContextInfo: React.FC<ContextInfoProps> = ({ msgctxt, comments }) => {
  const { t } = useTranslation();
  return (
    <div
      className={styles.contextBox}
      role="complementary"
      aria-label={t('workspace.editor.contextAndComments')}
    >
      {msgctxt && (
        <div className={styles.contextItem}>
          <div className={styles.contextLabel} id="context-label">
            {t('editor.context')}
          </div>
          <div className={styles.contextValue} aria-labelledby="context-label">
            {msgctxt}
          </div>
        </div>
      )}
      {comments && comments.length > 0 && (
        <div className={styles.contextItem}>
          <div className={styles.contextLabel} id="comments-label">
            {t('workspace.editor.comments')}
          </div>
          <div role="list" aria-labelledby="comments-label">
            {comments.map((comment, index) => (
              <div key={index} className={styles.commentItem} role="listitem">
                {comment}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
