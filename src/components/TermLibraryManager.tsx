import { useState, useEffect } from 'react';
import { App, Modal, Table, Button, Space, Popconfirm, Tag, Input, Tooltip } from 'antd';
import { useTranslation } from 'react-i18next';
import {
  DeleteOutlined,
  EditOutlined,
  ReloadOutlined,
  BookOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { TermEntry } from '../types/termLibrary';
import { useTermLibrary } from '../hooks/useTermLibrary';
import { useCssColors } from '../hooks/useCssColors';
import { useActiveAIConfig } from '../hooks/useConfig';
import { createModuleLogger } from '../utils/logger';
import { termLibraryCommands } from '../services/termCommands';
import { formatDateTime } from '../utils/formatters';
import { useAppStore } from '../store/useAppStore';
import { useTargetLanguage } from '../store';
import { buildMemoryKey } from '../utils/translationMemory';
import { canonicalTargetLanguage } from '../utils/translationMemory';

const { TextArea } = Input;
const log = createModuleLogger('TermLibraryManager');

interface TermLibraryManagerProps {
  visible: boolean;
  onClose: () => void;
  afterClose?: () => void;
}

interface EditingTerm {
  source: string;
  user_translation: string;
  original: TermEntry;
  revision: number;
}

const termKey = (term: TermEntry) => buildMemoryKey(term.source, term.context, term.language);

export function TermLibraryManager({ visible, onClose, afterClose }: TermLibraryManagerProps) {
  const { t } = useTranslation();
  const { message, modal } = App.useApp();
  const { activeAIConfig } = useActiveAIConfig();
  const { termLibrary: library, refresh, mutate } = useTermLibrary({ enabled: visible });
  const language = useAppStore((state) => state.language);
  const targetLanguage = useTargetLanguage();
  const [loading, setLoading] = useState(false);
  const [editingKey, setEditingKey] = useState<string>('');
  const [editingTerm, setEditingTerm] = useState<EditingTerm | null>(null);
  const cssColors = useCssColors();

  useEffect(() => {
    if (visible) {
      refresh();
    }
  }, [visible, refresh]);

  // 删除术语
  const handleDelete = async (term: TermEntry) => {
    try {
      await termLibraryCommands.removeTerm(
        term.source,
        term.context,
        term.language,
        library?.revision
      );
      message.success(t('messages.termDeleted'));
      await mutate();
    } catch (error) {
      log.logError(error, '删除术语失败');
      message.error(t('errors.termDeleteFailed'));
    }
  };

  // 开始编辑
  const handleEdit = (term: TermEntry) => {
    if (!library) return;
    setEditingKey(termKey(term));
    setEditingTerm({
      source: term.source,
      user_translation: term.user_translation,
      original: term,
      revision: library.revision,
    });
  };

  // 保存编辑
  const handleSave = async () => {
    if (!editingTerm) return;

    try {
      const original = editingTerm.original;

      await termLibraryCommands.addTerm({
        source: editingTerm.source,
        userTranslation: editingTerm.user_translation,
        aiTranslation: original.ai_translation,
        context: original.context || null,
        language: original.language || targetLanguage,
        expectedRevision: editingTerm.revision,
      });

      message.success(t('messages.termUpdated'));
      setEditingKey('');
      setEditingTerm(null);
      await mutate();
    } catch (error) {
      log.logError(error, '更新术语失败');
      message.error(t('errors.termUpdateFailed'));
    }
  };

  // 取消编辑
  const handleCancel = () => {
    setEditingKey('');
    setEditingTerm(null);
  };

  const requestClose = () => {
    const dirty =
      editingTerm !== null &&
      (editingTerm.source !== editingTerm.original.source ||
        editingTerm.user_translation !== editingTerm.original.user_translation);
    if (!dirty) {
      onClose();
      return;
    }
    modal.confirm({
      title: t('libraryDraft.discardTitle'),
      content: t('libraryDraft.discardDescription'),
      okText: t('document.discard'),
      cancelText: t('common.cancel'),
      okButtonProps: { danger: true },
      onOk: onClose,
    });
  };

  const handleGenerateStyleSummary = async () => {
    if (!activeAIConfig) {
      message.error(t('messages.aiConfigRequired'));
      return;
    }

    log.info('开始生成风格总结', { termCount: library?.metadata.total_terms || 0 });
    setLoading(true);
    try {
      const summary = await termLibraryCommands.generateStyleSummary(targetLanguage, null);
      const summaryText = typeof summary === 'string' ? summary : String(summary);
      log.info('风格总结生成成功', { summary: summaryText.substring(0, 50) + '...' });
      message.success(t('messages.styleSummaryGenerated'));
      await mutate();
    } catch (error) {
      log.logError(error, '生成风格总结失败');
      message.error(
        t('errors.generateFailed', {
          error: error instanceof Error ? error.message : t('errors.unknown'),
        })
      );
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    { title: t('memoryManager.language'), dataIndex: 'language', key: 'language', width: 100 },
    {
      title: t('memoryManager.context'),
      dataIndex: 'context',
      key: 'context',
      width: 160,
      ellipsis: true,
      render: (context: string | null) => (
        <Tooltip title={context}>{context ?? t('terms.genericContext')}</Tooltip>
      ),
    },
    {
      title: t('memoryManager.original'),
      dataIndex: 'source',
      key: 'source',
      width: '30%',
      ellipsis: true,
      render: (text: string) => (
        <Tooltip title={text}>
          <span style={{ fontSize: 'var(--font-size-base)' }}>{text}</span>
        </Tooltip>
      ),
    },
    {
      title: t('terms.userTranslation'),
      dataIndex: 'user_translation',
      key: 'user_translation',
      width: '25%',
      render: (text: string, record: TermEntry) => {
        const isEditing = editingKey === termKey(record);
        return isEditing ? (
          <TextArea
            aria-label={t('terms.userTranslation')}
            value={editingTerm?.user_translation}
            onChange={(e) => setEditingTerm({ ...editingTerm!, user_translation: e.target.value })}
            autoSize={{ minRows: 1, maxRows: 4 }}
            style={{ fontSize: 'var(--font-size-base)' }}
          />
        ) : (
          <span style={{ fontSize: 'var(--font-size-base)', color: cssColors.statusTranslated }}>
            {text}
          </span>
        );
      },
    },
    {
      title: t('terms.aiTranslation'),
      dataIndex: 'ai_translation',
      key: 'ai_translation',
      width: '25%',
      ellipsis: true,
      render: (text: string) => (
        <Tooltip title={text}>
          <span style={{ fontSize: 'var(--font-size-base)', color: cssColors.textTertiary }}>
            {text}
          </span>
        </Tooltip>
      ),
    },
    {
      title: t('terms.frequency'),
      dataIndex: 'frequency',
      key: 'frequency',
      width: '8%',
      align: 'center' as const,
      render: (freq: number) => <Tag color={freq > 3 ? 'green' : 'default'}>{freq}</Tag>,
    },
    {
      title: t('memoryManager.actions'),
      key: 'action',
      width: '12%',
      render: (_: unknown, record: TermEntry) => {
        const isEditing = editingKey === termKey(record);
        return isEditing ? (
          <Space size="small">
            <Button size="small" type="primary" onClick={handleSave}>
              {t('common.save')}
            </Button>
            <Button size="small" onClick={handleCancel}>
              {t('common.cancel')}
            </Button>
          </Space>
        ) : (
          <Space size="small">
            <Button
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
              aria-label={t('common.edit')}
            />
            <Popconfirm
              title={t('terms.deleteConfirm')}
              onConfirm={() => handleDelete(record)}
              okText={t('common.confirm')}
              cancelText={t('common.cancel')}
            >
              <Button
                size="small"
                danger
                icon={<DeleteOutlined />}
                aria-label={t('common.delete')}
              />
            </Popconfirm>
          </Space>
        );
      },
    },
  ];

  return (
    <Modal
      title={
        <span>
          <BookOutlined /> {t('terms.title')}
          {library && (
            <Tag color="blue" style={{ marginLeft: 'var(--space-2)' }}>
              {t('terms.count', { count: library.metadata.total_terms })}
            </Tag>
          )}
        </span>
      }
      open={visible}
      onCancel={requestClose}
      afterClose={afterClose}
      width={1040}
      centered
      destroyOnHidden
      footer={[
        <Button key="refresh" icon={<ReloadOutlined />} onClick={() => refresh()}>
          {t('common.refresh')}
        </Button>,
        <Button
          key="generate"
          type="primary"
          icon={<ThunderboltOutlined />}
          onClick={handleGenerateStyleSummary}
          loading={loading}
          disabled={
            !library?.terms.some(
              (term) =>
                term.language === canonicalTargetLanguage(targetLanguage) && term.context === null
            )
          }
        >
          {t('terms.generateSummary')}
        </Button>,
        <Button key="close" onClick={requestClose}>
          {t('common.close')}
        </Button>,
      ]}
    >
      {/* 风格提示词说明 */}
      <div
        style={{
          marginBottom: 'var(--space-4)',
          padding: 'var(--space-2) var(--space-3)',
          background: cssColors.bgTertiary,
          border: `1px solid ${cssColors.borderPrimary}`,
          borderRadius: 'var(--radius-sm)',
        }}
      >
        <div
          style={{
            fontSize: 'var(--font-size-sm)',
            color: cssColors.textSecondary,
            lineHeight: '1.6',
          }}
        >
          {t('terms.description')}
        </div>
      </div>

      {/* 风格总结展示 */}
      {library?.style_summary && (
        <div
          style={{
            marginBottom: 'var(--space-4)',
            padding: 'var(--space-3)',
            background: cssColors.bgTertiary,
            borderRadius: 'var(--radius-sm)',
          }}
        >
          <div
            style={{
              fontSize: 'var(--font-size-sm)',
              fontWeight: 600,
              marginBottom: 'var(--space-2)',
              color: cssColors.textPrimary,
            }}
          >
            {t('terms.summaryVersion', {
              version: library.style_summary.version,
              language: library.style_summary.language,
            })}
          </div>
          <div
            style={{
              fontSize: 'var(--font-size-base)',
              lineHeight: '1.6',
              color: cssColors.textSecondary,
            }}
          >
            {library.style_summary.prompt}
          </div>
          <div
            style={{
              fontSize: 'var(--font-size-xs)',
              marginTop: 'var(--space-2)',
              color: cssColors.textTertiary,
            }}
          >
            {t('terms.summaryDate', {
              count: library.style_summary.based_on_terms,
              date: formatDateTime(library.style_summary.generated_at, language),
            })}
          </div>
        </div>
      )}

      {/* 术语列表 */}
      <Table
        columns={columns}
        dataSource={library?.terms || []}
        rowKey={termKey}
        loading={loading}
        pagination={{
          pageSize: 10,
          showSizeChanger: true,
          showTotal: (total) => t('terms.count', { count: total }),
        }}
        size="middle"
        scroll={{ x: 960 }}
        locale={{
          emptyText: t('terms.empty'),
        }}
      />

      {/* 提示信息 */}
      {library && library.terms.length === 0 && (
        <div
          style={{
            textAlign: 'center',
            padding: 'var(--space-8) var(--space-4)',
            color: cssColors.textTertiary,
          }}
        >
          <BookOutlined
            style={{ fontSize: 'var(--font-size-2xl)', marginBottom: 'var(--space-4)' }}
          />
          <div>{t('terms.empty')}</div>
          <div style={{ fontSize: 'var(--font-size-sm)', marginTop: 'var(--space-2)' }}>
            {t('terms.emptyHelp')}
          </div>
        </div>
      )}
    </Modal>
  );
}
