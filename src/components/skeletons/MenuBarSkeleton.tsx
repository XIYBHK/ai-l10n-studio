import React from 'react';
import SkeletonBase from './SkeletonBase';

const MenuBarSkeleton: React.FC = () => {
  const containerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 16px',
    height: '48px',
    backgroundColor: 'var(--color-bgPrimary, #ffffff)',
    borderBottom: '1px solid var(--color-border, #e0e0e0)',
  };

  const leftSectionStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  };

  const centerSectionStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  };

  const rightSectionStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  };

  return (
    <div style={containerStyle}>
      {/* 左侧：Logo */}
      <div style={leftSectionStyle}>
        <SkeletonBase variant="rect" width={32} height={32} />
        <SkeletonBase variant="text" width={120} height={20} />
      </div>

      {/* 中间：按钮组 */}
      <div style={centerSectionStyle}>
        <SkeletonBase variant="rect" width={80} height={32} />
        <SkeletonBase variant="rect" width={80} height={32} />
        <SkeletonBase variant="rect" width={80} height={32} />
        <SkeletonBase variant="rect" width={80} height={32} />
      </div>

      {/* 右侧：语言选择器和操作按钮 */}
      <div style={rightSectionStyle}>
        <SkeletonBase variant="rect" width={100} height={32} />
        <SkeletonBase variant="circle" width={32} height={32} />
        <SkeletonBase variant="circle" width={32} height={32} />
      </div>
    </div>
  );
};

export default MenuBarSkeleton;
