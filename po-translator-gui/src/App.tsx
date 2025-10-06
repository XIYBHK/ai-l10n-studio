import { useState, useEffect } from 'react';
import { Layout, ConfigProvider } from 'antd';
import { invoke } from '@tauri-apps/api/tauri';
import { MenuBar } from './components/MenuBar';
import { EntryList } from './components/EntryList';
import { EditorPane } from './components/EditorPane';
import { SettingsModal } from './components/SettingsModal';
import { AIWorkspace } from './components/AIWorkspace';
import { useAppStore } from './store/useAppStore';
import { useTranslator } from './hooks/useTranslator';
import { useTheme } from './hooks/useTheme';
import { TranslationStats } from './types/tauri';
import './i18n/config';
import './App.css';

const { Sider } = Layout;

function App() {
  const {
    entries,
    currentEntry,
    isTranslating,
    progress,
    setEntries,
    setCurrentEntry,
    updateEntry,
    setTranslating,
    setProgress,
    setConfig,
  } = useAppStore();
  
  const { parsePOFile, translateBatchWithStats } = useTranslator();
  const [apiKey, setApiKey] = useState('');
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [translationStats, setTranslationStats] = useState<TranslationStats | null>(null);
  const [leftWidth, setLeftWidth] = useState(35); // 左侧栏宽度百分比
  const [isResizing, setIsResizing] = useState(false);
  
  const { themeConfig, algorithm, toggleTheme, isDark, colors } = useTheme();

  // 加载配置
  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const config = await invoke('get_app_config');
      if (config && typeof config === 'object' && 'api_key' in config) {
        const apiKeyValue = (config as any).api_key;
        if (apiKeyValue) {
          setApiKey(apiKeyValue);
        }
        setConfig(config as any);
      }
    } catch (error) {
      console.error('Failed to load config:', error);
    }
  };

  const openFile = async () => {
    try {
      const filePath = await invoke<string | null>('open_file_dialog');
      if (filePath) {
        const entries = await parsePOFile(filePath);
        setEntries(entries);
      }
    } catch (error) {
      console.error('Failed to open file:', error);
    }
  };

  const translateAll = async () => {
    if (!apiKey) {
      alert('请先在设置中配置 API 密钥！');
      return;
    }

    const untranslatedEntries = entries.filter(entry => 
      entry.msgid && !entry.msgstr
    );

    if (untranslatedEntries.length === 0) {
      alert('没有需要翻译的条目！');
      return;
    }

    const confirmed = confirm(`即将翻译 ${untranslatedEntries.length} 个未翻译条目，是否继续？`);
    if (!confirmed) {
      return;
    }

    setTranslating(true);
    setProgress(0);

    try {
      const texts = untranslatedEntries.map(entry => entry.msgid);
      
      // 使用带统计的批量翻译
      const result = await translateBatchWithStats(texts, apiKey);
      
      // 更新所有条目
      result.translations.forEach((translation, index) => {
        const entryIndex = entries.findIndex(e => e.msgid === texts[index]);
        if (entryIndex >= 0) {
          updateEntry(entryIndex, { 
            msgstr: translation, 
            needsReview: true  // 标记为待确认
          });
        }
        setProgress(((index + 1) / texts.length) * 100);
      });

      // 更新统计信息
      setTranslationStats(result.stats);

      const statsMsg = `
📊 翻译统计：
- 总条目：${result.stats.total}
- 记忆库命中：${result.stats.tm_hits} 条
- 去重后：${result.stats.deduplicated} 条
- AI翻译：${result.stats.ai_translated} 条
- 新学习：${result.stats.tm_learned} 条短语
- Token消耗：${result.stats.token_stats.total_tokens} (¥${result.stats.token_stats.cost.toFixed(4)})

节省了 ${result.stats.tm_hits + (result.stats.total - result.stats.deduplicated)} 次API调用！
      `.trim();

      alert(`翻译完成！\n\n${statsMsg}\n\n这些条目已标记为"待确认"，请检查后确认。`);
    } catch (error) {
      console.error('Translation failed:', error);
      alert(`翻译失败：${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setTranslating(false);
    }
  };

  const saveFile = async () => {
    try {
      const filePath = await invoke('save_file_dialog');
      if (filePath) {
        await invoke('save_po_file', { filePath, entries });
      }
    } catch (error) {
      console.error('Failed to save file:', error);
    }
  };

  const handleSettings = () => {
    setSettingsVisible(true);
  };

  const handleSettingsSave = (newConfig: any) => {
    setConfig(newConfig);
    if (newConfig.api_key) {
      setApiKey(newConfig.api_key);
    }
  };

  const handleResetStats = () => {
    setTranslationStats(null);
  };

  // 翻译选中的条目
  const handleTranslateSelected = async (indices: number[]) => {
    if (!apiKey) {
      alert('请先设置API密钥');
      return;
    }

    const selectedEntries = indices.map(i => entries[i]).filter(e => e && e.msgid && !e.msgstr);
    if (selectedEntries.length === 0) {
      alert('选中的条目都已翻译');
      return;
    }

    const texts = selectedEntries.map(e => e.msgid);
    
    try {
      setTranslating(true);
      const result = await translateBatchWithStats(texts, apiKey);
      
      // 更新条目
      result.translations.forEach((translation, index) => {
        const entry = selectedEntries[index];
        const entryIndex = entries.indexOf(entry);
        if (entryIndex >= 0) {
          updateEntry(entryIndex, { msgstr: translation, needsReview: true });
        }
      });
      
      // 更新统计
      setTranslationStats(result.stats);
      
      alert(`翻译完成！共翻译 ${result.translations.length} 个条目`);
    } catch (error) {
      console.error('Translation failed:', error);
      alert(`翻译失败：${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setTranslating(false);
    }
  };

  // 拖拽调整宽度
  const handleMouseDown = () => {
    setIsResizing(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      
      const windowWidth = window.innerWidth;
      const newWidth = (e.clientX / windowWidth) * 100;
      
      // 限制最小宽度20%，最大宽度60%
      if (newWidth >= 20 && newWidth <= 60) {
        setLeftWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing]);

  return (
    <ConfigProvider
      theme={{
        ...themeConfig,
        algorithm,
      }}
    >
      <div data-theme={isDark ? 'dark' : 'light'} style={{ height: '100vh', width: '100vw' }}>
      <Layout style={{ height: '100%', width: '100%' }}>
        <MenuBar
          onOpenFile={openFile}
          onSaveFile={saveFile}
          onTranslateAll={translateAll}
          onSettings={handleSettings}
          apiKey={apiKey}
          onApiKeyChange={setApiKey}
          isTranslating={isTranslating}
          hasEntries={entries.length > 0}
          isDarkMode={isDark}
          onThemeToggle={toggleTheme}
        />
      
      <Layout style={{ height: 'calc(100vh - 48px)', width: '100%', position: 'relative' }}>
        <div 
          style={{ 
            width: `${leftWidth}%`,
            background: colors.bgPrimary,
            borderRight: `1px solid ${colors.borderPrimary}`,
            overflow: 'hidden',
            minWidth: '300px',
            position: 'relative'
          }}
        >
          <EntryList
            entries={entries}
            currentEntry={currentEntry}
            isTranslating={isTranslating}
            progress={progress}
            onEntrySelect={setCurrentEntry}
            onTranslateSelected={handleTranslateSelected}
          />
          {/* 拖拽手柄 */}
          <div
            onMouseDown={handleMouseDown}
            style={{
              position: 'absolute',
              right: 0,
              top: 0,
              bottom: 0,
              width: '5px',
              cursor: 'col-resize',
              background: isResizing ? '#1890ff' : 'transparent',
              transition: 'background 0.2s',
              zIndex: 10
            }}
            onMouseEnter={(e) => {
              if (!isResizing) {
                (e.target as HTMLElement).style.background = '#e6f7ff';
              }
            }}
            onMouseLeave={(e) => {
              if (!isResizing) {
                (e.target as HTMLElement).style.background = 'transparent';
              }
            }}
          />
        </div>
        
        <div 
          style={{ 
            background: colors.bgPrimary,
            overflow: 'auto',
            flex: 1
          }}
        >
          <EditorPane
            entry={currentEntry}
            onEntryUpdate={updateEntry}
          />
        </div>

        <Sider
          width="320"
          style={{
            background: colors.bgTertiary,
            borderLeft: `1px solid ${colors.borderPrimary}`,
            overflow: 'auto',
            maxWidth: 'none',
            minWidth: '300px',
            flex: '0 0 320px'
          }}
        >
          <AIWorkspace 
            stats={translationStats} 
            isTranslating={isTranslating}
            onResetStats={handleResetStats}
          />
        </Sider>
      </Layout>

      <SettingsModal
        visible={settingsVisible}
        onClose={() => setSettingsVisible(false)}
        onSave={handleSettingsSave}
      />
    </Layout>
    </div>
    </ConfigProvider>
  );
}

export default App;
