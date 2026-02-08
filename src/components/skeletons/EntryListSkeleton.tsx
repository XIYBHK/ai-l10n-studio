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
    padding: '8px 12px',
    backgroundColor: 'var(--color-bgTertiary, #f5f5f5)',
    borderRadius: 'var(--radius-lg, 12px)',
    height: '40px',
  };

  const itemStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    padding: '12px 16px',
    backgroundColor: 'var(--color-bgSecondary, #fafafa)',
    borderRadius: 'var(--radius-lg, 12px)',
    border: '1px solid var(--color-borderSecondary, #e8e8e8)',
  };

  const metaStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '8px',
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
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <SkeletonBase variant="circle" width={8} height={8} />
              <SkeletonBase variant="text" width={30} height={16} />
            </div>
          </div>

          {/* 骨架项 */}
          {Array.from({ length: itemCounts[colIndex] }).map((_, index) => (
            <div key={index} style={itemStyle}>
              <div style={metaStyle}>
                <SkeletonBase variant="text" width={40} height={12} />
                <SkeletonBase
                  variant="rect"
                  width={40}
                  height={16}
                  style={{ borderRadius: '20px' }}
                />
              </div>
              <SkeletonBase variant="text" width="70%" height={16} />
              <SkeletonBase variant="text" width="85%" height={14} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};

export default EntryListSkeleton;
