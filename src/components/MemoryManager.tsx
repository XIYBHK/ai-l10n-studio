import React, { useState, useEffect, useMemo } from 'react';
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
import { translationMemoryCommands } from '../services/commands';
import { createModuleLogger } from '../utils/logger';
import { useTranslationMemory } from '../hooks/useTranslationMemory';
import { useSupportedLanguages } from '../hooks/useLanguage';
import { useStatsStore } from '../store';

const log = createModuleLogger('MemoryManager');

interface MemoryEntry {
  key: string;
  source: string;
  target: string;
  language?: string; // 语言代码（如 "ja", "zh-Hans"）
}

// 组合记忆库键值（如 { source: "Debug", language: "ja" } → "Debug|ja"）
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

export const MemoryManager: React.FC<MemoryManagerProps> = ({ visible, onClose }) => {
  const [memories, setMemories] = useState<MemoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const { tm, isLoading: loadingTM, mutate } = useTranslationMemory();
  const { languages } = useSupportedLanguages(); // 🔧 从后端动态获取语言列表
  const [searchText, setSearchText] = useState('');
  const [newSource, setNewSource] = useState('');
  const [newTarget, setNewTarget] = useState('');
  const [tableHeight, setTableHeight] = useState(400);

  // 🔧 动态生成语言配置映射（单一数据源）
  const languageConfig = useMemo(() => {
    const config: Record<string, string> = {};
    languages.forEach((lang) => {
      config[lang.code] = lang.display_name;
    });
    return config;
  }, [languages]);

  // 🔧 解析记忆库键值（使用动态语言配置）
  // 支持格式：
  // - "Debug|zh-Hans" → { source: "Debug", language: "zh-Hans" }
  // - "XTools|Random|zh-Hans" → { source: "XTools|Random", language: "zh-Hans" }
  // - "Debug" → { source: "Debug", language: undefined }
  const parseMemoryKey = useMemo(
    () =>
      (key: string): { source: string; language?: string } => {
        const parts = key.split('|');

        // 检查最后一个部分是否是已知的语言代码
        if (parts.length >= 2) {
          const lastPart = parts[parts.length - 1];
          if (languageConfig[lastPart]) {
            // 最后一部分是语言代码，前面的所有部分是原文
            const source = parts.slice(0, -1).join('|');
            return { source, language: lastPart };
          }
        }

        // 没有语言代码，或者无法识别
        return { source: key, language: undefined };
      },
    [languageConfig]
  );

  // 🔧 关键修复：每次打开时强制刷新一次，确保显示最新数据
  // 原因：如果用户在翻译后才打开记忆库管理器，会错过 translation:after 事件
  useEffect(() => {
    if (visible) {
      mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]); // 只依赖 visible，避免无限循环

  // 当 TM 数据更新时，重新设置 memories
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

  // 计算Table高度，根据窗口高度自适应
  useEffect(() => {
    const updateTableHeight = () => {
      // Modal高度 = 窗口高度 - 200px (top + 底部空间)
      // Table高度 = Modal内容高度 - 操作区高度(约180px) - 分页组件高度(约60px) - padding
      const windowHeight = window.innerHeight;
      const modalContentHeight = windowHeight - 200;
      const operationAreaHeight = 180; // 搜索框、添加框等的高度
      const paginationHeight = 60; // 分页组件高度
      const newTableHeight = Math.max(
        200,
        modalContentHeight - operationAreaHeight - paginationHeight
      );
      setTableHeight(newTableHeight);
    };

    if (visible) {
      updateTableHeight();
      window.addEventListener('resize', updateTableHeight);
      return () => window.removeEventListener('resize', updateTableHeight);
    }
  }, [visible]);

  // 读取交由 SWR；此处保留写操作

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
      log.info('记忆库保存成功', { count: memories.length });
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
      // 清空前端状态
      setMemories([]);

      // 保存空的记忆库到后端
      await translationMemoryCommands.save({
        memory: {},
        stats: {
          total_entries: 0,
          hits: 0,
          misses: 0,
        },
        last_updated: new Date().toISOString(),
      });

      // 重新从后端获取最新数据（应该是空的）
      const freshTM = await translationMemoryCommands.get();
      log.debug('清空后重新获取记忆库', { hasTM: !!freshTM });

      // 更新 SWR 缓存（关键修复：之前缺少这一步）
      await mutate(freshTM, false);

      // 重置累计统计中的 tm_learned
      const { cumulativeStats, setCumulativeStats } = useStatsStore.getState();
      setCumulativeStats({
        ...cumulativeStats,
        tm_learned: 0,
      });

      message.success('已清空所有记忆');
      log.info('记忆库已清空，tm_learned 统计已重置');
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

      // 调用后端接口合并并保存内置词库
      const addedCount = await translationMemoryCommands.mergeBuiltinPhrases();
      log.info('内置词库合并完成', { addedCount });

      // 重新从后端获取最新数据
      const freshTM = await translationMemoryCommands.get();
      log.debug('重新获取记忆库', { hasTM: !!freshTM });

      // 更新 SWR 缓存
      await mutate(freshTM, false);

      // 立即更新前端显示
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
        log.info('记忆库导出成功', { path: filePath, count: memories.length });
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
          log.info('记忆库导入成功', { path: filePath, count: entries.length });
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
        // 未知语言代码，显示原始值
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
      width={900}
      okText="保存"
      cancelText="取消"
      confirmLoading={loading}
      destroyOnClose={true}
      mask={false}
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
      <div style={{ marginBottom: 16 }}>
        <Space style={{ marginBottom: 12, width: '100%', justifyContent: 'space-between' }}>
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
          placeholder="搜索原文或译文..."
          prefix={<SearchOutlined />}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          style={{ marginBottom: 12 }}
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
        size="small"
        pagination={{
          pageSize: 10,
          showSizeChanger: true,
          showTotal: (total) => `共 ${total} 条记忆`,
          position: ['bottomCenter'],
        }}
        scroll={{ y: tableHeight }}
      />
    </Modal>
  );
};
