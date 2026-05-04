import React, { useState, memo, lazy, Suspense } from 'react';
import { Card, Tag, Divider, Button } from 'antd';
import { RobotOutlined, SettingOutlined } from '@ant-design/icons';
import type { TranslationStats } from '../types/tauri';
import { CSS_COLORS } from '../hooks/useCssColors';
import { useCumulativeStats, useResetCumulativeStatsAction, useSessionStats } from '../store';
import { createModuleLogger } from '../utils/logger';
import { useAppStore } from '../store/useAppStore';
import { useAppData } from '../hooks/useConfig';
import { aiModelCommands } from '../services/aiCommands';
import type { ModelInfo } from '../types/generated/ModelInfo';

import {
  CumulativeStatsSection,
  SessionStatsSection,
  TermLibrarySection,
} from './aiWorkspaceSections';

const log = createModuleLogger('AIWorkspace');
const MemoryManager = lazy(() =>
  import('./MemoryManager').then((module) => ({ default: module.MemoryManager }))
);
const TermLibraryManager = lazy(() =>
  import('./TermLibraryManager').then((module) => ({ default: module.TermLibraryManager }))
);

interface AIWorkspaceProps {
  stats: TranslationStats | null;
  isTranslating: boolean;
  onResetStats?: () => void;
}

export const AIWorkspace = memo(function AIWorkspace({
  isTranslating,
  onResetStats,
}: AIWorkspaceProps) {
  const [memoryManagerVisible, setMemoryManagerVisible] = useState(false);
  const [termLibraryVisible, setTermLibraryVisible] = useState(false);

  const cumulativeStats = useCumulativeStats();
  const resetCumulativeStats = useResetCumulativeStatsAction();
  const sessionStats = useSessionStats();
  const language = useAppStore((state) => state.language);
  const { activeAIConfig } = useAppData();
  const [modelInfo, setModelInfo] = useState<ModelInfo | null>(null);

  React.useEffect(() => {
    if (activeAIConfig?.providerId && activeAIConfig?.model) {
      aiModelCommands
        .getModelInfo(activeAIConfig.providerId, activeAIConfig.model)
        .then((info) => {
          setModelInfo(info);
          if (info?.supports_cache) {
            log.debug('当前模型支持缓存', {
              model: info.name,
              cache_savings: info.cache_reads_price
                ? `${(((info.input_price - info.cache_reads_price) / info.input_price) * 100).toFixed(0)}%`
                : 'N/A',
            });
          }
        })
        .catch((err) => {
          log.error('获取模型信息失败:', err);
          setModelInfo(null);
        });
    } else {
      setModelInfo(null);
    }
  }, [activeAIConfig?.providerId, activeAIConfig?.model]);

  const handleReset = () => {
    resetCumulativeStats();
    onResetStats?.();
  };

  const cardTitleStyle: React.CSSProperties = {
    fontSize: 'var(--font-size-base)',
    fontWeight: 600,
  };

  const cardStyles: Record<'header' | 'body', React.CSSProperties> = {
    header: {
      backgroundColor: CSS_COLORS.bgSecondary,
      borderBottom: `1px solid ${CSS_COLORS.borderSecondary}`,
      minHeight: '46px',
    },
    body: {
      padding: 'var(--space-3)',
      backgroundColor: CSS_COLORS.bgSecondary,
    },
  };

  return (
    <>
      <Card
        variant="borderless"
        title={
          <span style={cardTitleStyle}>
            <RobotOutlined
              style={{ marginRight: 'var(--space-2)', color: CSS_COLORS.statusUntranslated }}
              aria-hidden="true"
            />
            AI 工作区
            {isTranslating && (
              <Tag
                color="processing"
                style={{ marginLeft: 'var(--space-2)', border: 'none' }}
                aria-label="翻译进行中"
              >
                翻译中…
              </Tag>
            )}
          </span>
        }
        extra={
          <Button
            type="text"
            size="small"
            icon={<SettingOutlined />}
            onClick={() => setMemoryManagerVisible(true)}
            style={{ color: CSS_COLORS.textSecondary }}
            aria-label="打开记忆库管理"
          >
            记忆库
          </Button>
        }
        size="small"
        style={{
          height: '100%',
          overflowY: 'auto',
          backgroundColor: CSS_COLORS.bgSecondary,
          borderRadius: 0,
        }}
        styles={cardStyles}
        role="complementary"
        aria-label="AI工作区统计信息"
      >
        {/* 累计统计 */}
        <CumulativeStatsSection
          cumulativeStats={cumulativeStats}
          language={language}
          onReset={handleReset}
        />

        <Divider style={{ margin: 'var(--space-3) 0' }} />

        {/* 本次会话统计 */}
        <SessionStatsSection
          sessionStats={sessionStats}
          modelInfo={modelInfo}
          language={language}
        />

        <Divider style={{ margin: 'var(--space-3) 0' }} />

        {/* 术语库 */}
        <TermLibrarySection onManageClick={() => setTermLibraryVisible(true)} language={language} />
      </Card>

      {memoryManagerVisible ? (
        <Suspense fallback={null}>
          <MemoryManager
            visible={memoryManagerVisible}
            onClose={() => setMemoryManagerVisible(false)}
          />
        </Suspense>
      ) : null}
      {termLibraryVisible ? (
        <Suspense fallback={null}>
          <TermLibraryManager
            visible={termLibraryVisible}
            onClose={() => setTermLibraryVisible(false)}
          />
        </Suspense>
      ) : null}
    </>
  );
});
