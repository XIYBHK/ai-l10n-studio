import React, { useState, useEffect } from 'react';
import { Card, Tag, Divider, Button, Popconfirm, Collapse } from 'antd';
import { RobotOutlined, SettingOutlined, ReloadOutlined, BookOutlined } from '@ant-design/icons';
import { TranslationStats } from '../types/tauri';
import { MemoryManager } from './MemoryManager';
import { TermLibraryManager } from './TermLibraryManager';
import { useTheme } from '../hooks/useTheme';
import { useStatsStore, useSessionStore } from '../store';
import { createModuleLogger } from '../utils/logger';
import { eventDispatcher } from '../services/eventDispatcher';
import { useTermLibrary } from '../hooks/useTermLibrary';
import { formatCost, formatTokens, formatPercentage } from '../utils/formatters';

const log = createModuleLogger('AIWorkspace');

interface AIWorkspaceProps {
  stats: TranslationStats | null; // ❌ 已废弃，改用 sessionStats
  isTranslating: boolean;
  onResetStats?: () => void;
  apiKey?: string; // 用于生成风格总结
}

export const AIWorkspace: React.FC<AIWorkspaceProps> = ({
  isTranslating,
  onResetStats,
  apiKey,
}) => {
  const [memoryManagerVisible, setMemoryManagerVisible] = useState(false);
  const [termLibraryVisible, setTermLibraryVisible] = useState(false);
  const [shouldLoadTerms, setShouldLoadTerms] = useState(false); // 控制是否加载术语库
  const { termLibrary, mutate: mutateTermLibrary } = useTermLibrary({ enabled: shouldLoadTerms });
  const { colors } = useTheme();

  // 📊 三层统计数据
  // 1. stats (prop): 本次翻译详情（实时更新）
  // 2. sessionStats: 本次会话聚合（当前文件打开后的所有翻译）
  // 3. cumulativeStats: 累计统计（跨文件跨会话）
  const { cumulativeStats, resetCumulativeStats } = useStatsStore();
  const { sessionStats } = useSessionStore();

  // 监听术语更新事件（说明有术语了，开始加载）
  useEffect(() => {
    const unsubscribe = eventDispatcher.on('term:updated', () => {
      log.debug('收到术语更新事件，启用术语库加载');
      setShouldLoadTerms(true);
      mutateTermLibrary();
    });

    return () => {
      unsubscribe();
    };
  }, [mutateTermLibrary]);

  // ❌ 移除在视图层的累计累加，统一在 App.tsx 的聚合器处处理

  const handleReset = () => {
    resetCumulativeStats();
    if (onResetStats) {
      onResetStats();
    }
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
            color: colors.textTertiary,
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

    // 🔧 修复：实际处理的总条目数 = tm_hits + deduplicated + ai_translated
    // 而不是使用 sessionStats.total（文件总条目数）
    const actualTotal = tmHits + deduplicated + aiTranslated;

    return (
      <div>
        <div
          style={{
            fontSize: '12px',
            color: colors.textSecondary,
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
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '8px',
            marginBottom: 12,
            fontSize: '11px',
          }}
        >
          <div
            style={{
              textAlign: 'center',
              padding: '8px',
              background: colors.bgTertiary,
              borderRadius: '4px',
            }}
          >
            <div style={{ color: colors.textTertiary, marginBottom: '4px' }}>记忆库命中</div>
            <div style={{ fontSize: '16px', fontWeight: 600, color: colors.statusTranslated }}>
              {actualTotal > 0 ? formatPercentage(tmHits, actualTotal) : '0.0%'}
            </div>
          </div>
          <div
            style={{
              textAlign: 'center',
              padding: '8px',
              background: colors.bgTertiary,
              borderRadius: '4px',
            }}
          >
            <div style={{ color: colors.textTertiary, marginBottom: '4px' }}>去重节省</div>
            <div style={{ fontSize: '16px', fontWeight: 600, color: colors.statusUntranslated }}>
              {actualTotal > 0 ? formatPercentage(deduplicated, actualTotal) : '0.0%'}
            </div>
          </div>
          <div
            style={{
              textAlign: 'center',
              padding: '8px',
              background: colors.bgTertiary,
              borderRadius: '4px',
            }}
          >
            <div style={{ color: colors.textTertiary, marginBottom: '4px' }}>AI调用</div>
            <div style={{ fontSize: '16px', fontWeight: 600, color: colors.textPrimary }}>
              {actualTotal > 0 ? formatPercentage(aiTranslated, actualTotal) : '0.0%'}
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
              background: colors.bgTertiary,
              borderRadius: '4px',
            }}
          >
            <div style={{ color: colors.textTertiary }}>输入</div>
            <div style={{ fontSize: '14px', fontWeight: 600 }}>{formatTokens(inputTokens)}</div>
          </div>
          <div
            style={{
              textAlign: 'center',
              padding: '6px',
              background: colors.bgTertiary,
              borderRadius: '4px',
            }}
          >
            <div style={{ color: colors.textTertiary }}>输出</div>
            <div style={{ fontSize: '14px', fontWeight: 600 }}>{formatTokens(outputTokens)}</div>
          </div>
          <div
            style={{
              textAlign: 'center',
              padding: '6px',
              background: colors.bgTertiary,
              borderRadius: '4px',
            }}
          >
            <div style={{ color: colors.textTertiary }}>总计</div>
            <div style={{ fontSize: '14px', fontWeight: 600 }}>{formatTokens(totalTokens)}</div>
          </div>
        </div>

        {/* 精确成本（使用 ModelInfo 定价） */}
        <div
          style={{
            padding: '8px',
            background: colors.bgTertiary,
            borderRadius: '4px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '12px',
          }}
        >
          <span style={{ color: colors.textSecondary }}>💰 实际成本</span>
          <span
            style={{
              fontWeight: 600,
              color: colors.statusTranslated,
              fontSize: '16px',
              fontFamily: 'monospace',
            }}
          >
            {formatCost(cost)}
          </span>
        </div>

        {/* 效率提示 */}
        {tmHits + deduplicated > 0 && (
          <div
            style={{
              marginTop: 8,
              padding: '6px 8px',
              background: colors.bgTertiary,
              borderRadius: '4px',
              fontSize: '11px',
              color: colors.statusTranslated,
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
            color: colors.textTertiary,
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
          <span style={{ fontSize: '12px', color: colors.textSecondary, fontWeight: 600 }}>
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

        {/* 精简数据展示 - 调整排版：总计翻译-AI调用 / 记忆命中-去重命中 */}
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
              background: colors.bgTertiary,
              borderRadius: '4px',
            }}
          >
            <div style={{ color: colors.textTertiary }}>总计翻译</div>
            <div style={{ fontSize: '16px', fontWeight: 600, color: colors.textPrimary }}>
              {cumulativeStats.total}
            </div>
          </div>
          <div
            style={{
              textAlign: 'center',
              padding: '6px',
              background: colors.bgTertiary,
              borderRadius: '4px',
            }}
          >
            <div style={{ color: colors.textTertiary }}>AI调用</div>
            <div style={{ fontSize: '16px', fontWeight: 600, color: colors.textPrimary }}>
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
          }}
        >
          <div
            style={{
              textAlign: 'center',
              padding: '6px',
              background: colors.bgTertiary,
              borderRadius: '4px',
            }}
          >
            <div style={{ color: colors.textTertiary }}>记忆命中</div>
            <div style={{ fontSize: '16px', fontWeight: 600, color: colors.statusTranslated }}>
              {cumulativeStats.tm_hits}
            </div>
          </div>
          <div
            style={{
              textAlign: 'center',
              padding: '6px',
              background: colors.bgTertiary,
              borderRadius: '4px',
            }}
          >
            <div style={{ color: colors.textTertiary }}>去重命中</div>
            <div style={{ fontSize: '16px', fontWeight: 600, color: colors.statusUntranslated }}>
              {cumulativeStats.deduplicated ?? 0}
            </div>
          </div>
        </div>

        {/* Token和费用 */}
        <div
          style={{
            marginTop: 8,
            padding: '6px 8px',
            background: colors.bgTertiary,
            borderRadius: '4px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '11px',
          }}
        >
          <span style={{ color: colors.textSecondary }}>Token: {formatTokens(totalTokens)}</span>
          <span
            style={{ fontWeight: 600, color: colors.statusTranslated, fontFamily: 'monospace' }}
          >
            {formatCost(cost)}
          </span>
        </div>
      </div>
    );
  };

  // ❌ 已删除 renderCurrentStats - "本次翻译"详细统计已移除，统一使用"本次会话统计"

  return (
    <>
      <Card
        title={
          <span>
            <RobotOutlined /> AI 工作区
            {isTranslating && (
              <Tag color="processing" style={{ marginLeft: 8 }}>
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
          >
            记忆库
          </Button>
        }
        size="small"
        style={{ height: '100%', overflowY: 'auto' }}
      >
        {/* 累计统计 - 简化样式 */}
        {renderCumulativeStats()}

        <Divider style={{ margin: '12px 0' }} />

        {/* 本次会话统计 */}
        {renderSessionStats()}

        <Divider style={{ margin: '12px 0' }} />

        {/* ❌ 已移除"本次翻译"详细统计，统一使用"本次会话统计"展示 */}

        {/* 风格总结展示 */}
        {termLibrary && termLibrary.style_summary && (
          <>
            <Collapse
              ghost
              size="small"
              style={{ marginBottom: 12 }}
              items={[
                {
                  key: 'style',
                  label: (
                    <span style={{ fontSize: '12px', fontWeight: 600 }}>
                      <BookOutlined /> 学习到的翻译风格 ({termLibrary.style_summary.based_on_terms}
                      条术语)
                    </span>
                  ),
                  extra: (
                    <Button
                      type="link"
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShouldLoadTerms(true);
                        setTermLibraryVisible(true);
                      }}
                      style={{ fontSize: '11px', padding: 0 }}
                    >
                      管理
                    </Button>
                  ),
                  children: (
                    <div>
                      <div
                        style={{
                          padding: '8px 12px',
                          background: colors.bgTertiary,
                          borderRadius: '4px',
                          fontSize: '12px',
                          lineHeight: '1.6',
                          color: colors.textSecondary,
                        }}
                      >
                        {termLibrary.style_summary.prompt}
                        <div
                          style={{
                            marginTop: 8,
                            fontSize: '11px',
                            color: colors.textTertiary,
                          }}
                        >
                          版本 v{termLibrary.style_summary.version} · 最后更新:{' '}
                          {new Date(termLibrary.style_summary.generated_at).toLocaleString('zh-CN')}
                        </div>
                      </div>
                    </div>
                  ),
                },
              ]}
            />
            <Divider style={{ margin: '12px 0' }} />
          </>
        )}

        {/* 如果有术语但没有风格总结，也显示管理入口 */}
        {termLibrary && !termLibrary.style_summary && termLibrary.metadata.total_terms > 0 && (
          <>
            <div
              style={{
                padding: '8px 12px',
                background: colors.bgTertiary,
                borderRadius: '4px',
                marginBottom: 12,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span style={{ fontSize: '12px', color: colors.textSecondary }}>
                <BookOutlined /> 术语库 ({termLibrary.metadata.total_terms}条)
              </span>
              <Button
                type="link"
                size="small"
                onClick={() => {
                  setShouldLoadTerms(true);
                  setTermLibraryVisible(true);
                }}
                style={{ fontSize: '11px' }}
              >
                管理
              </Button>
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
          mutateTermLibrary(); // 关闭后重新加载术语库
        }}
        apiKey={apiKey || ''}
      />
    </>
  );
};
