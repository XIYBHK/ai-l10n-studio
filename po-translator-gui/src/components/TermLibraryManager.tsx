import React, { useState, useEffect } from 'react';
import { Modal, Table, Button, Space, message, Popconfirm, Tag, Input, Tooltip } from 'antd';
import { 
  DeleteOutlined, 
  EditOutlined, 
  ReloadOutlined, 
  BookOutlined,
  ThunderboltOutlined 
} from '@ant-design/icons';
import { invoke } from '@tauri-apps/api/core';
import { TermLibrary, TermEntry } from '../types/termLibrary';
import { useTheme } from '../hooks/useTheme';
import { createModuleLogger } from '../utils/logger';

const { TextArea } = Input;
const log = createModuleLogger('TermLibraryManager');

interface TermLibraryManagerProps {
  visible: boolean;
  onClose: () => void;
  apiKey: string;
}

interface EditingTerm {
  source: string;
  user_translation: string;
}

export const TermLibraryManager: React.FC<TermLibraryManagerProps> = ({
  visible,
  onClose,
  apiKey,
}) => {
  const [library, setLibrary] = useState<TermLibrary | null>(null);
  const [loading, setLoading] = useState(false);
  const [editingKey, setEditingKey] = useState<string>('');
  const [editingTerm, setEditingTerm] = useState<EditingTerm | null>(null);
  const { colors } = useTheme();

  // 加载术语库
  const loadLibrary = async () => {
    setLoading(true);
    try {
      const { termLibraryApi } = await import('../services/api');
      const lib = await termLibraryApi.get() as TermLibrary;
      setLibrary(lib);
      log.debug('术语库加载成功', { termCount: lib.terms.length });
    } catch (error) {
      log.logError(error, '加载术语库失败');
      message.error('加载术语库失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible) {
      loadLibrary();
    }
  }, [visible]);

  // 删除术语
  const handleDelete = async (source: string) => {
    try {
      await invoke('remove_term_from_library', { source });
      message.success('术语已删除');
      loadLibrary();
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
      const original = library?.terms.find(t => t.source === editingKey);
      if (!original) return;

      await invoke('add_term_to_library', {
        source: editingTerm.source,
        userTranslation: editingTerm.user_translation,
        aiTranslation: original.ai_translation,
        context: original.context || null,
      });

      message.success('术语已更新');
      setEditingKey('');
      setEditingTerm(null);
      loadLibrary();
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

  // 生成风格总结
  const handleGenerateStyleSummary = async () => {
    if (!apiKey) {
      message.error('请先设置API密钥');
      return;
    }

    log.info('开始生成风格总结', { termCount: library?.metadata.total_terms || 0 });
    setLoading(true);
    try {
      const summary = await invoke<string>('generate_style_summary', { apiKey });
      log.info('风格总结生成成功', { summary: summary.substring(0, 50) + '...' });
      message.success('风格总结已生成');
      loadLibrary();
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
          <span style={{ fontSize: '13px' }}>{text}</span>
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
            style={{ fontSize: '13px' }}
          />
        ) : (
          <span style={{ fontSize: '13px', color: colors.statusTranslated }}>{text}</span>
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
          <span style={{ fontSize: '13px', color: colors.textTertiary }}>{text}</span>
        </Tooltip>
      ),
    },
    {
      title: '频次',
      dataIndex: 'frequency',
      key: 'frequency',
      width: '8%',
      align: 'center' as const,
      render: (freq: number) => (
        <Tag color={freq > 3 ? 'green' : 'default'}>{freq}</Tag>
      ),
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
            <Button
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
            />
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
            <Tag color="blue" style={{ marginLeft: 8 }}>
              {library.metadata.total_terms} 条术语
            </Tag>
          )}
        </span>
      }
      open={visible}
      onCancel={onClose}
      width={1000}
      destroyOnHidden={true}
      mask={false}
      footer={[
        <Button key="refresh" icon={<ReloadOutlined />} onClick={loadLibrary}>
          刷新
        </Button>,
        <Button
          key="generate"
          type="primary"
          icon={<ThunderboltOutlined />}
          onClick={handleGenerateStyleSummary}
          loading={loading}
        >
          生成风格总结
        </Button>,
        <Button key="close" onClick={onClose}>
          关闭
        </Button>,
      ]}
    >
      {/* 风格总结展示 */}
      {library?.style_summary && (
        <div style={{
          marginBottom: 16,
          padding: 12,
          background: colors.bgTertiary,
          borderRadius: 4,
        }}>
          <div style={{ 
            fontSize: '12px', 
            fontWeight: 600, 
            marginBottom: 8,
            color: colors.textPrimary 
          }}>
            📝 当前风格总结 (v{library.style_summary.version})
          </div>
          <div style={{ 
            fontSize: '13px', 
            lineHeight: '1.6',
            color: colors.textSecondary 
          }}>
            {library.style_summary.prompt}
          </div>
          <div style={{ 
            fontSize: '11px', 
            marginTop: 8,
            color: colors.textTertiary 
          }}>
            基于 {library.style_summary.based_on_terms} 条术语 · 最后更新: {new Date(library.style_summary.generated_at).toLocaleString('zh-CN')}
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
        size="small"
        locale={{
          emptyText: '暂无术语数据',
        }}
      />

      {/* 提示信息 */}
      {library && library.terms.length === 0 && (
        <div style={{
          textAlign: 'center',
          padding: '40px 20px',
          color: colors.textTertiary,
        }}>
          <BookOutlined style={{ fontSize: 48, marginBottom: 16 }} />
          <div>术语库为空</div>
          <div style={{ fontSize: '12px', marginTop: 8 }}>
            在编辑器中修改AI翻译后，系统会自动检测并建议加入术语库
          </div>
        </div>
      )}
    </Modal>
  );
};

