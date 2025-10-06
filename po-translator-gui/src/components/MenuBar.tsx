import { Button, Tooltip, Divider } from 'antd';
import { 
  FolderOpenOutlined,
  SaveOutlined,
  SettingOutlined,
  TranslationOutlined,
  BulbOutlined,
  BulbFilled,
} from '@ant-design/icons';
import { useTheme } from '../hooks/useTheme';

interface MenuBarProps {
  onOpenFile: () => void;
  onSaveFile: () => void;
  onTranslateAll: () => void;
  onSettings: () => void;
  apiKey: string;
  onApiKeyChange: (key: string) => void;
  isTranslating: boolean;
  hasEntries: boolean;
  isDarkMode?: boolean;
  onThemeToggle?: () => void;
}

export const MenuBar: React.FC<MenuBarProps> = ({
  onOpenFile,
  onSaveFile,
  onTranslateAll,
  onSettings,
  apiKey,
  isTranslating,
  hasEntries,
  isDarkMode = false,
  onThemeToggle,
}) => {
  const { colors } = useTheme();
  
  return (
    <div style={{ 
      display: 'flex', 
      alignItems: 'center', 
      padding: '8px 16px',
      background: colors.bgTertiary,
      borderBottom: `1px solid ${colors.borderPrimary}`,
      gap: '8px'
    }}>
      <div style={{ 
        fontSize: '16px', 
        fontWeight: 600, 
        marginRight: '16px',
        color: colors.statusUntranslated
      }}>
        🌐 PO 翻译工具
      </div>
      
      <Tooltip title="打开 PO 文件 (Ctrl+O)">
        <Button 
          icon={<FolderOpenOutlined />}
          onClick={onOpenFile}
          size="middle"
        >
          打开
        </Button>
      </Tooltip>
      
      <Tooltip title="保存文件 (Ctrl+S)">
        <Button 
          icon={<SaveOutlined />}
          onClick={onSaveFile}
          disabled={!hasEntries}
          size="middle"
        >
          保存
        </Button>
      </Tooltip>
      
      <Divider type="vertical" style={{ height: '24px', margin: '0 8px' }} />
      
      <Tooltip title="翻译所有未翻译条目">
        <Button 
          type="primary"
          icon={<TranslationOutlined />}
          onClick={onTranslateAll}
          loading={isTranslating}
          disabled={!apiKey || !hasEntries}
          size="middle"
        >
          {isTranslating ? '翻译中...' : '批量翻译'}
        </Button>
      </Tooltip>
      
      <div style={{ flex: 1 }} />
      
      {onThemeToggle && (
        <Tooltip title={isDarkMode ? "切换到亮色模式" : "切换到暗色模式"}>
          <Button 
            icon={isDarkMode ? <BulbFilled /> : <BulbOutlined />}
            onClick={onThemeToggle}
            size="middle"
            type="text"
          />
        </Tooltip>
      )}
      
      <Tooltip title="设置 API 密钥和翻译选项">
        <Button 
          icon={<SettingOutlined />}
          onClick={onSettings}
          size="middle"
        >
          设置
        </Button>
      </Tooltip>
      
      {!apiKey && (
        <div style={{ 
          padding: '4px 12px', 
          background: isDarkMode ? 'rgba(250, 173, 20, 0.15)' : '#fff7e6', 
          border: `1px solid ${colors.statusNeedsReview}`,
          borderRadius: '4px',
          fontSize: '12px',
          color: colors.statusNeedsReview
        }}>
          ⚠️ 请先在设置中配置 API 密钥
        </div>
      )}
    </div>
  );
};
