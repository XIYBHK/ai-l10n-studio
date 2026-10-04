import React from 'react';
import { Button, Popover } from 'antd';
import { QuestionCircleOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import styles from '../EditorPane.module.css';

interface StatusBarProps {
  lineNumber?: number;
  charCount: number;
  isTranslated: boolean;
}

export const StatusBar: React.FC<StatusBarProps> = ({ lineNumber, charCount, isTranslated }) => {
  const { t } = useTranslation();
  const shortcuts = (
    <div className={styles.shortcutHelp}>
      <span>
        <kbd className={styles.kbd}>Ctrl + Enter</kbd> {t('common.confirm')}
      </span>
      <span>
        <kbd className={styles.kbd}>Esc</kbd> {t('common.cancel')}
      </span>
      <span>
        <kbd className={styles.kbd}>Ctrl + ↑ / ↓</kbd> {t('workspace.editor.navigation')}
      </span>
    </div>
  );
  return (
    <div className={styles.statusBar}>
      <div className={styles.statusBarLeft}>
        {lineNumber !== undefined && (
          <span>{t('workspace.editor.lineNumber', { count: lineNumber })}</span>
        )}
        <span>{t('workspace.editor.charCount', { count: charCount })}</span>
        <span
          className={`${styles.translationStatus} ${isTranslated ? styles.translated : styles.untranslated}`}
        >
          {t(isTranslated ? 'workspace.editor.translated' : 'workspace.editor.untranslated')}
        </span>
      </div>
      <Popover title={t('workspace.editor.shortcuts')} content={shortcuts} trigger="click">
        <Button
          type="text"
          size="small"
          icon={<QuestionCircleOutlined />}
          aria-label={t('workspace.editor.shortcuts')}
        />
      </Popover>
    </div>
  );
};
