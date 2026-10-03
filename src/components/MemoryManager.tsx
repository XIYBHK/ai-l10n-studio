import { useState, useEffect, useMemo, useDeferredValue } from 'react';
import { App, Modal, Table, Input, Button, Space, Popconfirm, Tag, Select } from 'antd';
import { useTranslation } from 'react-i18next';
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
import { buildMemoryKey, parseMemoryKey } from '../utils/translationMemory';
import { useTargetLanguage } from '../store';
import { useStatsStore } from '../store';
import type { TranslationMemory } from '../types/tauri';

const log = createModuleLogger('MemoryManager');

interface MemoryEntry {
  key: string;
  source: string;
  target: string;
  language: string;
  context: string | null;
}

const isTranslationMemory = (value: unknown): value is TranslationMemory => {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('revision' in value) ||
    typeof value.revision !== 'number' ||
    !Number.isSafeInteger(value.revision) ||
    value.revision < 0 ||
    !('memory' in value) ||
    !('last_updated' in value) ||
    typeof value.last_updated !== 'string' ||
    !Number.isFinite(Date.parse(value.last_updated)) ||
    !('stats' in value) ||
    typeof value.stats !== 'object' ||
    value.stats === null
  ) {
    return false;
  }
  const stats = value.stats;
  if (
    !('total_entries' in stats) ||
    !('hits' in stats) ||
    !('misses' in stats) ||
    ![stats.total_entries, stats.hits, stats.misses].every(
      (number) => typeof number === 'number' && Number.isSafeInteger(number) && number >= 0
    )
  )
    return false;
  const memory = value.memory;
  return (
    typeof memory === 'object' &&
    memory !== null &&
    !Array.isArray(memory) &&
    Object.entries(memory).every(([key, target]) => {
      if (typeof target !== 'string') return false;
      try {
        parseMemoryKey(key);
        return true;
      } catch {
        return false;
      }
    })
  );
};

interface MemoryManagerProps {
  visible: boolean;
  onClose: () => void;
}

