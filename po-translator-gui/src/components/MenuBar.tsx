import React from 'react';
import { Menu, Button, Input, Space, Dropdown } from 'antd';
import { 
  FileOutlined, 
  TranslationOutlined, 
  SettingOutlined,
  PlayCircleOutlined,
  SaveOutlined,
  FolderOpenOutlined,
  DownloadOutlined,
  UploadOutlined
} from '@ant-design/icons';
import { useAppStore } from '../store/useAppStore';

interface MenuBarProps {
  onOpenFile: () => void;
  onSaveFile: () => void;
  onTranslateAll: () => void;
  onSettings: () => void;
  apiKey: string;
  onApiKeyChange: (key: string) => void;
  isTranslating: boolean;
  hasEntries: boolean;
}

export const MenuBar: React.FC<MenuBarProps> = ({
  onOpenFile,
  onSaveFile,
  onTranslateAll,
  onSettings,
  apiKey,
  onApiKeyChange,
  isTranslating,
  hasEntries,
}) => {
  const fileMenuItems = [
    {
      key: 'open',
      icon: <FolderOpenOutlined />,
      label: '打开PO文件',
      onClick: onOpenFile,
    },
    {
      key: 'save',
      icon: <SaveOutlined />,
      label: '保存文件',
      onClick: onSaveFile,
    },
    {
      type: 'divider' as const,
    },
    {
      key: 'import',
      icon: <UploadOutlined />,
      label: '导入翻译记忆',
    },
    {
      key: 'export',
      icon: <DownloadOutlined />,
      label: '导出翻译记忆',
    },
  ];

  const translateMenuItems = [
    {
      key: 'translate-all',
      icon: <PlayCircleOutlined />,
      label: '翻译全部未翻译条目',
      onClick: onTranslateAll,
    },
    {
      key: 'translate-selected',
      icon: <TranslationOutlined />,
      label: '翻译选中条目',
    },
    {
      type: 'divider' as const,
    },
    {
      key: 'preview',
      label: '预览翻译结果',
    },
    {
      key: 'validate',
      label: '验证翻译',
    },
  ];

  const settingsMenuItems = [
    {
      key: 'api-settings',
      label: 'API设置',
      onClick: onSettings,
    },
    {
      key: 'memory-settings',
      label: '翻译记忆设置',
    },
    {
      key: 'ui-settings',
      label: '界面设置',
    },
  ];

  const menuItems = [
    {
      key: 'file',
      icon: <FileOutlined />,
      label: '文件',
      children: fileMenuItems,
    },
    {
      key: 'translate',
      icon: <TranslationOutlined />,
      label: '翻译',
      children: translateMenuItems,
    },
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: '设置',
      children: settingsMenuItems,
    },
  ];

  return (
    <div style={{ 
      display: 'flex', 
      alignItems: 'center', 
      padding: '0 16px',
      background: '#fff',
      borderBottom: '1px solid #f0f0f0',
      height: '64px'
    }}>
      <div style={{ fontSize: '18px', fontWeight: 'bold', marginRight: '24px' }}>
        PO翻译工具
      </div>
      
      <Menu
        mode="horizontal"
        items={menuItems}
        style={{ flex: 1, border: 'none', background: 'transparent' }}
      />
      
      <Space style={{ marginLeft: 'auto' }}>
        <Input
          placeholder="API Key"
          value={apiKey}
          onChange={(e) => onApiKeyChange(e.target.value)}
          style={{ width: 200 }}
          type="password"
        />
        <Button
          type="primary"
          icon={<PlayCircleOutlined />}
          onClick={onTranslateAll}
          loading={isTranslating}
          disabled={!apiKey || !hasEntries}
        >
          开始翻译
        </Button>
      </Space>
    </div>
  );
};
