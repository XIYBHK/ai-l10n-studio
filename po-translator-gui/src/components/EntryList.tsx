import React from 'react';
import { List, Card, Progress, Typography } from 'antd';
import { POEntry } from '../types/tauri';
import { useAppStore } from '../store/useAppStore';

const { Text } = Typography;

interface EntryListProps {
  entries: POEntry[];
  currentEntry: POEntry | null;
  isTranslating: boolean;
  progress: number;
  onEntrySelect: (entry: POEntry) => void;
}

export const EntryList: React.FC<EntryListProps> = ({
  entries,
  currentEntry,
  isTranslating,
  progress,
  onEntrySelect,
}) => {
  const getEntryStatus = (entry: POEntry) => {
    if (!entry.msgid) return 'empty';
    if (entry.msgstr) return 'translated';
    return 'untranslated';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'translated':
        return '✅';
      case 'untranslated':
        return '⚪';
      case 'empty':
        return '⚫';
      default:
        return '❓';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'translated':
        return '#52c41a';
      case 'untranslated':
        return '#1890ff';
      case 'empty':
        return '#d9d9d9';
      default:
        return '#666';
    }
  };

  return (
    <Card title={`条目列表 (${entries.length})`} style={{ height: '100%' }}>
      {isTranslating && (
        <Progress 
          percent={progress} 
          style={{ marginBottom: 16 }} 
          status="active"
        />
      )}
      
      <List
        size="small"
        dataSource={entries}
        renderItem={(entry, index) => {
          const status = getEntryStatus(entry);
          const isSelected = currentEntry === entry;
          
          return (
            <List.Item
              style={{
                cursor: 'pointer',
                backgroundColor: isSelected ? '#f0f0f0' : 'transparent',
                borderRadius: '4px',
                margin: '2px 0',
                padding: '8px',
              }}
              onClick={() => onEntrySelect(entry)}
            >
              <div style={{ width: '100%' }}>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  marginBottom: 4 
                }}>
                  <span style={{ marginRight: 8 }}>
                    {getStatusIcon(status)}
                  </span>
                  <Text strong style={{ fontSize: '12px' }}>
                    #{index + 1}
                  </Text>
                </div>
                
                <div style={{ 
                  fontWeight: 'bold', 
                  marginBottom: 4,
                  fontSize: '13px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {entry.msgid || '(空)'}
                </div>
                
                <div style={{ 
                  fontSize: '11px', 
                  color: getStatusColor(status),
                  fontWeight: '500'
                }}>
                  {status === 'translated' && '已翻译'}
                  {status === 'untranslated' && '未翻译'}
                  {status === 'empty' && '空条目'}
                </div>
                
                {entry.msgctxt && (
                  <div style={{ 
                    fontSize: '10px', 
                    color: '#999',
                    marginTop: 2,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    上下文: {entry.msgctxt}
                  </div>
                )}
              </div>
            </List.Item>
          );
        }}
        style={{ 
          height: 'calc(100% - 60px)', 
          overflow: 'auto' 
        }}
      />
    </Card>
  );
};
