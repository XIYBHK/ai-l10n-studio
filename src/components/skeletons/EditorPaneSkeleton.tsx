import React from 'react';
import SkeletonBase from './SkeletonBase';

const EditorPaneSkeleton: React.FC = () => {
  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    gap: '16px',
    padding: '16px',
  };

  const toolbarStyle: React.CSSProperties = {
    display: 'flex',
    gap: '8px',
    padding: '8px',
    borderBottom: '1px solid var(--color-border, #e0e0e0)',
  };

  const editorAreaStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    flex: 1,
    padding: '16px',
    backgroundColor: 'var(--color-bgSecondary, #fafafa)',
    borderRadius: 'var(--radius-md, 8px)',
  };

  return (
    <div style={containerStyle}>
      {/* 工具栏 */}
      <div style={toolbarStyle}>
        <SkeletonBase variant="rect" width={32} height={32} />
        <SkeletonBase variant="rect" width={32} height={32} />
        <SkeletonBase variant="rect" width={32} height={32} />
        <div style={{ flex: 1 }} />
        <SkeletonBase variant="rect" width={100} height={32} />
      </div>

      {/* 源码区域 */}
      <div style={editorAreaStyle}>
        <SkeletonBase variant="text" width={60} height={14} />
        <SkeletonBase variant="text" width="100%" height={16} />
        <SkeletonBase variant="text" width="95%" height={16} />
        <SkeletonBase variant="text" width="90%" height={16} />
        <SkeletonBase variant="text" width="85%" height={16} />
        <SkeletonBase variant="text" width="100%" height={16} />
        <SkeletonBase variant="text" width="70%" height={16} />
      </div>

      {/* 目标语区域 */}
      <div style={editorAreaStyle}>
        <SkeletonBase variant="text" width={80} height={14} />
        <SkeletonBase variant="text" width="100%" height={16} />
        <SkeletonBase variant="text" width="92%" height={16} />
        <SkeletonBase variant="text" width="88%" height={16} />
        <SkeletonBase variant="text" width="100%" height={16} />
        <SkeletonBase variant="text" width="75%" height={16} />
      </div>
    </div>
  );
};

export default EditorPaneSkeleton;
