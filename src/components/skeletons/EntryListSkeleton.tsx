import React from 'react';
import SkeletonBase from './SkeletonBase';

const EntryListSkeleton: React.FC = () => {
  const skeletonStyle: React.CSSProperties = {
    display: 'flex',
    gap: '16px',
    height: '100%',
    padding: '16px',
  };

  const columnStyle: React.CSSProperties = {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  };

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
  };

  const itemStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    padding: '12px',
    backgroundColor: 'var(--color-bgSecondary, #fafafa)',
    borderRadius: 'var(--radius-md, 8px)',
  };

  // 生成5-7个随机项
  const itemCounts = [5, 6, 7];

  return (
    <div style={skeletonStyle}>
      {[0, 1, 2].map((colIndex) => (
        <div key={colIndex} style={columnStyle}>
          {/* 列标题 */}
          <div style={headerStyle}>
            <SkeletonBase variant="text" width={80} height={20} />
            <SkeletonBase variant="circle" width={24} height={24} />
          </div>

          {/* 骨架项 */}
          {Array.from({ length: itemCounts[colIndex] }).map((_, index) => (
            <div key={index} style={itemStyle}>
              <SkeletonBase variant="text" width="60%" height={16} />
              <SkeletonBase variant="text" width="80%" height={14} />
              <SkeletonBase variant="text" width="40%" height={12} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};

export default EntryListSkeleton;
