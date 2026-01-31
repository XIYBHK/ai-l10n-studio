import React from 'react';
import MenuBarSkeleton from './MenuBarSkeleton';
import EntryListSkeleton from './EntryListSkeleton';
import EditorPaneSkeleton from './EditorPaneSkeleton';
import AIWorkspaceSkeleton from './AIWorkspaceSkeleton';

const TranslationWorkspaceSkeleton: React.FC = () => {
  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    width: '100%',
    backgroundColor: 'var(--color-bgPrimary, #ffffff)',
  };

  const mainContentStyle: React.CSSProperties = {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
  };

  const leftPanelStyle: React.CSSProperties = {
    width: '300px',
    minWidth: '250px',
    borderRight: '1px solid var(--color-border, #e0e0e0)',
    overflow: 'hidden',
  };

  const centerPanelStyle: React.CSSProperties = {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  };

  const rightPanelStyle: React.CSSProperties = {
    width: '320px',
    minWidth: '280px',
    borderLeft: '1px solid var(--color-border, #e0e0e0)',
    overflow: 'hidden',
  };

  return (
    <div style={containerStyle}>
      {/* 菜单栏 */}
      <MenuBarSkeleton />

      {/* 主内容区域 */}
      <div style={mainContentStyle}>
        {/* 左侧：条目列表 */}
        <div style={leftPanelStyle}>
          <EntryListSkeleton />
        </div>

        {/* 中间：编辑器 */}
        <div style={centerPanelStyle}>
          <EditorPaneSkeleton />
        </div>

        {/* 右侧：AI工作区 */}
        <div style={rightPanelStyle}>
          <AIWorkspaceSkeleton />
        </div>
      </div>
    </div>
  );
};

export default TranslationWorkspaceSkeleton;