export function MemoryManager({ visible, onClose }: MemoryManagerProps) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [memories, setMemories] = useState<MemoryEntry[]>([]);
  const [baseMemory, setBaseMemory] = useState<TranslationMemory | null>(null);
  const [loading, setLoading] = useState(false);
  const { tm, isLoading: loadingTM, mutate } = useTranslationMemory();
  const { languages } = useSupportedLanguages(); // 从后端动态获取语言列表
  const [searchText, setSearchText] = useState('');
  const targetLanguage = useTargetLanguage();
  const [newLanguage, setNewLanguage] = useState(targetLanguage || 'zh-Hans');
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

  const entriesFromMemory = (memory: Pick<TranslationMemory, 'memory'>): MemoryEntry[] =>
    Object.entries(memory.memory).map(([memoryKey, target], index) => {
      const { source, language, context } = parseMemoryKey(memoryKey);
      return {
        key: `${index}`,
        source,
        target,
        language,
        context,
      };
    });

  useEffect(() => {
    if (visible) {
      mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  useEffect(() => {
    if (!visible) {
      setBaseMemory(null);
    } else if (!baseMemory) {
      if (tm) {
        setBaseMemory(tm);
        const entries = entriesFromMemory(tm);
        setMemories(entries);
        log.info('记忆库加载成功', { count: entries.length });
      } else if (!loadingTM) {
        setMemories([]);
      }
    }
  }, [visible, tm, loadingTM, baseMemory]);

  useEffect(() => {
    let rafId: number | null = null;

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
        if (!entry.source.trim() || !entry.target.trim() || !entry.language.trim()) {
          throw new Error(t('messages.requireSourceAndTarget'));
        }
        const key = buildMemoryKey(entry.source, entry.context, entry.language);
        if (Object.prototype.hasOwnProperty.call(memoryMap, key))
          throw new Error(t('memoryManager.duplicate', { source: entry.source }));
        memoryMap[key] = entry.target;
      });

      if (!baseMemory) return;
      await translationMemoryCommands.save({
        revision: baseMemory.revision,
        memory: memoryMap,
        stats: {
          ...baseMemory.stats,
          total_entries: memories.length,
        },
        last_updated: new Date().toISOString(),
      });

      message.success(t('messages.memorySaved'));
      await mutate();
      onClose();
    } catch (error) {
      log.logError(error, '保存记忆库失败');
      message.error(
        t('errors.saveFailed', {
          error: error instanceof Error ? error.message : t('errors.unknown'),
        })
      );
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
      if (!baseMemory) return;
      const cleared = await translationMemoryCommands.save({
        revision: baseMemory.revision,
        memory: {},
        stats: {
          total_entries: 0,
          hits: 0,
          misses: 0,
        },
        last_updated: new Date().toISOString(),
      });

      setMemories([]);
      setBaseMemory(cleared);
      const freshTM = cleared;
      log.debug('清空后重新获取记忆库', { hasTM: !!freshTM });

      await mutate(freshTM, false);

      // getState() 为非响应式调用：此处只需读取当前值以执行一次性重置，不需要订阅变化
      const { cumulativeStats, setCumulativeStats } = useStatsStore.getState();
      setCumulativeStats({
        ...cumulativeStats,
        tm_learned: 0,
      });

      message.success(t('messages.memoryCleared'));
    } catch (error) {
      log.logError(error, '清空记忆库失败');
      message.error(t('errors.saveFailed', { error: String(error) }));
    } finally {
      setLoading(false);
    }
  };

  const handleLoadBuiltin = async () => {
    try {
      setLoading(true);

      const builtin = await translationMemoryCommands.getBuiltinPhrases();
      const existing = new Set(
        memories.map((entry) => buildMemoryKey(entry.source, entry.context, entry.language))
      );
      const additions = entriesFromMemory(builtin).filter(
        (entry) => !existing.has(buildMemoryKey(entry.source, entry.context, entry.language))
      );
      const addedCount = additions.length;
      setMemories([
        ...memories,
        ...additions.map((entry, index) => ({ ...entry, key: `builtin:${Date.now()}:${index}` })),
      ]);

      message.success(t('messages.builtinLoaded', { count: addedCount }));
    } catch (error) {
      log.logError(error, '加载内置词库失败');
      message.error(
        t('errors.loadFailed', {
          error: error instanceof Error ? error.message : t('errors.unknown'),
        })
      );
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
          const key = buildMemoryKey(entry.source, entry.context, entry.language);
          memoryMap[key] = entry.target;
        });

        const exportData = {
          revision: 0,
          memory: memoryMap,
          last_updated: new Date().toISOString(),
          stats: {
            total_entries: memories.length,
            hits: 0,
            misses: 0,
          },
        };

        await writeTextFile(filePath, JSON.stringify(exportData, null, 2));
        message.success(t('messages.memoryExported'));
      }
    } catch (error) {
      log.logError(error, '导出记忆库失败');
      message.error(
        t('errors.exportFailed', {
          error: error instanceof Error ? error.message : t('errors.unknown'),
        })
      );
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
        const data: unknown = JSON.parse(content);

        if (isTranslationMemory(data)) {
          const entries = entriesFromMemory(data);
          setMemories(entries);
          message.success(t('messages.memoryImported', { count: entries.length }));
        } else {
          message.error(t('memoryManager.invalidImport'));
        }
      }
    } catch (error) {
      log.logError(error, '导入记忆库失败');
      message.error(
        t('errors.importFailed', {
          error: error instanceof Error ? error.message : t('errors.unknown'),
        })
      );
    }
  };

  const handleAdd = () => {
    if (!newSource.trim() || !newTarget.trim()) {
      message.warning(t('messages.requireSourceAndTarget'));
      return;
    }

    const newEntry: MemoryEntry = {
      key: `${Date.now()}`,
      source: newSource,
      target: newTarget,
      language: newLanguage,
      context: null,
    };

    if (
      memories.some(
        (entry) =>
          buildMemoryKey(entry.source, entry.context, entry.language) ===
          buildMemoryKey(newSource, null, newLanguage)
      )
    ) {
      message.warning(t('memoryManager.duplicate', { source: newSource }));
      return;
    }

    setMemories([...memories, newEntry]);
    setNewSource('');
    setNewTarget('');
    message.success(t('messages.entryAdded'));
  };

  const handleEdit = (key: string, field: 'source' | 'target', value: string) => {
    setMemories(
      memories.map((entry) => (entry.key === key ? { ...entry, [field]: value } : entry))
    );
  };

  const deferredSearchText = useDeferredValue(searchText);
  const filteredMemories = useMemo(() => {
    const lower = deferredSearchText.toLowerCase();
    if (!lower) return memories;
    return memories.filter(
      (entry) =>
        entry.source.toLowerCase().includes(lower) || entry.target.toLowerCase().includes(lower)
    );
  }, [memories, deferredSearchText]);

  const columns = [
    {
      title: t('memoryManager.original'),
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
      title: t('memoryManager.translation'),
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
      title: t('memoryManager.context'),
      dataIndex: 'context',
      key: 'context',
      ellipsis: true,
    },
    {
      title: t('memoryManager.language'),
      dataIndex: 'language',
      key: 'language',
      width: '15%',
      render: (language?: string) => {
        if (!language) {
          return null;
        }
        const languageName = languageConfig[language];
        if (languageName) {
          return <Tag color="blue">{languageName}</Tag>;
        }
        return <Tag color="blue">{language}</Tag>;
      },
    },
    {
      title: t('memoryManager.actions'),
      key: 'action',
      width: '15%',
      render: (_: unknown, record: MemoryEntry) => (
        <Popconfirm
          title={t('memoryManager.deleteConfirm')}
          onConfirm={() => handleDelete(record.key)}
          okText={t('common.confirm')}
          cancelText={t('common.cancel')}
        >
          <Button type="text" danger icon={<DeleteOutlined />} size="small">
            {t('common.delete')}
          </Button>
        </Popconfirm>
      ),
    },
  ];

  return (
    <Modal
      title={t('memoryManager.title')}
      open={visible}
      onCancel={onClose}
      onOk={handleSave}
      width={960}
      centered
      okText={t('common.save')}
      cancelText={t('common.cancel')}
      confirmLoading={loading}
      destroyOnHidden
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
              {t('memoryManager.import')}
            </Button>
            <Button icon={<ExportOutlined />} onClick={handleExport}>
              {t('memoryManager.export')}
            </Button>
            <Button icon={<PlusOutlined />} onClick={handleLoadBuiltin}>
              {t('memoryManager.builtin')}
            </Button>
            <Popconfirm
              title={t('memoryManager.clearConfirm')}
              description={t('memoryManager.clearDescription')}
              onConfirm={handleClearAll}
              okText={t('common.confirm')}
              cancelText={t('common.cancel')}
              okButtonProps={{ danger: true }}
            >
              <Button danger icon={<ClearOutlined />}>
                {t('memoryManager.clear')}
              </Button>
            </Popconfirm>
          </Space>
        </Space>

        <Input
          placeholder={t('memoryManager.search')}
          prefix={<SearchOutlined />}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          style={{ marginBottom: 'var(--space-3)' }}
        />

        <Select
          aria-label={t('memoryManager.language')}
          value={newLanguage}
          onChange={setNewLanguage}
          options={languages.map((language) => ({
            value: language.code,
            label: language.display_name,
          }))}
          style={{ minWidth: 180, marginBottom: 'var(--space-3)' }}
        />
        <Space.Compact style={{ width: '100%' }}>
          <Input
            placeholder={t('memoryManager.original')}
            value={newSource}
            onChange={(e) => setNewSource(e.target.value)}
            onPressEnter={handleAdd}
          />
          <Input
            placeholder={t('memoryManager.translation')}
            value={newTarget}
            onChange={(e) => setNewTarget(e.target.value)}
            onPressEnter={handleAdd}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            {t('memoryManager.add')}
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
          showTotal: (total) => t('memoryManager.total', { count: total }),
          placement: ['bottomCenter'],
        }}
        scroll={{ x: 900, y: tableHeight }}
      />
    </Modal>
  );
}
