/**
 * 应用工作区
 * 包含统计信息、AI 工作区等
 */

import React from 'react';
import { Layout } from 'antd';
import AIWorkspace from '../AIWorkspace';
import { useSessionStore } from '../../store';
import { useTheme } from '../../hooks/useTheme';

const { Content } = Layout;

interface AppWorkspaceProps {
  onResetStats: () => void;
}

export const AppWorkspace: React.FC<AppWorkspaceProps> = ({
  onResetStats,
}) => {
  const { colors } = useTheme();
  const { isTranslating } = useSessionStore();

  return (
    <Content
      style={{
        background: colors.bgPrimary,
        borderLeft: `1px solid ${colors.borderPrimary}`,
        overflow: 'auto',
        height: '100%',
      }}
    >
      <AIWorkspace
        stats={null} // 已废弃，改用 sessionStats
        isTranslating={isTranslating}
        onResetStats={onResetStats}
      />
    </Content>
  );
};

export default AppWorkspace;
