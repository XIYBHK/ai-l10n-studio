import { useState, useEffect, useMemo } from 'react';
import { Modal, Table, Input, Button, message, Space, Popconfirm, Tag } from 'antd';
import {
  DeleteOutlined,
  PlusOutlined,
  SearchOutlined,
  ClearOutlined,
  ExportOutlined,
  ImportOutlined,
} from '@ant-design/icons';
import { save, open } from '@tauri-apps/plugin-dialog';
import { writeTextFile, readTextFile } from '@tauri-apps/plugin-fs';
import { translationMemoryCommands } from '../services/termCommands';
import { createModuleLogger } from '../utils/logger';
import { useTranslationMemory } from '../hooks/useTranslationMemory';
import { useSupportedLanguages } from '../hooks/useLanguage';
import { useStatsStore } from '../store';

const log = createModuleLogger('MemoryManager');

interface MemoryEntry {
  key: string;
  source: string;
  target: string;
  language?: string;
}

const buildMemoryKey = (source: string, language?: string): string => {
  if (language) {
    return `${source}|${language}`;
  }
  return source;
};

interface MemoryManagerProps {
  visible: boolean;
  onClose: () => void;
}

export function MemoryManager({ visible, onClose }: MemoryManagerProps) {
  const [memories, setMemories] = useState<MemoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const { tm, isLoading: loadingTM, mutate } = useTranslationMemory();
  const { languages } = useSupportedLanguages(); // 🔧 从后端动态获取语言列表
  const [searchText, setSearchText] = useState('');
  const [newSource, setNewSource] = useState('');
  const [newTarget, setNewTarget] = useState('');
  const [tableHeight, setTableHeight] = useState(400);

  const languageConfig = useMemo(() => {
    const config: Record<string, string> = {};
    languages.forEach((lang) => {
      config[lang.code] = lang.display_name;
    });
    return config;
  }, [languages]);

  const parseMemoryKey = useMemo(
    () =>
      (key: string): { source: string; language?: string } => {
        const parts = key.split('|');

        if (parts.length >= 2) {
          const lastPart = parts[parts.length - 1];
          if (languageConfig[lastPart]) {
            const source = parts.slice(0, -1).join('|');
            return { source, language: lastPart };
          }
        }

        return { source: key, language: undefined };
      },
    [languageConfig]
  );

  useEffect(() => {
    if (visible) {
      mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  useEffect(() => {
    if (visible) {
      if (tm && (tm as any).memory) {
        const entries: MemoryEntry[] = Object.entries((tm as any).memory).map(
          ([memoryKey, target], index) => {
            const { source, language } = parseMemoryKey(memoryKey);
            return {
              key: `${index}`,
              source,
              target: target as string,
              language,
            };
          }
        );
        setMemories(entries);
        log.info('记忆库加载成功', { count: entries.length });
      } else if (!loadingTM) {
        setMemories([]);
      }
    }
  }, [visible, tm, loadingTM]);

  useEffect(() => {
    let rafId: number | null = null;
    let lastWidth = window.innerWidth;

    const updateTableHeight = () => {
      const windowHeight = window.innerHeight;
      const modalContentHeight = windowHeight - 200;
      const operationAreaHeight = 180;
      const paginationHeight = 60;
      const newTableHeight = Math.max(
        200,
        modalContentHeight - operationAreaHeight - paginationHeight
      );
      setTableHeight(newTableHeight);
      lastWidth = window.innerWidth;
    };

    const handleResize = () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      rafId = requestAnimationFrame(updateTableHeight);
    };

    if (visible) {
      updateTableHeight();
      window.addEventListener('resize', handleResize);
      return () => {
        window.removeEventListener('resize', handleResize);
        if (rafId !== null) {
          cancelAnimationFrame(rafId);
        }
      };
    }
  }, [visible]);

  const handleSave = async () => {
    setLoading(true);
    try {
      const memoryMap: Record<string, string> = {};
      memories.forEach((entry) => {
        const key = buildMemoryKey(entry.source, entry.language);
        memoryMap[key] = entry.target;
      });

      await translationMemoryCommands.save({
        memory: memoryMap,
        stats: {
          total_entries: memories.length,
          hits: 0,
          misses: 0,
        },
        last_updated: new Date().toISOString(),
      });

      message.success('记忆库已保存');
      await mutate();
      onClose();
    } catch (error) {
      log.logError(error, '保存记忆库失败');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (key: string) => {
    setMemories(memories.filter((entry) => entry.key !== key));
  };

  const handleClearAll = async () => {
    try {
      setLoading(true);
      setMemories([]);

      await translationMemoryCommands.save({
        memory: {},
        stats: {
          total_entries: 0,
          hits: 0,
          misses: 0,
        },
        last_updated: new Date().toISOString(),
      });

      const freshTM = await translationMemoryCommands.get();
      log.debug('清空后重新获取记忆库', { hasTM: !!freshTM });

      await mutate(freshTM, false);

      const { cumulativeStats, setCumulativeStats } = useStatsStore.getState();
      setCumulativeStats({
        ...cumulativeStats,
        tm_learned: 0,
      });

      message.success('已清空所有记忆');
    } catch (error) {
      log.logError(error, '清空记忆库失败');
      await mutate();
    } finally {
      setLoading(false);
    }
  };

  const handleLoadBuiltin = async () => {
    try {
      setLoading(true);

      const addedCount = await translationMemoryCommands.mergeBuiltinPhrases();
      log.info('内置词库合并完成', { addedCount });

      const freshTM = await translationMemoryCommands.get();
      log.debug('重新获取记忆库', { hasTM: !!freshTM });

      await mutate(freshTM, false);

      if (freshTM && (freshTM as any).memory) {
        const entries: MemoryEntry[] = Object.entries((freshTM as any).memory).map(
          ([memoryKey, target], index) => {
            const { source, language } = parseMemoryKey(memoryKey);
            return {
              key: `${index}`,
              source,
              target: target as string,
              language,
            };
          }
        );
        setMemories(entries);
        log.info('记忆库界面已更新', { count: entries.length });
      }

      message.success(`已加载内置词库，新增 ${addedCount} 条短语`);
    } catch (error) {
      log.logError(error, '加载内置词库失败');
      message.error(`加载失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      const filePath = await save({
        filters: [
          {
            name: 'JSON',
            extensions: ['json'],
          },
        ],
        defaultPath: 'translation_memory.json',
      });

      if (filePath) {
        const memoryMap: Record<string, string> = {};
        memories.forEach((entry) => {
          const key = buildMemoryKey(entry.source, entry.language);
          memoryMap[key] = entry.target;
        });

        const exportData = {
          memory: memoryMap,
          stats: {
            total_entries: memories.length,
            hits: 0,
            misses: 0,
          },
        };

        await writeTextFile(filePath, JSON.stringify(exportData, null, 2));
        message.success('记忆库已导出');
      }
    } catch (error) {
      log.logError(error, '导出记忆库失败');
    }
  };

  const handleImport = async () => {
    try {
      const filePath = await open({
        filters: [
          {
            name: 'JSON',
            extensions: ['json'],
          },
        ],
        multiple: false,
      });

      if (filePath && typeof filePath === 'string') {
        const content = await readTextFile(filePath);
        const data = JSON.parse(content);

        if (data.memory) {
          const entries: MemoryEntry[] = Object.entries(data.memory).map(
            ([memoryKey, target], index) => {
              const { source, language } = parseMemoryKey(memoryKey);
              return {
                key: `${index}`,
                source,
                target: target as string,
                language,
              };
            }
          );
          setMemories(entries);
          message.success(`已导入 ${entries.length} 条记忆`);
        }
      }
    } catch (error) {
      log.logError(error, '导入记忆库失败');
    }
  };

  const handleAdd = () => {
    if (!newSource || !newTarget) {
      message.warning('请输入原文和译文');
      return;
    }

    const newEntry: MemoryEntry = {
      key: `${Date.now()}`,
      source: newSource,
      target: newTarget,
    };

    setMemories([...memories, newEntry]);
    setNewSource('');
    setNewTarget('');
    message.success('已添加');
  };

  const handleEdit = (key: string, field: 'source' | 'target', value: string) => {
    setMemories(
      memories.map((entry) => (entry.key === key ? { ...entry, [field]: value } : entry))
    );
  };

  const filteredMemories = memories.filter(
    (entry) =>
      entry.source.toLowerCase().includes(searchText.toLowerCase()) ||
      entry.target.toLowerCase().includes(searchText.toLowerCase())
  );

  const columns = [
    {
      title: '原文',
      dataIndex: 'source',
      key: 'source',
      width: '35%',
      render: (text: string, record: MemoryEntry) => (
        <Input
          value={text}
          onChange={(e) => handleEdit(record.key, 'source', e.target.value)}
          size="small"
        />
      ),
    },
    {
      title: '译文',
      dataIndex: 'target',
      key: 'target',
      width: '35%',
      render: (text: string, record: MemoryEntry) => (
        <Input
          value={text}
          onChange={(e) => handleEdit(record.key, 'target', e.target.value)}
          size="small"
        />
      ),
    },
    {
      title: '语言',
      dataIndex: 'language',
      key: 'language',
      width: '15%',
      render: (language?: string) => {
        if (!language) {
          return <Tag color="default">未指定</Tag>;
        }
        const languageName = languageConfig[language];
        if (languageName) {
          return <Tag color="blue">{languageName}</Tag>;
        }
        return <Tag color="blue">{language}</Tag>;
      },
    },
    {
      title: '操作',
      key: 'action',
      width: '15%',
      render: (_: any, record: MemoryEntry) => (
        <Popconfirm
          title="确定删除这条记忆吗？"
          onConfirm={() => handleDelete(record.key)}
          okText="确定"
          cancelText="取消"
        >
          <Button type="text" danger icon={<DeleteOutlined />} size="small">
            删除
          </Button>
        </Popconfirm>
      ),
    },
  ];

  return (
    <Modal
      title="记忆库管理"
      open={visible}
      onCancel={onClose}
      onOk={handleSave}
      width={960}
      centered
      okText="保存"
      cancelText="取消"
      confirmLoading={loading}
      destroyOnClose
      style={{ top: 20 }}
      styles={{
        body: {
          maxHeight: 'calc(100vh - 200px)',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
        },
      }}
    >
      <div style={{ marginBottom: 'var(--space-4)' }}>
        <Space
          style={{ marginBottom: 'var(--space-3)', width: '100%', justifyContent: 'space-between' }}
        >
          <Space>
            <Button icon={<ImportOutlined />} onClick={handleImport}>
              导入
            </Button>
            <Button icon={<ExportOutlined />} onClick={handleExport}>
              导出
            </Button>
            <Button icon={<PlusOutlined />} onClick={handleLoadBuiltin}>
              加载内置词库
            </Button>
            <Popconfirm
              title="确定清空所有记忆吗？"
              description="此操作不可恢复！"
              onConfirm={handleClearAll}
              okText="确定"
              cancelText="取消"
              okButtonProps={{ danger: true }}
            >
              <Button danger icon={<ClearOutlined />}>
                清空
              </Button>
            </Popconfirm>
          </Space>
        </Space>

        <Input
          placeholder="搜索原文或译文…"
          prefix={<SearchOutlined />}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          style={{ marginBottom: 'var(--space-3)' }}
        />

        <Space.Compact style={{ width: '100%' }}>
          <Input
            placeholder="原文"
            value={newSource}
            onChange={(e) => setNewSource(e.target.value)}
            onPressEnter={handleAdd}
          />
          <Input
            placeholder="译文"
            value={newTarget}
            onChange={(e) => setNewTarget(e.target.value)}
            onPressEnter={handleAdd}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            添加
          </Button>
        </Space.Compact>
      </div>

      <Table
        columns={columns}
        dataSource={filteredMemories}
        loading={loading}
        size="middle"
        pagination={{
          pageSize: 10,
          showSizeChanger: true,
          showTotal: (total) => `共 ${total} 条记忆`,
          position: ['bottomCenter'],
        }}
        scroll={{ x: 900, y: tableHeight }}
      />
    </Modal>
  );
}
