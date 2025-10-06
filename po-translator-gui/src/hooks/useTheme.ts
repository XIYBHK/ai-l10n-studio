import { useMemo } from 'react';
import { theme as antTheme } from 'antd';
import { useAppStore } from '../store/useAppStore';
import { lightTheme, darkTheme, semanticColors } from '../theme/config';

export const useTheme = () => {
  const theme = useAppStore((state) => state.theme);
  const toggleTheme = useAppStore((state) => state.toggleTheme);
  
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

