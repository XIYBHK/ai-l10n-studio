import React from 'react';
import { Tag, Space, Tooltip } from 'antd';
import { useFileFormat, useFileMetadata } from '../hooks/useFileFormat';

interface FileInfoBarProps {
  filePath?: string | null;
}

export const FileInfoBar: React.FC<FileInfoBarProps> = ({ filePath }) => {
  const { format, isLoading: loadingFormat } = useFileFormat(filePath || null);
  const { metadata, isLoading: loadingMeta } = useFileMetadata(filePath || null);

  if (!filePath) {
    return null;
  }

  return (
    <div style={{ padding: '6px 16px', borderTop: '1px solid #f0f0f0', fontSize: 12 }}>
      <Space size="small" wrap>
        <Tag color="blue">文件</Tag>
        <span>{filePath.split(/[/\\]/).pop()}</span>
        {loadingFormat ? <Tag>格式加载中...</Tag> : format && <Tag color="geekblue">{format}</Tag>}
        {loadingMeta ? (
          <Tag>元数据加载中...</Tag>
        ) : metadata ? (
          <>
            {metadata.totalEntries !== undefined && (
              <Tag color="purple">{metadata.totalEntries} entries</Tag>
            )}
          </>
        ) : null}
      </Space>
    </div>
  );
};
