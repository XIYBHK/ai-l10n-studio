import { memo } from 'react';
import { Tag, Space } from 'antd';
import { useFileFormat, useFileMetadata } from '../hooks/useFileFormat';
import { CSS_COLORS } from '../hooks/useCssColors';

interface FileInfoBarProps {
  filePath?: string | null;
}

export const FileInfoBar = memo(function FileInfoBar({ filePath }: FileInfoBarProps) {
  const { format, isLoading: loadingFormat } = useFileFormat(filePath || null);
  const { metadata, isLoading: loadingMeta } = useFileMetadata(filePath || null);

  if (!filePath) {
    return null;
  }

  return (
    <div
      style={{
        padding: 'var(--space-1) var(--space-4)',
        borderTop: `1px solid ${CSS_COLORS.borderPrimary}`,
        backgroundColor: CSS_COLORS.bgTertiary,
        fontSize: 'var(--font-size-xs)',
        color: CSS_COLORS.textSecondary,
      }}
    >
      <Space size="small" wrap>
        <Tag color="blue">文件</Tag>
        <span style={{ color: CSS_COLORS.textPrimary }}>{filePath.split(/[/\\]/).pop()}</span>
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
});
