/**
 * 应用菜单栏
 * 包含文件操作、翻译、设置等按钮
 */

import React from 'react';
import { Layout, Button, Space } from 'antd';
import {
  FolderOpenOutlined,
  SaveOutlined,
  SettingOutlined,
  ThunderboltOutlined,
  ApiOutlined,
} from '@ant-design/icons';
import { useSessionStore } from '../../store';
import { useTheme } from '../../hooks/useTheme';
import { ThemeModeSwitch } from '../ThemeModeSwitch';

const { Header } = Layout;

interface AppMenuBarProps {
  onOpenFile: () => void;
  onSaveFile: () => void;
  onSaveAsFile: () => void;
  onSettings: () => void;
  onTranslateAll: () => void;
  onTranslateUntranslated: () => void;
  onTranslateSelected: () => void;
  isTranslating: boolean;
}

export const AppMenuBar: React.FC<AppMenuBarProps> = ({
  onOpenFile,
  onSaveFile,
  onSaveAsFile,
  onSettings,
  onTranslateAll,
  onTranslateUntranslated,
  onTranslateSelected,
  isTranslating,
}) => {
  const { colors } = useTheme();
  const { entries } = useSessionStore();

  const hasEntries = entries.length > 0;
  const untranslatedCount = entries.filter((e) => !e.msgstr).length;

  return (
    <Header
      style={{
        background: colors.bgPrimary,
        padding: '0 16px',
        borderBottom: '1px solid #f0f0f0',
        height: 48,
        lineHeight: '48px',
      }}
    >
      <Space size="middle">
        {/* 文件操作 */}
        <Button
          icon={<FolderOpenOutlined />}
          onClick={onOpenFile}
        >
          打开
        </Button>

        <Button
          icon={<SaveOutlined />}
          onClick={onSaveFile}
          disabled={!hasEntries}
        >
          保存
        </Button>

        <Button
          icon={<SaveOutlined />}
          onClick={onSaveAsFile}
          disabled={!hasEntries}
        >
          另存为
        </Button>

        {/* 翻译操作 */}
        <Button
          type="primary"
          icon={<ThunderboltOutlined />}
          onClick={onTranslateAll}
          disabled={!hasEntries || isTranslating}
          loading={isTranslating}
        >
          翻译全部 ({entries.length})
        </Button>

        <Button
          icon={<ThunderboltOutlined />}
          onClick={onTranslateUntranslated}
          disabled={!hasEntries || isTranslating || untranslatedCount === 0}
          loading={isTranslating}
        >
          翻译未翻译 ({untranslatedCount})
        </Button>

        <Button
          icon={<ApiOutlined />}
          onClick={onTranslateSelected}
          disabled={!hasEntries || isTranslating}
          loading={isTranslating}
        >
          翻译选中
        </Button>

        {/* 主题切换 */}
        <ThemeModeSwitch style={{ marginLeft: 16 }} />

        {/* 设置 */}
        <Button
          icon={<SettingOutlined />}
          onClick={onSettings}
          style={{ marginLeft: 'auto' }}
        >
          设置
        </Button>
      </Space>
    </Header>
  );
};

export default AppMenuBar;
