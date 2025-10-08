import { useMemo } from 'react';
import { theme as antTheme } from 'antd';
import { useSettingsStore } from '../store';
import { lightTheme, darkTheme, semanticColors } from '../theme/config';

export const useTheme = () => {
  const theme = useSettingsStore((state) => state.theme);
  const toggleTheme = useSettingsStore((state) => state.toggleTheme);
  
  const themeConfig = useMemo(() => {
    return theme === 'dark' ? darkTheme : lightTheme;
  }, [theme]);
  
  const colors = useMemo(() => {
    return theme === 'dark' ? semanticColors.dark : semanticColors.light;
  }, [theme]);
  
  const algorithm = useMemo(() => {
    return theme === 'dark' ? antTheme.darkAlgorithm : antTheme.defaultAlgorithm;
  }, [theme]);
  
  return {
    theme,
    themeConfig,
    colors,
    algorithm,
    toggleTheme,
    isDark: theme === 'dark',
  };
};

