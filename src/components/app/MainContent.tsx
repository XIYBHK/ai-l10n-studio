/**
 * 主内容区域
 * 包含 EntryList 和 EditorPane
 */

import React from 'react';
import { Layout } from 'antd';
import EntryList from '../EntryList';
import EditorPane from '../EditorPane';
import { useSessionStore } from '../../store';
import { useTheme } from '../../hooks/useTheme';

const { Sider, Content } = Layout;

interface MainContentProps {
  currentIndex: number;
  onEntrySelect: (entry: any, index: number) => void;
  onEntryUpdate: (index: number, updates: any) => void;
  leftWidth: number;
  onWidthChange: (width: number) => void;
}

export const MainContent: React.FC<MainContentProps> = ({
  onEntrySelect,
  onEntryUpdate,
  leftWidth,
}) => {
  const { colors } = useTheme();
  const { entries, currentEntry, isTranslating, progress } = useSessionStore();

  const handleEntrySelect = (entry: any) => {
    const index = entries.findIndex((e) => e === entry);
    if (index >= 0) {
      onEntrySelect(entry, index);
    }
  };

  const currentAiTranslation = undefined; // 可扩展为 AI 翻译结果

  return (
    <Layout style={{ height: '100%', background: colors.bgPrimary }}>
      {/* 左侧：条目列表 */}
      <Sider
        width={`${leftWidth}%`}
        style={{
          background: colors.bgPrimary,
          borderRight: `1px solid ${colors.borderPrimary}`,
          overflow: 'hidden',
        }}
        collapsible={false}
      >
        <EntryList
          entries={entries}
          currentEntry={currentEntry}
          isTranslating={isTranslating}
          progress={progress}
          onEntrySelect={handleEntrySelect}
        />
      </Sider>

      {/* 右侧：编辑器 */}
      <Content
        style={{
          background: colors.bgPrimary,
          overflow: 'hidden',
        }}
      >
        <EditorPane
          entry={currentEntry}
          onEntryUpdate={onEntryUpdate}
          aiTranslation={currentAiTranslation}
        />
      </Content>
    </Layout>
  );
};

export default MainContent;
