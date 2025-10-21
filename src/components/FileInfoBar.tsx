import React from 'react';
import { Tag, Space } from 'antd';
import { useFileFormat, useFileMetadata } from '../hooks/useFileFormat';
import { useTheme } from '../hooks/useTheme';

interface FileInfoBarProps {
  filePath?: string | null;
}

export const FileInfoBar: React.FC<FileInfoBarProps> = ({ filePath }) => {
  const { format, isLoading: loadingFormat } = useFileFormat(filePath || null);
  const { metadata, isLoading: loadingMeta } = useFileMetadata(filePath || null);
  const { colors } = useTheme();

  if (!filePath) {
    return null;
  }

  return (
    <div
      style={{
        padding: '6px 16px',
        borderTop: `1px solid ${colors.borderPrimary}`,
        backgroundColor: colors.bgTertiary,
        fontSize: 12,
        color: colors.textSecondary,
      }}
    >
      <Space size="small" wrap>
        <Tag color="blue">文件</Tag>
        <span style={{ color: colors.textPrimary }}>{filePath.split(/[/\\]/).pop()}</span>
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
