import React from 'react';
import { Segmented } from 'antd';
import { BulbOutlined, MoonOutlined, DesktopOutlined } from '@ant-design/icons';
import { useTheme, ThemeMode } from '../hooks/useTheme';
import { useTranslation } from 'react-i18next';

/**
 * Phase 9: 主题模式切换组件
 * 
 * 特性：
 * - 三种模式：light/dark/system
 * - 图标 + 文字显示
 * - 响应式设计
 * 
 * 参考：clash-verge-rev/components/setting/mods/theme-mode-switch.tsx
 */

interface ThemeModeSwitchProps {
  style?: React.CSSProperties;
  className?: string;
}

export const ThemeModeSwitch: React.FC<ThemeModeSwitchProps> = ({ style, className }) => {
  const { themeMode, setTheme } = useTheme();
  const { t } = useTranslation();

  const options = [
    {
      label: (
        <div style={{ padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <BulbOutlined />
          <span>{t('theme.light') || '浅色'}</span>
        </div>
      ),
      value: 'light' as ThemeMode,
    },
    {
      label: (
        <div style={{ padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <MoonOutlined />
          <span>{t('theme.dark') || '深色'}</span>
        </div>
      ),
      value: 'dark' as ThemeMode,
    },
    {
      label: (
        <div style={{ padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <DesktopOutlined />
          <span>{t('theme.system') || '跟随系统'}</span>
        </div>
      ),
      value: 'system' as ThemeMode,
    },
  ];

  return (
    <Segmented
      style={style}
      className={className}
      options={options}
      value={themeMode}
      onChange={(value) => setTheme(value as ThemeMode)}
    />
  );
};

