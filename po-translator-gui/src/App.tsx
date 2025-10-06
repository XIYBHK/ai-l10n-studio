import React, { useState, useEffect } from 'react';
import { Layout } from 'antd';
import { invoke } from '@tauri-apps/api/tauri';
import { MenuBar } from './components/MenuBar';
import { EntryList } from './components/EntryList';
import { EditorPane } from './components/EditorPane';
import { SettingsModal } from './components/SettingsModal';
import { useAppStore } from './store/useAppStore';
import { useTranslator } from './hooks/useTranslator';
import './App.css';

const { Sider, Content } = Layout;

function App() {
  const {
    entries,
    currentEntry,
    isTranslating,
    progress,
    config,
    setEntries,
    setCurrentEntry,
    updateEntry,
    setTranslating,
    setProgress,
    setConfig,
  } = useAppStore();
  
  const { parsePOFile, translateBatch } = useTranslator();
  const [apiKey, setApiKey] = useState('');
  const [settingsVisible, setSettingsVisible] = useState(false);

  // 加载配置
  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const config = await invoke('get_config');
      if (config && typeof config === 'object' && 'api_key' in config) {
        setApiKey((config as any).api_key);
        setConfig(config as any);
      }
    } catch (error) {
      console.error('Failed to load config:', error);
    }
  };

  const openFile = async () => {
    try {
      const filePath = await invoke('open_file_dialog');
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
      return;
    }

    setTranslating(true);
    setProgress(0);

    try {
      const untranslatedEntries = entries.filter(entry => 
        entry.msgid && !entry.msgstr
      );

      const texts = untranslatedEntries.map(entry => entry.msgid);
      
      await translateBatch(texts, apiKey, (index, translation) => {
        const entryIndex = entries.findIndex(e => e.msgid === texts[index]);
        if (entryIndex >= 0) {
          updateEntry(entryIndex, { msgstr: translation });
        }
        setProgress(((index + 1) / texts.length) * 100);
      });
    } catch (error) {
      console.error('Translation failed:', error);
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

  return (
    <Layout style={{ height: '100vh' }}>
      <MenuBar
        onOpenFile={openFile}
        onSaveFile={saveFile}
        onTranslateAll={translateAll}
        onSettings={handleSettings}
        apiKey={apiKey}
        onApiKeyChange={setApiKey}
        isTranslating={isTranslating}
        hasEntries={entries.length > 0}
      />
      
      <Layout>
        <Sider width={300} style={{ background: '#fff' }}>
          <EntryList
            entries={entries}
            currentEntry={currentEntry}
            isTranslating={isTranslating}
            progress={progress}
            onEntrySelect={setCurrentEntry}
          />
        </Sider>
        
        <Content style={{ padding: '16px', background: '#fff' }}>
          <EditorPane
            entry={currentEntry}
            onEntryUpdate={updateEntry}
          />
        </Content>
      </Layout>

      <SettingsModal
        visible={settingsVisible}
        onClose={() => setSettingsVisible(false)}
        onSave={handleSettingsSave}
      />
    </Layout>
  );
}

export default App;
