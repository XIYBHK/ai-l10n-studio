import React, { useState, memo } from 'react';
import { Card, Tag, Divider, Button, Popconfirm } from 'antd';
import { RobotOutlined, SettingOutlined, ReloadOutlined, BookOutlined } from '@ant-design/icons';
import { TranslationStats } from '../types/tauri';
import { MemoryManager } from './MemoryManager';
import { TermLibraryManager } from './TermLibraryManager';
import { useCssColors } from '../hooks/useCssColors';
import { useStatsStore, useSessionStore } from '../store';
import { createModuleLogger } from '../utils/logger';
import { useTermLibrary } from '../hooks/useTermLibrary';
import { formatTokens, formatPercentage, formatCostByLocale } from '../utils/formatters';
import { useAppStore } from '../store/useAppStore';
import { useAppData } from '../hooks/useConfig';
import { aiModelCommands } from '../services/commands';
import type { ModelInfo } from '../types/generated/ModelInfo';

const log = createModuleLogger('AIWorkspace');

interface AIWorkspaceProps {
  stats: TranslationStats | null; // 已废弃，改用 sessionStats
  isTranslating: boolean;
  onResetStats?: () => void;
}

export const AIWorkspace = memo(function AIWorkspace({
  isTranslating,
  onResetStats,
}: AIWorkspaceProps) {
  const [memoryManagerVisible, setMemoryManagerVisible] = useState(false);
  const [termLibraryVisible, setTermLibraryVisible] = useState(false);
  const { termLibrary } = useTermLibrary({ enabled: true });
  const cssColors = useCssColors();

  const { cumulativeStats, resetCumulativeStats } = useStatsStore();
  const { sessionStats } = useSessionStore();

  const { language } = useAppStore();
  const { activeAIConfig } = useAppData();
  const [modelInfo, setModelInfo] = useState<ModelInfo | null>(null);

  React.useEffect(() => {
    if (activeAIConfig && activeAIConfig.providerId && activeAIConfig.model) {
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

  // 重置统计数据
  const handleReset = () => {
    resetCumulativeStats();
    onResetStats?.();
  };

  // 📊 本次会话详细统计（记忆库、去重、AI调用等）
  const renderSessionStats = () => {
    // 🔧 修复：使用 ai_translated 判断是否有翻译数据，而不是 total
    const hasData = (sessionStats.tm_hits ?? 0) > 0 || (sessionStats.ai_translated ?? 0) > 0;

    if (!hasData) {
      return (
        <div
          style={{
            padding: '12px',
            textAlign: 'center',
            color: cssColors.textTertiary,
            fontSize: '12px',
          }}
        >
          暂无数据
        </div>
      );
    }

    // 安全访问所有字段，防止 NaN
    const cost = sessionStats.token_stats?.cost ?? 0;
    const totalTokens = sessionStats.token_stats?.total_tokens ?? 0;
    const inputTokens = sessionStats.token_stats?.input_tokens ?? 0;
    const outputTokens = sessionStats.token_stats?.output_tokens ?? 0;
    const tmHits = sessionStats.tm_hits ?? 0;
    const deduplicated = sessionStats.deduplicated ?? 0;
    const aiTranslated = sessionStats.ai_translated ?? 0;
    const tmLearned = sessionStats.tm_learned ?? 0;

    // 🔧 修复：实际处理的总条目数 = tm_hits + deduplicated + ai_translated
    // 而不是使用 sessionStats.total（文件总条目数）
    const actualTotal = tmHits + deduplicated + aiTranslated;

    return (
      <div>
        <div
          style={{
            fontSize: '12px',
            color: cssColors.textSecondary,
            fontWeight: 600,
            marginBottom: 12,
          }}
        >
          💼 本次会话统计
        </div>

        {/* 效率指标 */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '8px',
            marginBottom: 12,
            fontSize: '11px',
          }}
        >
          <div
            style={{
              textAlign: 'center',
              padding: '8px',
              backgroundColor: cssColors.bgTertiary,
              borderRadius: '4px',
            }}
          >
            <div style={{ color: cssColors.textTertiary, marginBottom: '4px' }}>记忆库命中</div>
            <div style={{ fontSize: '16px', fontWeight: 600, color: cssColors.statusTranslated }}>
              {actualTotal > 0 ? formatPercentage(tmHits, actualTotal) : '0.0%'}
            </div>
          </div>
          <div
            style={{
              textAlign: 'center',
              padding: '8px',
              backgroundColor: cssColors.bgTertiary,
              borderRadius: '4px',
            }}
          >
            <div style={{ color: cssColors.textTertiary, marginBottom: '4px' }}>去重节省</div>
            <div style={{ fontSize: '16px', fontWeight: 600, color: cssColors.statusUntranslated }}>
              {actualTotal > 0 ? formatPercentage(deduplicated, actualTotal) : '0.0%'}
            </div>
          </div>
          <div
            style={{
              textAlign: 'center',
              padding: '8px',
              backgroundColor: cssColors.bgTertiary,
              borderRadius: '4px',
            }}
          >
            <div style={{ color: cssColors.textTertiary, marginBottom: '4px' }}>AI调用</div>
            <div style={{ fontSize: '16px', fontWeight: 600, color: cssColors.textPrimary }}>
              {actualTotal > 0 ? formatPercentage(aiTranslated, actualTotal) : '0.0%'}
            </div>
          </div>
          <div
            style={{
              textAlign: 'center',
              padding: '8px',
              backgroundColor: cssColors.bgTertiary,
              borderRadius: '4px',
            }}
          >
            <div style={{ color: cssColors.textTertiary, marginBottom: '4px' }}>记忆库新增</div>
            <div style={{ fontSize: '16px', fontWeight: 600, color: cssColors.statusTranslated }}>
              {tmLearned}
            </div>
          </div>
        </div>

        {/* Token消耗 */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '8px',
            marginBottom: 8,
            fontSize: '11px',
          }}
        >
          <div
            style={{
              textAlign: 'center',
              padding: '6px',
              backgroundColor: cssColors.bgTertiary,
              borderRadius: '4px',
            }}
          >
            <div style={{ color: cssColors.textTertiary }}>输入</div>
            <div style={{ fontSize: '14px', fontWeight: 600 }}>{formatTokens(inputTokens)}</div>
          </div>
          <div
            style={{
              textAlign: 'center',
              padding: '6px',
              backgroundColor: cssColors.bgTertiary,
              borderRadius: '4px',
            }}
          >
            <div style={{ color: cssColors.textTertiary }}>输出</div>
            <div style={{ fontSize: '14px', fontWeight: 600 }}>{formatTokens(outputTokens)}</div>
          </div>
          <div
            style={{
              textAlign: 'center',
              padding: '6px',
              backgroundColor: cssColors.bgTertiary,
              borderRadius: '4px',
            }}
          >
            <div style={{ color: cssColors.textTertiary }}>总计</div>
            <div style={{ fontSize: '14px', fontWeight: 600 }}>{formatTokens(totalTokens)}</div>
          </div>
        </div>

        {/* 精确成本（使用 ModelInfo 定价，支持多语言货币） */}
        <div
          style={{
            padding: '8px',
            backgroundColor: cssColors.bgTertiary,
            borderRadius: '4px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '12px',
          }}
        >
          <span style={{ color: cssColors.textSecondary }}>💰 预估成本</span>
          <span
            style={{
              fontWeight: 600,
              color: cssColors.statusTranslated,
              fontSize: '16px',
              fontFamily: 'monospace',
            }}
          >
            {formatCostByLocale(cost, language)}
          </span>
        </div>

        {/* 🆕 缓存支持提示 */}
        {modelInfo?.supports_cache && modelInfo.cache_reads_price && (
          <div
            style={{
              marginTop: 8,
              padding: '8px 10px',
              backgroundColor: cssColors.bgTertiary,
              border: `1px solid ${cssColors.borderPrimary}`,
              borderRadius: '4px',
              fontSize: '11px',
              color: cssColors.textSecondary,
              lineHeight: '1.5',
            }}
          >
            ℹ️ 当前模型支持缓存功能，重复请求可节省约{' '}
            {(
              ((modelInfo.input_price - modelInfo.cache_reads_price) / modelInfo.input_price) *
              100
            ).toFixed(0)}
            % 输入成本
          </div>
        )}

        {/* 效率提示 */}
        {tmHits + deduplicated > 0 && (
          <div
            style={{
              marginTop: 8,
              padding: '6px 8px',
              backgroundColor: cssColors.bgTertiary,
              borderRadius: '4px',
              fontSize: '11px',
              color: cssColors.statusTranslated,
              textAlign: 'center',
            }}
          >
            ⚡ 节省了 {tmHits + deduplicated} 次 API 调用
          </div>
        )}
      </div>
    );
  };

  // 简化的累计统计渲染
  const renderCumulativeStats = () => {
    if (cumulativeStats.total === 0) {
      return (
        <div
          style={{
            padding: '12px',
            textAlign: 'center',
            color: cssColors.textTertiary,
            fontSize: '12px',
          }}
        >
          暂无累计数据
        </div>
      );
    }

    // 安全访问 token_stats
    const cost = cumulativeStats.token_stats?.cost ?? 0;
    const totalTokens = cumulativeStats.token_stats?.total_tokens ?? 0;
    const cumulativeTmLearned = cumulativeStats.tm_learned ?? 0;

    return (
      <div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 8,
          }}
        >
          <span style={{ fontSize: '12px', color: cssColors.textSecondary, fontWeight: 600 }}>
            📊 累计统计
          </span>
          <Popconfirm
            title="确认重置累计统计数据？"
            onConfirm={handleReset}
            okText="确认"
            cancelText="取消"
          >
            <Button
              type="text"
              size="small"
              icon={<ReloadOutlined />}
              danger
              style={{ fontSize: '11px', height: '22px' }}
            >
              重置
            </Button>
          </Popconfirm>
        </div>

        {/* 精简数据展示 - 调整排版：总计翻译-AI调用-记忆命中-去重命中-记忆库新增 */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '8px',
            fontSize: '11px',
            marginBottom: 8,
          }}
        >
          <div
            style={{
              textAlign: 'center',
              padding: '6px',
              backgroundColor: cssColors.bgTertiary,
              borderRadius: '4px',
            }}
          >
            <div style={{ color: cssColors.textTertiary }}>总计翻译</div>
            <div style={{ fontSize: '16px', fontWeight: 600, color: cssColors.textPrimary }}>
              {cumulativeStats.total}
            </div>
          </div>
          <div
            style={{
              textAlign: 'center',
              padding: '6px',
              backgroundColor: cssColors.bgTertiary,
              borderRadius: '4px',
            }}
          >
            <div style={{ color: cssColors.textTertiary }}>AI调用</div>
            <div style={{ fontSize: '16px', fontWeight: 600, color: cssColors.textPrimary }}>
              {cumulativeStats.ai_translated}
            </div>
          </div>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '8px',
            fontSize: '11px',
            marginBottom: 8,
          }}
        >
          <div
            style={{
              textAlign: 'center',
              padding: '6px',
              backgroundColor: cssColors.bgTertiary,
              borderRadius: '4px',
            }}
          >
            <div style={{ color: cssColors.textTertiary }}>记忆命中</div>
            <div style={{ fontSize: '16px', fontWeight: 600, color: cssColors.statusTranslated }}>
              {cumulativeStats.tm_hits}
            </div>
          </div>
          <div
            style={{
              textAlign: 'center',
              padding: '6px',
              backgroundColor: cssColors.bgTertiary,
              borderRadius: '4px',
            }}
          >
            <div style={{ color: cssColors.textTertiary }}>去重命中</div>
            <div style={{ fontSize: '16px', fontWeight: 600, color: cssColors.statusUntranslated }}>
              {cumulativeStats.deduplicated ?? 0}
            </div>
          </div>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr',
            gap: '8px',
            fontSize: '11px',
          }}
        >
          <div
            style={{
              textAlign: 'center',
              padding: '6px',
              backgroundColor: cssColors.bgTertiary,
              borderRadius: '4px',
            }}
          >
            <div style={{ color: cssColors.textTertiary }}>记忆库新增</div>
            <div style={{ fontSize: '16px', fontWeight: 600, color: cssColors.statusTranslated }}>
              {cumulativeTmLearned}
            </div>
          </div>
        </div>

        {/* Token和费用（支持多语言货币） */}
        <div
          style={{
            marginTop: 8,
            padding: '6px 8px',
            backgroundColor: cssColors.bgTertiary,
            borderRadius: '4px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '11px',
          }}
        >
          <span style={{ color: cssColors.textSecondary }}>Token: {formatTokens(totalTokens)}</span>
          <span
            style={{ fontWeight: 600, color: cssColors.statusTranslated, fontFamily: 'monospace' }}
          >
            {formatCostByLocale(cost, language)}
          </span>
        </div>
      </div>
    );
  };

  // ❌ 已删除 renderCurrentStats - "本次翻译"详细统计已移除，统一使用"本次会话统计"

  return (
    <>
      <Card
        variant="borderless"
        title={
          <span style={{ fontSize: '14px', fontWeight: 600 }}>
            <RobotOutlined style={{ marginRight: 8, color: cssColors.statusUntranslated }} />
            AI 工作区
            {isTranslating && (
              <Tag color="processing" style={{ marginLeft: 8, border: 'none' }}>
                翻译中...
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
            style={{ color: cssColors.textSecondary }}
          >
            记忆库
          </Button>
        }
        size="small"
        style={{
          height: '100%',
          overflowY: 'auto',
          backgroundColor: cssColors.bgSecondary, // 使用稍深的背景色区分
          borderRadius: 0,
        }}
        // @ts-ignore - Ant Design 5.5+ styles 属性类型定义问题
        styles={{
          header: {
            backgroundColor: cssColors.bgSecondary,
            borderBottom: `1px solid ${cssColors.borderSecondary}`,
            minHeight: '46px',
          },
          body: {
            padding: '12px',
            backgroundColor: cssColors.bgSecondary,
          },
        }}
      >
        {/* 累计统计 - 简化样式 */}
        {renderCumulativeStats()}

        <Divider style={{ margin: '12px 0' }} />

        {/* 本次会话统计 */}
        {renderSessionStats()}

        <Divider style={{ margin: '12px 0' }} />

        {/* ❌ 已移除"本次翻译"详细统计，统一使用"本次会话统计"展示 */}

        {/* 🆕 术语库常驻展示 - 不为空时始终显示 */}
        {termLibrary && termLibrary.metadata.total_terms > 0 && (
          <>
            <div
              style={{
                marginBottom: 12,
              }}
            >
              {/* 术语库标题和管理按钮 */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 8,
                }}
              >
                <span style={{ fontSize: '12px', color: cssColors.textSecondary, fontWeight: 600 }}>
                  <BookOutlined /> 术语库 ({termLibrary.metadata.total_terms}条)
                </span>
                <Button
                  type="link"
                  size="small"
                  onClick={() => {
                    setTermLibraryVisible(true);
                  }}
                  style={{ fontSize: '11px', height: '22px' }}
                >
                  管理
                </Button>
              </div>

              {/* 风格总结展示 */}
              {termLibrary.style_summary && (
                <div
                  style={{
                    padding: '8px 12px',
                    backgroundColor: cssColors.bgTertiary,
                    borderRadius: '4px',
                    fontSize: '12px',
                    lineHeight: '1.6',
                    color: cssColors.textSecondary,
                  }}
                >
                  <div style={{ fontWeight: 600, marginBottom: 4, color: cssColors.textPrimary }}>
                    翻译风格提示 ({termLibrary.style_summary.based_on_terms}条术语)
                  </div>
                  <div style={{ whiteSpace: 'pre-line' }}>{termLibrary.style_summary.prompt}</div>
                  <div
                    style={{
                      marginTop: 8,
                      fontSize: '11px',
                      color: cssColors.textTertiary,
                    }}
                  >
                    v{termLibrary.style_summary.version} ·{' '}
                    {new Date(termLibrary.style_summary.generated_at).toLocaleString('zh-CN')}
                  </div>
                </div>
              )}
            </div>
            <Divider style={{ margin: '12px 0' }} />
          </>
        )}
      </Card>
      <MemoryManager
        visible={memoryManagerVisible}
        onClose={() => setMemoryManagerVisible(false)}
      />
      <TermLibraryManager
        visible={termLibraryVisible}
        onClose={() => {
          setTermLibraryVisible(false);
          // 关闭后重新加载术语库
        }}
        // ⛔ 移除: apiKey (TermLibraryManager内部使用useAppData获取)
      />
    </>
  );
});
