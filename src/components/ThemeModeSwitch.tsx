import React from 'react';
import { Segmented } from 'antd';
import { BulbOutlined, MoonOutlined, DesktopOutlined } from '@ant-design/icons';
import { useTheme } from '../hooks/useTheme';

interface ThemeModeSwitchProps {
  style?: React.CSSProperties;
  className?: string;
}

export const ThemeModeSwitch: React.FC<ThemeModeSwitchProps> = React.memo(
  ({ style, className }) => {
    const { themeMode, setTheme } = useTheme();

    const options = [
      {
        label: (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '13px',
            }}
          >
            <BulbOutlined />
            <span>浅色</span>
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
              fontSize: '13px',
            }}
          >
            <MoonOutlined />
            <span>深色</span>
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
              fontSize: '13px',
            }}
          >
            <DesktopOutlined />
            <span>跟随系统</span>
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
