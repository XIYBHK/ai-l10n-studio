import { Button } from 'antd';
import {
  ArrowRightOutlined,
  FileTextOutlined,
  FolderOpenOutlined,
  CheckOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import styles from './WelcomeState.module.css';

export function WelcomeState({ onOpenFile }: { onOpenFile?: () => void }) {
  const { t } = useTranslation();
  return (
    <main className={styles.welcome}>
      <div className={styles.content}>
        <div className={styles.eyebrow}>
          <span />
          {t('workspace.eyebrow')}
        </div>
        <h2>{t('workspace.welcomeTitle')}</h2>
        <p className={styles.description}>{t('workspace.welcomeDescription')}</p>
        <div className={styles.actions}>
          <Button type="primary" size="large" icon={<FolderOpenOutlined />} onClick={onOpenFile}>
            {t('menu.import')}
          </Button>
          <kbd>Ctrl O</kbd>
        </div>
        <p className={styles.dropHint}>{t('workspace.dropHint')}</p>
        <div className={styles.features}>
          {['contextFeature', 'memoryFeature', 'reviewFeature'].map((key) => (
            <span key={key}>
              <CheckOutlined aria-hidden="true" />
              {t(`workspace.${key}`)}
            </span>
          ))}
        </div>
      </div>
      <div className={styles.illustration} aria-hidden="true">
        <div className={styles.documentBack} />
        <div className={styles.document}>
          <div className={styles.documentHeader}>
            <FileTextOutlined />
            <span>messages.po</span>
            <span className={styles.fileType}>PO</span>
          </div>
          <div className={styles.previewSection}>
            <div className={styles.previewLabel}>
              {t('workspace.sourceLabel')} <span>EN</span>
            </div>
            <div className={styles.previewText}>{t('workspace.sampleSource')}</div>
            <div className={styles.rule} />
            <div className={styles.ruleShort} />
          </div>
          <div className={styles.direction}>
            <ArrowRightOutlined />
          </div>
          <div className={styles.previewSection}>
            <div className={styles.previewLabel}>
              {t('workspace.targetLabel')} <span>ZH</span>
            </div>
            <div className={styles.previewTranslation}>{t('workspace.sampleTranslation')}</div>
            <div className={styles.rule} />
          </div>
          <div className={styles.documentFooter}>
            <span className={styles.statusDot} />
            {t('workspace.previewLabel')}
          </div>
        </div>
      </div>
      <div className={styles.footer}>
        <span>AI L10n Studio</span>
        <span>{t('workspace.footer')}</span>
      </div>
    </main>
  );
}
