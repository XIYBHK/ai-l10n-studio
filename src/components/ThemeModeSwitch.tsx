import { memo } from 'react';
import { Segmented } from 'antd';
import { BulbOutlined, MoonOutlined, DesktopOutlined } from '@ant-design/icons';
import { useTheme } from '../hooks/useTheme';

interface ThemeModeSwitchProps {
  style?: React.CSSProperties;
  className?: string;
}

export const ThemeModeSwitch = memo(function ThemeModeSwitch({
  style,
  className,
}: ThemeModeSwitchProps) {
  const { themeMode, setTheme } = useTheme();

  const options = [
    {
      label: (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-1)',
            fontSize: 'var(--font-size-base)',
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
            gap: 'var(--space-1)',
            fontSize: 'var(--font-size-base)',
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
            gap: 'var(--space-1)',
            fontSize: 'var(--font-size-base)',
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
});
