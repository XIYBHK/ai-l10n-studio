import { lazy, memo, Suspense, useEffect, useState } from 'react';
import { Card, Divider, Tag } from 'antd';
import { BookOutlined, BulbOutlined, RobotOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useCumulativeStats, useResetCumulativeStatsAction, useSessionStats } from '../store';
import { useAppStore } from '../store/useAppStore';
import { useActiveAIConfig } from '../hooks/useConfig';
import { aiModelCommands } from '../services/aiCommands';
import type { ModelInfo } from '../types/generated/ModelInfo';
import { createModuleLogger } from '../utils/logger';
import { CumulativeStatsSection, SessionStatsSection } from './aiWorkspaceSections';
import styles from './AIWorkspace.module.css';
import { LazyModalFallback } from './ui/LazyModalFallback';

const log = createModuleLogger('AIWorkspace');
const MemoryManager = lazy(() =>
  import('./MemoryManager').then((module) => ({ default: module.MemoryManager }))
);
const TermLibraryManager = lazy(() =>
  import('./TermLibraryManager').then((module) => ({ default: module.TermLibraryManager }))
);
interface AIWorkspaceProps {
  isTranslating: boolean;
  onResetStats?: () => void;
}

export const AIWorkspace = memo(function AIWorkspace({
  isTranslating,
  onResetStats,
}: AIWorkspaceProps) {
  const { t } = useTranslation();
  const [memoryManagerVisible, setMemoryManagerVisible] = useState(false);
  const [termLibraryVisible, setTermLibraryVisible] = useState(false);
  const cumulativeStats = useCumulativeStats();
  const resetCumulativeStats = useResetCumulativeStatsAction();
  const sessionStats = useSessionStats();
  const language = useAppStore((state) => state.language);
  const { activeAIConfig } = useActiveAIConfig();
  const [modelInfo, setModelInfo] = useState<ModelInfo | null>(null);
  useEffect(() => {
    let active = true;
    if (activeAIConfig?.catalogProviderId && activeAIConfig.model) {
      aiModelCommands
        .getModelInfo(activeAIConfig.catalogProviderId, activeAIConfig.model)
        .then((info) => {
          if (!active) return;
          setModelInfo(info);
          if (info?.supports_cache) log.debug('model supports cache', { model: info.name });
        })
        .catch((err) => {
          if (active) {
            log.error('failed to load model info:', err);
            setModelInfo(null);
          }
        });
    } else setModelInfo(null);
    return () => {
      active = false;
    };
  }, [activeAIConfig?.catalogProviderId, activeAIConfig?.model]);
  const hasSessionData =
    sessionStats.tm_hits > 0 || sessionStats.ai_translated > 0 || sessionStats.tm_learned > 0;
  const hasCumulativeData = cumulativeStats.total > 0 || cumulativeStats.tm_learned > 0;
  const hasStats = hasSessionData || hasCumulativeData;
  const handleReset = () => {
    resetCumulativeStats();
    onResetStats?.();
  };
  return (
    <>
      <Card
        className={styles.workspace}
        variant="borderless"
        styles={{ body: { padding: 0 } }}
        role="complementary"
        aria-label={t('aiWorkspace.title')}
      >
        <header className={styles.header}>
          <div className={styles.heading}>
            <span className={styles.icon}>
              <RobotOutlined />
            </span>
            <div>
              <div className={styles.title}>
                {t('aiWorkspace.title')}
                {isTranslating && <Tag color="processing">{t('aiWorkspace.translating')}</Tag>}
              </div>
              <div className={styles.description}>{t('aiWorkspace.description')}</div>
            </div>
          </div>
        </header>
        <div className={styles.status}>
          <span className={styles.statusDot} />
          {activeAIConfig ? (
            <>
              <span>{activeAIConfig.displayName}</span>
              <span className={styles.model}>
                {activeAIConfig.model}
                {modelInfo ? ` · ${modelInfo.name}` : ''}
              </span>
            </>
          ) : (
            <span>{t('aiWorkspace.readyTitle')}</span>
          )}
        </div>
        <div className={styles.content}>
          {hasStats ? (
            <>
              {hasSessionData && (
                <SessionStatsSection
                  sessionStats={sessionStats}
                  modelInfo={modelInfo}
                  language={language}
                />
              )}
              {hasSessionData && hasCumulativeData && <Divider />}
              {hasCumulativeData && (
                <CumulativeStatsSection
                  cumulativeStats={cumulativeStats}
                  language={language}
                  onReset={handleReset}
                />
              )}
            </>
          ) : (
            <div className={styles.empty}>
              <BulbOutlined className={styles.emptyIcon} />
              <div className={styles.emptyTitle}>{t('aiWorkspace.readyTitle')}</div>
              <div>{t('aiWorkspace.readyDescription')}</div>
            </div>
          )}
          <Divider />
          <div className={styles.resourcesTitle}>{t('aiWorkspace.resources')}</div>
          <div className={styles.resources}>
            <button
              type="button"
              className={styles.resource}
              onClick={() => setMemoryManagerVisible(true)}
              data-testid="open-memory-manager"
            >
              <BulbOutlined />
              <span>
                <strong>{t('aiWorkspace.memory')}</strong>
                <small>{t('aiWorkspace.memoryDescription')}</small>
              </span>
            </button>
            <button
              type="button"
              className={styles.resource}
              onClick={() => setTermLibraryVisible(true)}
              data-testid="open-term-manager"
            >
              <BookOutlined />
              <span>
                <strong>{t('aiWorkspace.terms')}</strong>
                <small>{t('aiWorkspace.termsDescription')}</small>
              </span>
            </button>
          </div>
        </div>
      </Card>
      {memoryManagerVisible && (
        <Suspense fallback={<LazyModalFallback onClose={() => setMemoryManagerVisible(false)} />}>
          <MemoryManager
            visible={memoryManagerVisible}
            onClose={() => setMemoryManagerVisible(false)}
          />
        </Suspense>
      )}
      {termLibraryVisible && (
        <Suspense fallback={<LazyModalFallback onClose={() => setTermLibraryVisible(false)} />}>
          <TermLibraryManager
            visible={termLibraryVisible}
            onClose={() => setTermLibraryVisible(false)}
          />
        </Suspense>
      )}
    </>
  );
});
