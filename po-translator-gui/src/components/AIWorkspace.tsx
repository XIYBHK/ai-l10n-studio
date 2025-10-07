import React, { useState, useEffect } from 'react';
import { Card, Statistic, Row, Col, Progress, Tag, Divider, Button, Popconfirm, Collapse } from 'antd';
import { 
  ThunderboltOutlined, 
  DatabaseOutlined, 
  DeleteOutlined,
  RobotOutlined,
  DollarOutlined,
  CheckCircleOutlined,
  SettingOutlined,
  ReloadOutlined,
  BookOutlined
} from '@ant-design/icons';
import { TranslationStats } from '../types/tauri';
import { TermLibrary } from '../types/termLibrary';
import { MemoryManager } from './MemoryManager';
import { TermLibraryManager } from './TermLibraryManager';
import { useTheme } from '../hooks/useTheme';
import { useAppStore } from '../store/useAppStore';
import { invoke } from '@tauri-apps/api/tauri';

interface AIWorkspaceProps {
  stats: TranslationStats | null;
  isTranslating: boolean;
  onResetStats?: () => void;
  apiKey?: string; // 用于生成风格总结
}

export const AIWorkspace: React.FC<AIWorkspaceProps> = ({ stats, isTranslating, onResetStats, apiKey }) => {
  const [memoryManagerVisible, setMemoryManagerVisible] = useState(false);
  const [termLibraryVisible, setTermLibraryVisible] = useState(false);
  const [termLibrary, setTermLibrary] = useState<TermLibrary | null>(null);
  const { colors } = useTheme();
  
  // 从 store 读取累计统计
  const { cumulativeStats, updateCumulativeStats, resetCumulativeStats } = useAppStore();

  // 加载术语库
  const loadTermLibrary = async () => {
    try {
      const library = await invoke<TermLibrary>('get_term_library');
      setTermLibrary(library);
    } catch (error) {
      console.error('加载术语库失败:', error);
    }
  };

  useEffect(() => {
    loadTermLibrary();
  }, []);
  
  // 当stats更新时累加到cumulative（使用store）
  useEffect(() => {
    if (stats) {
      updateCumulativeStats(stats);
    }
  }, [stats, updateCumulativeStats]);
  
  const handleReset = () => {
    resetCumulativeStats();
    if (onResetStats) {
      onResetStats();
    }
  };

  // 简化的累计统计渲染
  const renderCumulativeStats = () => {
    if (cumulativeStats.total === 0) {
      return (
        <div style={{ 
          padding: '12px', 
          textAlign: 'center', 
          color: colors.textTertiary,
          fontSize: '12px'
        }}>
          暂无累计数据
        </div>
      );
    }
    
    const estimatedCost = `¥${cumulativeStats.token_stats.cost.toFixed(4)}`;
    
    return (
      <div>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          marginBottom: 8
        }}>
          <span style={{ fontSize: '12px', color: colors.textSecondary, fontWeight: 600 }}>📊 累计统计</span>
          <Popconfirm
            title="确认重置累计统计数据？"
            onConfirm={handleReset}
            okText="确认"
            cancelText="取消"
          >
            <Button type="text" size="small" icon={<ReloadOutlined />} danger style={{ fontSize: '11px', height: '22px' }}>
              重置
            </Button>
          </Popconfirm>
        </div>
        
        {/* 精简数据展示 */}
        <div style={{ 
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '8px',
          fontSize: '11px'
        }}>
          <div style={{ textAlign: 'center', padding: '6px', background: colors.bgTertiary, borderRadius: '4px' }}>
            <div style={{ color: colors.textTertiary }}>总计</div>
            <div style={{ fontSize: '16px', fontWeight: 600, color: colors.textPrimary }}>{cumulativeStats.total}</div>
          </div>
          <div style={{ textAlign: 'center', padding: '6px', background: colors.bgTertiary, borderRadius: '4px' }}>
            <div style={{ color: colors.textTertiary }}>命中</div>
            <div style={{ fontSize: '16px', fontWeight: 600, color: colors.statusTranslated }}>{cumulativeStats.tm_hits}</div>
          </div>
          <div style={{ textAlign: 'center', padding: '6px', background: colors.bgTertiary, borderRadius: '4px' }}>
            <div style={{ color: colors.textTertiary }}>AI调用</div>
            <div style={{ fontSize: '16px', fontWeight: 600, color: colors.statusUntranslated }}>{cumulativeStats.ai_translated}</div>
          </div>
        </div>
        
        {/* Token和费用 */}
        <div style={{ 
          marginTop: 8,
          padding: '6px 8px',
          background: colors.bgTertiary,
          borderRadius: '4px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '11px'
        }}>
          <span style={{ color: colors.textSecondary }}>
            Token: {cumulativeStats.token_stats.total_tokens.toLocaleString()}
          </span>
          <span style={{ fontWeight: 600, color: colors.statusTranslated }}>
            {estimatedCost}
          </span>
        </div>
      </div>
    );
  };

  // 详细的本次翻译渲染
  const renderCurrentStats = () => {
    if (!stats || stats.total === 0) {
      return (
        <div style={{ 
          padding: '20px', 
          textAlign: 'center', 
          color: colors.textTertiary,
          fontSize: '13px'
        }}>
          暂无数据
        </div>
      );
    }
    
    const estimatedCost = `¥${stats.token_stats.cost.toFixed(4)}`;
    // 正确计算：记忆库命中 + 去重节省
    const savedApiCalls = stats.tm_hits + stats.deduplicated;
    
    return (
      <div>
        <div style={{ 
          fontSize: '12px', 
          color: colors.textSecondary, 
          fontWeight: 600,
          marginBottom: 12 
        }}>
          ⚡ 本次翻译
        </div>
        
        {/* 处理效率 */}
        <Row gutter={16}>
          <Col span={12}>
            <Statistic
              title={
                <span style={{ fontSize: '12px' }}>
                  <DatabaseOutlined /> 记忆库命中
                </span>
              }
              value={stats.tm_hits}
              suffix={`/ ${stats.total}`}
              valueStyle={{ fontSize: '20px' }}
            />
            <Progress 
              percent={stats.total > 0 ? Math.round((stats.tm_hits / stats.total) * 100) : 0} 
              strokeColor={colors.statusTranslated}
              size="small"
              showInfo={true}
            />
          </Col>
          <Col span={12}>
            <Statistic
              title={
                <span style={{ fontSize: '12px' }}>
                  <DeleteOutlined /> 去重优化
                </span>
              }
              value={stats.deduplicated}
              suffix={`/ ${stats.total}`}
              valueStyle={{ fontSize: '20px' }}
            />
            <Progress 
              percent={stats.total > 0 ? Math.round((stats.deduplicated / stats.total) * 100) : 0} 
              strokeColor={colors.statusUntranslated}
              size="small"
              showInfo={true}
            />
          </Col>
        </Row>

        {/* AI翻译 */}
        <Row gutter={16} style={{ marginTop: 16 }}>
          <Col span={12}>
            <Statistic
              title={
                <span style={{ fontSize: '12px' }}>
                  <ThunderboltOutlined /> AI调用次数
                </span>
              }
              value={stats.ai_translated}
              valueStyle={{ fontSize: '20px' }}
            />
          </Col>
          <Col span={12}>
            <Statistic
              title={
                <span style={{ fontSize: '12px' }}>
                  <CheckCircleOutlined /> 新学习短语
                </span>
              }
              value={stats.tm_learned}
              valueStyle={{ fontSize: '20px', color: colors.statusTranslated }}
            />
          </Col>
        </Row>

        {/* Token消耗 */}
        <Row gutter={16} style={{ marginTop: 16 }}>
          <Col span={8}>
            <Statistic
              title={<span style={{ fontSize: '11px' }}>输入</span>}
              value={stats.token_stats.input_tokens}
              valueStyle={{ fontSize: '16px' }}
            />
          </Col>
          <Col span={8}>
            <Statistic
              title={<span style={{ fontSize: '11px' }}>输出</span>}
              value={stats.token_stats.output_tokens}
              valueStyle={{ fontSize: '16px' }}
            />
          </Col>
          <Col span={8}>
            <Statistic
              title={<span style={{ fontSize: '11px' }}>总计</span>}
              value={stats.token_stats.total_tokens}
              valueStyle={{ fontSize: '16px' }}
            />
          </Col>
        </Row>

        {/* 预估费用 */}
        <div style={{ 
          marginTop: 12, 
          padding: '8px 12px', 
          background: colors.bgTertiary, 
          border: `1px solid ${colors.borderSecondary}`,
          borderRadius: '4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <span style={{ fontSize: '12px', color: colors.textSecondary }}>
            <DollarOutlined /> 预估费用
          </span>
          <span style={{ fontSize: '16px', fontWeight: 600, color: colors.statusTranslated }}>
            {estimatedCost}
          </span>
        </div>

        {/* 效率提示 */}
        {savedApiCalls > 0 && (
          <div style={{ 
            marginTop: 12, 
            padding: '8px 12px', 
            background: colors.bgTertiary, 
            border: `1px solid ${colors.borderSecondary}`,
            borderRadius: '4px',
            fontSize: '12px',
            color: colors.textSecondary
          }}>
            💡 记忆库命中 <strong>{stats.tm_hits}</strong> 条，去重节省 <strong>{stats.deduplicated}</strong> 次，共节省 <strong>{savedApiCalls}</strong> 次API调用
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <Card 
        title={
          <span>
            <RobotOutlined /> AI 工作区
            {isTranslating && <Tag color="processing" style={{ marginLeft: 8 }}>翻译中...</Tag>}
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
                      <BookOutlined /> 学习到的翻译风格 ({termLibrary.style_summary.based_on_terms}条术语)
                    </span>
                  ),
                  extra: (
                    <Button
                      type="link"
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        setTermLibraryVisible(true);
                      }}
                      style={{ fontSize: '11px', padding: 0 }}
                    >
                      管理
                    </Button>
                  ),
                  children: (
                    <div>
                      <div style={{ 
                        padding: '8px 12px',
                        background: colors.bgTertiary,
                        borderRadius: '4px',
                        fontSize: '12px',
                        lineHeight: '1.6',
                        color: colors.textSecondary
                      }}>
                        {termLibrary.style_summary.prompt}
                        <div style={{ 
                          marginTop: 8, 
                          fontSize: '11px', 
                          color: colors.textTertiary 
                        }}>
                          版本 v{termLibrary.style_summary.version} · 最后更新: {new Date(termLibrary.style_summary.generated_at).toLocaleString('zh-CN')}
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
            <div style={{
              padding: '8px 12px',
              background: colors.bgTertiary,
              borderRadius: '4px',
              marginBottom: 12,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <span style={{ fontSize: '12px', color: colors.textSecondary }}>
                <BookOutlined /> 术语库 ({termLibrary.metadata.total_terms}条)
              </span>
              <Button
                type="link"
                size="small"
                onClick={() => setTermLibraryVisible(true)}
                style={{ fontSize: '11px' }}
              >
                管理
              </Button>
            </div>
            <Divider style={{ margin: '12px 0' }} />
          </>
        )}
        
        {/* 本次翻译 - 详细样式 */}
        {renderCurrentStats()}
      </Card>
      <MemoryManager
        visible={memoryManagerVisible}
        onClose={() => setMemoryManagerVisible(false)}
      />
      <TermLibraryManager
        visible={termLibraryVisible}
        onClose={() => {
          setTermLibraryVisible(false);
          loadTermLibrary(); // 关闭后重新加载术语库
        }}
        apiKey={apiKey || ''}
      />
    </>
  );
};
