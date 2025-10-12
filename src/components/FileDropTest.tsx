import React, { useEffect, useState } from 'react';
import { Card, Typography, Tag, Space } from 'antd';
import { listen } from '@tauri-apps/api/event';
import { createModuleLogger } from '../utils/logger';

const { Title, Text, Paragraph } = Typography;
const log = createModuleLogger('FileDropTest');

interface DropEvent {
  time: string;
  type: string;
  payload: any;
}

export const FileDropTest: React.FC = () => {
  const [events, setEvents] = useState<DropEvent[]>([]);
  const [listenerStatus, setListenerStatus] = useState<'initializing' | 'ready' | 'error'>(
    'initializing'
  );

  useEffect(() => {
    let cleanup: (() => void) | undefined;

    const setupListeners = async () => {
      try {
        log.info('设置文件拖放监听器');

        // 监听 tauri://file-drop
        const unlistenFileDrop = await listen<string[]>('tauri://file-drop', (event) => {
          log.debug('file-drop事件', event);
          setEvents((prev) => [
            ...prev,
            {
              time: new Date().toLocaleTimeString(),
              type: 'tauri://file-drop',
              payload: event.payload,
            },
          ]);
        });

        // 监听 tauri://file-drop-hover
        const unlistenHover = await listen<string[]>('tauri://file-drop-hover', (event) => {
          log.debug('file-drop-hover事件', event);
          setEvents((prev) => [
            ...prev,
            {
              time: new Date().toLocaleTimeString(),
              type: 'tauri://file-drop-hover',
              payload: event.payload,
            },
          ]);
        });

        // 监听 tauri://file-drop-cancelled
        const unlistenCancel = await listen('tauri://file-drop-cancelled', (event) => {
          log.debug('file-drop-cancelled事件', event);
          setEvents((prev) => [
            ...prev,
            {
              time: new Date().toLocaleTimeString(),
              type: 'tauri://file-drop-cancelled',
              payload: event.payload,
            },
          ]);
        });

        log.info('所有文件拖放监听器注册成功');
        setListenerStatus('ready');

        // 保存清理函数
        cleanup = () => {
          log.debug('清理文件拖放监听器');
          unlistenFileDrop();
          unlistenHover();
          unlistenCancel();
        };
      } catch (error) {
        log.logError(error, '设置监听器失败');
        setListenerStatus('error');
      }
    };

    setupListeners();

    // 返回清理函数
    return () => {
      if (cleanup) {
        cleanup();
      }
    };
  }, []);

  // HTML5 拖拽事件监听（备用测试）
  useEffect(() => {
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      log.debug('HTML5 dragover事件');
    };

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      log.debug('HTML5 drop事件', { files: e.dataTransfer?.files });

      if (e.dataTransfer?.files) {
        const files = Array.from(e.dataTransfer.files).map((f) => f.name);
        setEvents((prev) => [
          ...prev,
          {
            time: new Date().toLocaleTimeString(),
            type: 'HTML5 drop',
            payload: files,
          },
        ]);
      }
    };

    document.addEventListener('dragover', handleDragOver);
    document.addEventListener('drop', handleDrop);

    return () => {
      document.removeEventListener('dragover', handleDragOver);
      document.removeEventListener('drop', handleDrop);
    };
  }, []);

  return (
    <Card title="文件拖放测试面板" style={{ margin: '20px', maxWidth: '800px' }}>
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        <div>
          <Title level={5}>监听器状态</Title>
          <Tag
            color={
              listenerStatus === 'ready'
                ? 'success'
                : listenerStatus === 'error'
                  ? 'error'
                  : 'processing'
            }
          >
            {listenerStatus === 'ready'
              ? '✅ 已就绪'
              : listenerStatus === 'error'
                ? '❌ 错误'
                : '⏳ 初始化中...'}
          </Tag>
        </div>

        <div>
          <Title level={5}>使用说明</Title>
          <Paragraph>
            1. 尝试将一个 .po 文件拖放到浏览器窗口的任意位置
            <br />
            2. 观察下方的事件日志
            <br />
            3. 打开浏览器开发者工具（F12）查看控制台日志
          </Paragraph>
        </div>

        <div>
          <Title level={5}>拖放区域（尝试将文件拖到这里）</Title>
          <div
            style={{
              border: '2px dashed #1890ff',
              borderRadius: '8px',
              padding: '60px',
              textAlign: 'center',
              background: '#f0f5ff',
              minHeight: '150px',
            }}
          >
            <Text style={{ fontSize: '18px' }}>📁 将 .po 文件拖放到这里</Text>
          </div>
        </div>

        <div>
          <Title level={5}>事件日志 ({events.length} 个事件)</Title>
          <div
            style={{
              maxHeight: '300px',
              overflow: 'auto',
              border: '1px solid #d9d9d9',
              borderRadius: '4px',
              padding: '10px',
              background: '#fafafa',
            }}
          >
            {events.length === 0 ? (
              <Text type="secondary">暂无事件，请尝试拖放文件...</Text>
            ) : (
              events.map((event, index) => (
                <div
                  key={index}
                  style={{
                    marginBottom: '10px',
                    paddingBottom: '10px',
                    borderBottom: '1px solid #e8e8e8',
                  }}
                >
                  <Space>
                    <Tag color="blue">{event.time}</Tag>
                    <Tag color={event.type.includes('HTML5') ? 'orange' : 'green'}>
                      {event.type}
                    </Tag>
                  </Space>
                  <div style={{ marginTop: '5px', marginLeft: '10px' }}>
                    <Text code>{JSON.stringify(event.payload, null, 2)}</Text>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div>
          <Title level={5}>调试信息</Title>
          <Paragraph>
            <Text code>navigator.userAgent:</Text>
            <br />
            <Text type="secondary" style={{ fontSize: '12px' }}>
              {navigator.userAgent}
            </Text>
          </Paragraph>
        </div>
      </Space>
    </Card>
  );
};
