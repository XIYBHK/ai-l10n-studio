import { lazy, memo, Suspense, useEffect, useRef, useState } from 'react';
import { Card, Divider, Drawer, Tag } from 'antd';
import { ArrowRightOutlined, BookOutlined, BulbOutlined, RobotOutlined } from '@ant-design/icons';
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
import { FocusTrap } from '../utils/accessibility';

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
  compact?: boolean;
  open?: boolean;
  onClose?: () => void;
}

export const AIWorkspace = memo(function AIWorkspace({
  isTranslating,
  onResetStats,
  compact = false,
  open = false,
  onClose,
}: AIWorkspaceProps) {
  const { t } = useTranslation();
  // null is unmounted; false lets Modal finish closing and restore trigger focus.
  const [memoryManagerVisible, setMemoryManagerVisible] = useState<boolean | null>(null);
  const [termLibraryVisible, setTermLibraryVisible] = useState<boolean | null>(null);
  const drawerPanel = useRef<HTMLDivElement>(null);
  const [drawerFocus] = useState(() => new FocusTrap());
  useEffect(() => () => drawerFocus.deactivate(), [drawerFocus]);
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
  const heading = (
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
  );
  const content = (
    <Card
      className={styles.workspace}
      variant="borderless"
      styles={{ body: { padding: 0 } }}
      role="complementary"
      aria-label={t('aiWorkspace.title')}
    >
      {!compact && <header className={styles.header}>{heading}</header>}
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
          <span>{t('aiWorkspace.configureService')}</span>
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
            <ArrowRightOutlined className={styles.resourceArrow} aria-hidden="true" />
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
            <ArrowRightOutlined className={styles.resourceArrow} aria-hidden="true" />
          </button>
        </div>
      </div>
    </Card>
  );
  return (
    <>
      {compact ? (
        <Drawer
          title={heading}
          open={open}
          onClose={onClose}
          panelRef={drawerPanel}
          autoFocus={false}
          focusable={{ trap: false, focusTriggerAfterClose: false }}
          keyboard={false}
          onKeyDown={(event) => {
            if (
              event.key === 'Escape' &&
              !event.defaultPrevented &&
              !event.nativeEvent.isComposing &&
              event.target instanceof Node &&
              event.currentTarget.contains(event.target)
            ) {
              event.stopPropagation();
              onClose?.();
            }
          }}
          afterOpenChange={(shown) => {
            if (shown && drawerPanel.current) drawerFocus.activate(drawerPanel.current);
            else drawerFocus.deactivate();
          }}
          size={320}
          styles={{ body: { padding: 0 } }}
        >
          <div id="workspace-assistant" className={styles.drawerContent}>
            {content}
          </div>
        </Drawer>
      ) : (
        <div id="workspace-assistant" className={styles.inlineContent}>
          {content}
        </div>
      )}
      {memoryManagerVisible !== null && (
        <Suspense fallback={<LazyModalFallback onClose={() => setMemoryManagerVisible(null)} />}>
          <MemoryManager
            visible={memoryManagerVisible === true}
            onClose={() => setMemoryManagerVisible(false)}
            afterClose={() => setMemoryManagerVisible((value) => (value === false ? null : value))}
          />
        </Suspense>
      )}
      {termLibraryVisible !== null && (
        <Suspense fallback={<LazyModalFallback onClose={() => setTermLibraryVisible(null)} />}>
          <TermLibraryManager
            visible={termLibraryVisible === true}
            onClose={() => setTermLibraryVisible(false)}
            afterClose={() => setTermLibraryVisible((value) => (value === false ? null : value))}
          />
        </Suspense>
      )}
    </>
  );
});
