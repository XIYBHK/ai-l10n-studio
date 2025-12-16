import React from 'react';
import { Segmented } from 'antd';
import { BulbOutlined, MoonOutlined, DesktopOutlined } from '@ant-design/icons';
import { useTheme } from '../hooks/useTheme';
import { useTranslation } from 'react-i18next';

// 🚀 简化版主题切换组件 - 参考 cc-switch
// 移除复杂逻辑，直接使用 useTheme

interface ThemeModeSwitchProps {
  style?: React.CSSProperties;
  className?: string;
}

export const ThemeModeSwitch: React.FC<ThemeModeSwitchProps> = React.memo(
  ({ style, className }) => {
    const { themeMode, setTheme } = useTheme();
    const { t } = useTranslation();

    const options = [
      {
        label: (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <BulbOutlined />
            <span>{t('theme.light') || '浅色'}</span>
          </div>
        ),
        value: 'light',
      },
      {
        label: (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <MoonOutlined />
            <span>{t('theme.dark') || '深色'}</span>
          </div>
        ),
        value: 'dark',
      },
      {
        label: (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <DesktopOutlined />
            <span>{t('theme.system') || '跟随系统'}</span>
          </div>
        ),
        value: 'system',
      },
    ];

    return (
      <Segmented
        style={style}
        className={className}
        options={options}
        value={themeMode}
        onChange={(value) => setTheme(value as 'light' | 'dark' | 'system')}
      />
    );
  }
);
