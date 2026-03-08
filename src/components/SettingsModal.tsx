/**
 * 璁剧疆绐楀彛
 * 宸叉媶瑙ｄ负澶氫釜鐙珛鐨?Tab 缁勪欢
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
          <ApiOutlined /> AI 閰嶇疆
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
          <FileTextOutlined /> 绯荤粺鎻愮ず璇?
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
          <BgColorsOutlined /> 澶栬
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
          <BellOutlined /> 閫氱煡
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
          <InfoCircleOutlined /> 鏃ュ織
        </span>
      ),
      children: <LogsTab />,
    },
  ];

  return (
    <Modal
      title="璁剧疆"
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
      <div data-testid="settings-modal-content">
        <Tabs items={tabItems} defaultActiveKey="ai-config" />
      </div>
    </Modal>
  );
}
