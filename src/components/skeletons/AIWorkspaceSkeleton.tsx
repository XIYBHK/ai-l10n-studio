import React from 'react';
import SkeletonBase from './SkeletonBase';

const AIWorkspaceSkeleton: React.FC = () => {
  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    padding: '16px',
    height: '100%',
  };

  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '12px',
  };

  const cardStyle: React.CSSProperties = {
    padding: '16px',
    backgroundColor: 'var(--color-bgSecondary, #fafafa)',
    borderRadius: 'var(--radius-md, 8px)',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  };

  const sectionStyle: React.CSSProperties = {
    padding: '16px',
    backgroundColor: 'var(--color-bgSecondary, #fafafa)',
    borderRadius: 'var(--radius-md, 8px)',
  };

  return (
    <div style={containerStyle}>
      {/* 统计卡片 2x2网格 */}
      <div style={gridStyle}>
        <div style={cardStyle}>
          <SkeletonBase variant="text" width={40} height={12} />
          <SkeletonBase variant="text" width={60} height={24} />
          <SkeletonBase variant="text" width="80%" height={14} />
        </div>
        <div style={cardStyle}>
          <SkeletonBase variant="text" width={50} height={12} />
          <SkeletonBase variant="text" width={80} height={24} />
          <SkeletonBase variant="text" width="70%" height={14} />
        </div>
        <div style={cardStyle}>
          <SkeletonBase variant="text" width={45} height={12} />
          <SkeletonBase variant="text" width={70} height={24} />
          <SkeletonBase variant="text" width="75%" height={14} />
        </div>
        <div style={cardStyle}>
          <SkeletonBase variant="text" width={55} height={12} />
          <SkeletonBase variant="text" width={90} height={24} />
          <SkeletonBase variant="text" width="65%" height={14} />
        </div>
      </div>

      {/* 成本分析区域 */}
      <div style={sectionStyle}>
        <SkeletonBase variant="text" width={100} height={16} style={{ marginBottom: '12px' }} />
        <SkeletonBase variant="text" width="100%" height={60} />
        <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
          <SkeletonBase variant="text" width="30%" height={14} />
          <SkeletonBase variant="text" width="30%" height={14} />
          <SkeletonBase variant="text" width="30%" height={14} />
        </div>
      </div>

      {/* 术语库区域 */}
      <div style={sectionStyle}>
        <SkeletonBase variant="text" width={80} height={16} style={{ marginBottom: '12px' }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <SkeletonBase variant="text" width="100%" height={36} />
          <SkeletonBase variant="text" width="95%" height={36} />
          <SkeletonBase variant="text" width="90%" height={36} />
        </div>
      </div>
    </div>
  );
};

export default AIWorkspaceSkeleton;
