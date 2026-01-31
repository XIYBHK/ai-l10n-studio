/**
 * 设置窗口
 * 已拆解为多个独立的 Tab 组件
 */

import { Modal, Tabs } from 'antd';
import {
  ApiOutlined,
  FileTextOutlined,
  BgColorsOutlined,
  BellOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import AIConfigTab from './settings/AIConfigTab';
import SystemPromptTab from './settings/SystemPromptTab';
import AppearanceTab from './settings/AppearanceTab';
import NotificationTab from './settings/NotificationTab';
import LogsTab from './settings/LogsTab';

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
}

export function SettingsModal({ visible, onClose }: SettingsModalProps) {
  const tabItems = [
    {
      key: 'ai-config',
      label: (
        <span
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            fontSize: 'var(--font-size-base)',
          }}
        >
          <ApiOutlined /> AI 配置
        </span>
      ),
      children: <AIConfigTab />,
    },
    {
      key: 'system-prompt',
      label: (
        <span
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            fontSize: 'var(--font-size-base)',
          }}
        >
          <FileTextOutlined /> 系统提示词
        </span>
      ),
      children: <SystemPromptTab />,
    },
    {
      key: 'appearance',
      label: (
        <span
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            fontSize: 'var(--font-size-base)',
          }}
        >
          <BgColorsOutlined /> 外观
        </span>
      ),
      children: <AppearanceTab />,
    },
    {
      key: 'notification',
      label: (
        <span
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            fontSize: 'var(--font-size-base)',
          }}
        >
          <BellOutlined /> 通知
        </span>
      ),
      children: <NotificationTab />,
    },
    {
      key: 'logs',
      label: (
        <span
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            fontSize: 'var(--font-size-base)',
          }}
        >
          <InfoCircleOutlined /> 日志
        </span>
      ),
      children: <LogsTab />,
    },
  ];

  return (
    <Modal
      title="设置"
      open={visible}
      onCancel={onClose}
      footer={null}
      width={800}
      destroyOnClose
      styles={{
        body: {
          maxHeight: '70vh',
          overflowY: 'auto',
        },
      }}
    >
      <Tabs items={tabItems} defaultActiveKey="ai-config" />
    </Modal>
  );
}
