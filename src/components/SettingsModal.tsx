/**
 * 设置窗口
 * 已拆解为多个独立的 Tab 组件
 */

import React from 'react';
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

export const SettingsModal: React.FC<SettingsModalProps> = ({ visible, onClose }) => {
  const tabItems = [
    {
      key: 'ai-config',
      label: (
        <span
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '13px',
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
            gap: '6px',
            fontSize: '13px',
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
            gap: '6px',
            fontSize: '13px',
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
            gap: '6px',
            fontSize: '13px',
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
            gap: '6px',
            fontSize: '13px',
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
};
