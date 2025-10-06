import React from 'react';
import { List, Progress, Typography } from 'antd';
import { POEntry } from '../types/tauri';

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
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ 
        padding: '12px 16px', 
        borderBottom: '1px solid #f0f0f0',
        background: '#fafafa',
        fontWeight: 600,
        fontSize: '14px'
      }}>
        条目列表 ({entries.length})
      </div>
      
      {isTranslating && (
        <div style={{ padding: '8px 16px' }}>
          <Progress 
            percent={Math.round(progress)} 
            size="small"
            status="active"
          />
        </div>
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
                backgroundColor: isSelected ? '#e6f7ff' : 'transparent',
                borderLeft: isSelected ? '3px solid #1890ff' : '3px solid transparent',
                padding: '10px 16px',
                transition: 'all 0.2s',
                borderBottom: '1px solid #f0f0f0',
              }}
              onClick={() => onEntrySelect(entry)}
            >
              <div style={{ width: '100%' }}>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  marginBottom: 6,
                  gap: '8px'
                }}>
                  <span style={{ fontSize: '16px' }}>
                    {getStatusIcon(status)}
                  </span>
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    #{index + 1}
                  </Text>
                  <div style={{ 
                    fontSize: '11px', 
                    color: getStatusColor(status),
                    fontWeight: '500',
                    marginLeft: 'auto'
                  }}>
                    {status === 'translated' && '✓ 已翻译'}
                    {status === 'untranslated' && '○ 未翻译'}
                    {status === 'empty' && '– 空'}
                  </div>
                </div>
                
                <div style={{ 
                  fontSize: '13px',
                  lineHeight: '1.4',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  color: '#262626'
                }}>
                  {entry.msgid || '(空条目)'}
                </div>
                
                {entry.msgctxt && (
                  <div style={{ 
                    fontSize: '11px', 
                    color: '#8c8c8c',
                    marginTop: 4,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    📌 {entry.msgctxt}
                  </div>
                )}
              </div>
            </List.Item>
          );
        }}
        style={{ 
          flex: 1,
          overflow: 'auto' 
        }}
      />
    </div>
  );
};
