import { memo } from 'react';
import { Space } from 'antd';
import { useTranslation } from 'react-i18next';
import { useFileFormat, useFileMetadata } from '../hooks/useFileFormat';
import { CSS_COLORS } from '../hooks/useCssColors';

interface FileInfoBarProps {
  filePath?: string | null;
}

export const FileInfoBar = memo(function FileInfoBar({ filePath }: FileInfoBarProps) {
  const { t } = useTranslation();
  const { format, isLoading: loadingFormat } = useFileFormat(filePath || null);
  const { metadata, isLoading: loadingMeta } = useFileMetadata(filePath || null);

  if (!filePath) {
    return null;
  }

  return (
    <div
      style={{
        padding: '8px 20px',
        borderTop: `1px solid ${CSS_COLORS.borderSecondary}`,
        backgroundColor: CSS_COLORS.bgPrimary,
        fontSize: 'var(--font-size-xs)',
        color: CSS_COLORS.textSecondary,
      }}
    >
      <Space size={12} separator={<span aria-hidden="true">·</span>} wrap>
        <span style={{ color: CSS_COLORS.textPrimary }}>{filePath.split(/[/\\]/).pop()}</span>
        {loadingFormat ? t('common.loading') : format?.toUpperCase()}
        {loadingMeta ? (
          t('common.loading')
        ) : metadata ? (
          <>
            {metadata.total_entries !== undefined && (
              <span>{t('workspace.entryCount', { count: metadata.total_entries })}</span>
            )}
          </>
        ) : null}
      </Space>
    </div>
  );
});
