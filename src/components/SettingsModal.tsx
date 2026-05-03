/**
 * 设置窗口
 * 已拆解为多个独立的 Tab 组件
 */

import { Modal, Tabs } from 'antd';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
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
          <ApiOutlined /> {t('settings.tabs.ai')}
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
          <FileTextOutlined /> {t('settings.tabs.systemPrompt')}
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
          <BgColorsOutlined /> {t('settings.tabs.appearance')}
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
          <BellOutlined /> {t('settings.tabs.notification')}
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
          <InfoCircleOutlined /> {t('settings.tabs.logs')}
        </span>
      ),
      children: <LogsTab />,
    },
  ];

  return (
    <Modal
      title={t('settings.title')}
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
