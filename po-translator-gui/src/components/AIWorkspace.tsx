import React, { useState, useEffect } from 'react';
import { Card, Statistic, Row, Col, Progress, Tag, Divider, Button, Popconfirm } from 'antd';
import { 
  ThunderboltOutlined, 
  DatabaseOutlined, 
  DeleteOutlined,
  RobotOutlined,
  DollarOutlined,
  CheckCircleOutlined,
  SettingOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import { TranslationStats } from '../types/tauri';
import { MemoryManager } from './MemoryManager';
import { useTheme } from '../hooks/useTheme';

interface AIWorkspaceProps {
  stats: TranslationStats | null;
  isTranslating: boolean;
  onResetStats?: () => void;
}

export const AIWorkspace: React.FC<AIWorkspaceProps> = ({ stats, isTranslating, onResetStats }) => {
  const [memoryManagerVisible, setMemoryManagerVisible] = useState(false);
  const { colors } = useTheme();
  
  // 累计统计
  const [cumulativeStats, setCumulativeStats] = useState<TranslationStats>({
    total: 0,
    tm_hits: 0,
    deduplicated: 0,
    ai_translated: 0,
    token_stats: {
      input_tokens: 0,
      output_tokens: 0,
      total_tokens: 0,
      cost: 0
    },
    tm_learned: 0
  });
  
  // 当stats更新时累加到cumulative
  useEffect(() => {
    if (stats) {
      setCumulativeStats(prev => ({
        total: prev.total + stats.total,
        tm_hits: prev.tm_hits + stats.tm_hits,
        deduplicated: prev.deduplicated + stats.deduplicated,
        ai_translated: prev.ai_translated + stats.ai_translated,
        token_stats: {
          input_tokens: prev.token_stats.input_tokens + stats.token_stats.input_tokens,
          output_tokens: prev.token_stats.output_tokens + stats.token_stats.output_tokens,
          total_tokens: prev.token_stats.total_tokens + stats.token_stats.total_tokens,
          cost: prev.token_stats.cost + stats.token_stats.cost
        },
        tm_learned: prev.tm_learned + stats.tm_learned
      }));
    }
  }, [stats]);
  
  const handleReset = () => {
    setCumulativeStats({
      total: 0,
      tm_hits: 0,
      deduplicated: 0,
      ai_translated: 0,
      token_stats: {
        input_tokens: 0,
        output_tokens: 0,
        total_tokens: 0,
        cost: 0
      },
      tm_learned: 0
    });
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
        
        {/* 本次翻译 - 详细样式 */}
        {renderCurrentStats()}
      </Card>
      <MemoryManager
        visible={memoryManagerVisible}
        onClose={() => setMemoryManagerVisible(false)}
      />
    </>
  );
};
