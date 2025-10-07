import React, { useState, useEffect } from 'react';
import { Modal, Table, Input, Button, message, Space, Popconfirm } from 'antd';
import { DeleteOutlined, PlusOutlined, SearchOutlined, ClearOutlined, ExportOutlined, ImportOutlined } from '@ant-design/icons';
import { save, open } from '@tauri-apps/api/dialog';
import { writeTextFile, readTextFile } from '@tauri-apps/api/fs';
import { translationMemoryApi } from '../services/api';
import { createModuleLogger } from '../utils/logger';

const log = createModuleLogger('MemoryManager');

interface MemoryEntry {
  key: string;
  source: string;
  target: string;
}

interface MemoryManagerProps {
  visible: boolean;
  onClose: () => void;
}

export const MemoryManager: React.FC<MemoryManagerProps> = ({ visible, onClose }) => {
  const [memories, setMemories] = useState<MemoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [newSource, setNewSource] = useState('');
  const [newTarget, setNewTarget] = useState('');
  const [tableHeight, setTableHeight] = useState(400);

  useEffect(() => {
    if (visible) {
      loadMemories();
    }
  }, [visible]);

  // 计算Table高度，根据窗口高度自适应
  useEffect(() => {
    const updateTableHeight = () => {
      // Modal高度 = 窗口高度 - 200px (top + 底部空间)
      // Table高度 = Modal内容高度 - 操作区高度(约180px) - 分页组件高度(约60px) - padding
      const windowHeight = window.innerHeight;
      const modalContentHeight = windowHeight - 200;
      const operationAreaHeight = 180; // 搜索框、添加框等的高度
      const paginationHeight = 60; // 分页组件高度
      const newTableHeight = Math.max(200, modalContentHeight - operationAreaHeight - paginationHeight);
      setTableHeight(newTableHeight);
    };

    if (visible) {
      updateTableHeight();
      window.addEventListener('resize', updateTableHeight);
      return () => window.removeEventListener('resize', updateTableHeight);
    }
  }, [visible]);

  const loadMemories = async () => {
    setLoading(true);
    try {
      const tm = await translationMemoryApi.get() as any;
      if (tm && tm.memory) {
        const entries: MemoryEntry[] = Object.entries(tm.memory)
          .map(([source, target], index) => ({
            key: `${index}`,
            source,
            target: target as string,
          }));
        setMemories(entries);
        log.info('记忆库加载成功', { count: entries.length });
      } else {
        // 空记忆库也是正常情况
        setMemories([]);
        log.info('记忆库为空');
      }
    } catch (error) {
      log.logError(error, '加载记忆库失败');
      // 加载失败时至少显示空列表
      setMemories([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const memoryMap: Record<string, string> = {};
      memories.forEach(entry => {
        memoryMap[entry.source] = entry.target;
      });

      await translationMemoryApi.save({
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
      onClose();
    } catch (error) {
      log.logError(error, '保存记忆库失败');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (key: string) => {
    setMemories(memories.filter(entry => entry.key !== key));
  };

  const handleClearAll = async () => {
    try {
      setLoading(true);
      // 清空前端状态
      setMemories([]);
      
      // 保存空的记忆库到后端
      await translationMemoryApi.save({
        memory: {}, // 空的memory字段
        stats: {
          total_entries: 0,
          hits: 0,
          misses: 0,
        },
        last_updated: new Date().toISOString(),
      });
      
      message.success('已清空所有记忆');
      log.info('记忆库已清空');
    } catch (error) {
      log.logError(error, '清空记忆库失败');
      // 失败时重新加载
      loadMemories();
    } finally {
      setLoading(false);
    }
  };

  const handleLoadBuiltin = async () => {
    try {
      setLoading(true);
      
      // 调用后端接口获取内置词库
      const response = await translationMemoryApi.getBuiltinPhrases() as any;
      
      if (response && response.memory) {
        // 合并当前记忆和内置短语
        const currentMemory: Record<string, string> = {};
        memories.forEach(entry => {
          currentMemory[entry.source] = entry.target;
        });
        
        const mergedMemory = { ...response.memory, ...currentMemory };
        
        const entries: MemoryEntry[] = Object.entries(mergedMemory)
          .map(([source, target], index) => ({
            key: `${index}`,
            source,
            target: target as string,
          }));
        
        setMemories(entries);
        message.success(`已加载 ${Object.keys(response.memory).length} 条内置短语`);
        log.info('内置词库加载成功', { count: Object.keys(response.memory).length });
      }
    } catch (error) {
      log.logError(error, '加载内置词库失败');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      const filePath = await save({
        filters: [{
          name: 'JSON',
          extensions: ['json']
        }],
        defaultPath: 'translation_memory.json'
      });

      if (filePath) {
        const memoryMap: Record<string, string> = {};
        memories.forEach(entry => {
          memoryMap[entry.source] = entry.target;
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
        filters: [{
          name: 'JSON',
          extensions: ['json']
        }],
        multiple: false
      });

      if (filePath && typeof filePath === 'string') {
        const content = await readTextFile(filePath);
        const data = JSON.parse(content);
        
        if (data.memory) {
          const entries: MemoryEntry[] = Object.entries(data.memory).map(([source, target], index) => ({
            key: `${index}`,
            source,
            target: target as string,
          }));
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
      memories.map(entry =>
        entry.key === key ? { ...entry, [field]: value } : entry
      )
    );
  };

  const filteredMemories = memories.filter(
    entry =>
      entry.source.toLowerCase().includes(searchText.toLowerCase()) ||
      entry.target.toLowerCase().includes(searchText.toLowerCase())
  );

  const columns = [
    {
      title: '原文',
      dataIndex: 'source',
      key: 'source',
      width: '40%',
      render: (text: string, record: MemoryEntry) => (
        <Input
          value={text}
          onChange={e => handleEdit(record.key, 'source', e.target.value)}
          size="small"
        />
      ),
    },
    {
      title: '译文',
      dataIndex: 'target',
      key: 'target',
      width: '40%',
      render: (text: string, record: MemoryEntry) => (
        <Input
          value={text}
          onChange={e => handleEdit(record.key, 'target', e.target.value)}
          size="small"
        />
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: '20%',
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
      bodyStyle={{ 
        maxHeight: 'calc(100vh - 200px)', 
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column'
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
          onChange={e => setSearchText(e.target.value)}
          style={{ marginBottom: 12 }}
        />
        
        <Space.Compact style={{ width: '100%' }}>
          <Input
            placeholder="原文"
            value={newSource}
            onChange={e => setNewSource(e.target.value)}
            onPressEnter={handleAdd}
          />
          <Input
            placeholder="译文"
            value={newTarget}
            onChange={e => setNewTarget(e.target.value)}
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
          position: ['bottomCenter']
        }}
        scroll={{ y: tableHeight }}
      />
    </Modal>
  );
};

