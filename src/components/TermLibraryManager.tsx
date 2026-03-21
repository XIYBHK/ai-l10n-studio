import { useState, useEffect } from 'react';
import { Modal, Table, Button, Space, message, Popconfirm, Tag, Input, Tooltip } from 'antd';
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
import { useAppData } from '../hooks/useConfig';
import { createModuleLogger } from '../utils/logger';
import { termLibraryCommands } from '../services/termCommands';
import { formatDateTime } from '../utils/formatters';
import { useAppStore } from '../store/useAppStore';

const { TextArea } = Input;
const log = createModuleLogger('TermLibraryManager');

interface TermLibraryManagerProps {
  visible: boolean;
  onClose: () => void;
}

interface EditingTerm {
  source: string;
  user_translation: string;
}

export function TermLibraryManager({ visible, onClose }: TermLibraryManagerProps) {
  const { activeAIConfig } = useAppData();
  const { termLibrary: library, refresh, mutate } = useTermLibrary({ enabled: visible });
  const language = useAppStore((state) => state.language);
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
  const handleDelete = async (source: string) => {
    try {
      await termLibraryCommands.removeTerm(source);
      message.success('术语已删除');
      await mutate();
    } catch (error) {
      log.logError(error, '删除术语失败');
      message.error('删除术语失败');
    }
  };

  // 开始编辑
  const handleEdit = (term: TermEntry) => {
    setEditingKey(term.source);
    setEditingTerm({
      source: term.source,
      user_translation: term.user_translation,
    });
  };

  // 保存编辑
  const handleSave = async () => {
    if (!editingTerm) return;

    try {
      const original = library?.terms.find((t: TermEntry) => t.source === editingKey);
      if (!original) return;

      await termLibraryCommands.addTerm({
        source: editingTerm.source,
        userTranslation: editingTerm.user_translation,
        aiTranslation: original.ai_translation,
        context: original.context || null,
      });

      message.success('术语已更新');
      setEditingKey('');
      setEditingTerm(null);
      await mutate();
    } catch (error) {
      log.logError(error, '更新术语失败');
      message.error('更新术语失败');
    }
  };

  // 取消编辑
  const handleCancel = () => {
    setEditingKey('');
    setEditingTerm(null);
  };

  const handleGenerateStyleSummary = async () => {
    if (!activeAIConfig) {
      message.error('请先设置并启用 AI 配置');
      return;
    }

    log.info('开始生成风格总结', { termCount: library?.metadata.total_terms || 0 });
    setLoading(true);
    try {
      const summary = await termLibraryCommands.generateStyleSummary();
      const summaryText = typeof summary === 'string' ? summary : String(summary);
      log.info('风格总结生成成功', { summary: summaryText.substring(0, 50) + '...' });
      message.success('风格总结已生成');
      await mutate();
    } catch (error) {
      log.logError(error, '生成风格总结失败');
      message.error(`生成失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: '原文',
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
      title: '用户译文',
      dataIndex: 'user_translation',
      key: 'user_translation',
      width: '25%',
      render: (text: string, record: TermEntry) => {
        const isEditing = editingKey === record.source;
        return isEditing ? (
          <TextArea
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
      title: 'AI译文',
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
      title: '频次',
      dataIndex: 'frequency',
      key: 'frequency',
      width: '8%',
      align: 'center' as const,
      render: (freq: number) => <Tag color={freq > 3 ? 'green' : 'default'}>{freq}</Tag>,
    },
    {
      title: '操作',
      key: 'action',
      width: '12%',
      render: (_: any, record: TermEntry) => {
        const isEditing = editingKey === record.source;
        return isEditing ? (
          <Space size="small">
            <Button size="small" type="primary" onClick={handleSave}>
              保存
            </Button>
            <Button size="small" onClick={handleCancel}>
              取消
            </Button>
          </Space>
        ) : (
          <Space size="small">
            <Button size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)} />
            <Popconfirm
              title="确定删除此术语？"
              onConfirm={() => handleDelete(record.source)}
              okText="确定"
              cancelText="取消"
            >
              <Button size="small" danger icon={<DeleteOutlined />} />
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
          <BookOutlined /> 术语库管理
          {library && (
            <Tag color="blue" style={{ marginLeft: 'var(--space-2)' }}>
              {library.metadata.total_terms} 条术语
            </Tag>
          )}
        </span>
      }
      open={visible}
      onCancel={onClose}
      width={1040}
      centered
      destroyOnClose={true}
      footer={[
        <Button key="refresh" icon={<ReloadOutlined />} onClick={() => refresh()}>
          刷新
        </Button>,
        <Button
          key="generate"
          type="primary"
          icon={<ThunderboltOutlined />}
          onClick={handleGenerateStyleSummary}
          loading={loading}
          disabled={!library || library.metadata.total_terms === 0}
        >
          生成风格总结
        </Button>,
        <Button key="close" onClick={onClose}>
          关闭
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
          <strong style={{ color: cssColors.textPrimary }}>风格提示词自动生成规则：</strong>
          首次添加或每新增5条术语时自动生成，也可随时点击下方按钮手动生成
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
            当前风格总结 (v{library.style_summary.version})
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
            基于 {library.style_summary.based_on_terms} 条术语 · 最后更新:{' '}
            {formatDateTime(library.style_summary.generated_at, language)}
          </div>
        </div>
      )}

      {/* 术语列表 */}
      <Table
        columns={columns}
        dataSource={library?.terms || []}
        rowKey="source"
        loading={loading}
        pagination={{
          pageSize: 10,
          showSizeChanger: true,
          showTotal: (total) => `共 ${total} 条术语`,
        }}
        size="middle"
        scroll={{ x: 960 }}
        locale={{
          emptyText: '暂无术语数据',
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
          <div>术语库为空</div>
          <div style={{ fontSize: 'var(--font-size-sm)', marginTop: 'var(--space-2)' }}>
            在编辑器中修改AI翻译后，系统会自动检测并建议加入术语库
          </div>
        </div>
      )}
    </Modal>
  );
}
