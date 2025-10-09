import { useState, useEffect, useRef } from 'react';
import { Layout, ConfigProvider, message, Alert, Button, Space } from 'antd';
import { listen } from '@tauri-apps/api/event';
import { throttle } from 'lodash';
import { MenuBar } from './components/MenuBar';
import { EntryList } from './components/EntryList';
import { EditorPane } from './components/EditorPane';
import { SettingsModal } from './components/SettingsModal';
import { DevToolsModal } from './components/DevToolsModal';
import { AIWorkspace } from './components/AIWorkspace';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useSessionStore } from './store';
// import { useSettingsStore, useStatsStore } from './store'; // 预留给未来使用
import { useTranslator } from './hooks/useTranslator';
import { useTheme } from './hooks/useTheme';
import { useTauriEventBridge } from './hooks/useTauriEventBridge';
import { useChannelTranslation } from './hooks/useChannelTranslation'; // Tauri 2.x: Channel API
import { TranslationStats, POEntry } from './types/tauri';
import { createModuleLogger } from './utils/logger';
import { eventDispatcher } from './services/eventDispatcher';
import { configApi, poFileApi, dialogApi, languageApi, translatorApi, aiConfigApi, apiClient, type LanguageInfo } from './services/api';
import { ConfigSyncManager } from './services/configSync';
import { notificationManager } from './utils/notificationManager'; // Tauri 2.x: Notification Plugin
import './i18n/config';
import './App.css';

const { Sider } = Layout;
const log = createModuleLogger('App');

function App() {
  // 使用新的分离式 store
  const {
    entries,
    currentEntry,
    currentIndex,
    currentFilePath,
    isTranslating,
    progress,
    setEntries,
    setCurrentEntry,
    setCurrentFilePath,
    updateEntry,
    setTranslating,
    setProgress,
  } = useSessionStore();
  
  // 注意：theme 由 useTheme hook 管理，language 由 i18n 管理
  // const { cumulativeStats, updateCumulativeStats } = useStatsStore(); // 暂未使用
  
  const { parsePOFile } = useTranslator();
  const channelTranslation = useChannelTranslation(); // Tauri 2.x: Channel API for high-performance batch translation
  const [apiKey, setApiKey] = useState('');
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [devToolsVisible, setDevToolsVisible] = useState(false);
  const [translationStats, setTranslationStats] = useState<TranslationStats | null>(null);
  const [leftWidth, setLeftWidth] = useState(35); // 左侧栏宽度百分比
  const [isResizing, setIsResizing] = useState(false);
  // 存储AI原译文，用于术语检测对比（key: 条目索引, value: AI译文）
  const [aiTranslations, setAiTranslations] = useState<Map<number, string>>(new Map());
  
  // Phase 5: 语言状态管理
  const [sourceLanguage, setSourceLanguage] = useState<string>('');
  const [targetLanguage, setTargetLanguage] = useState<string>('zh-CN'); // 默认目标语言：简体中文
  
  const { themeConfig, algorithm, toggleTheme, isDark, colors } = useTheme();
  
  // 使用 ref 防止重复检查AI配置
  const hasCheckedAIConfig = useRef(false);
  
  // 配置同步管理器
  const configSyncRef = useRef<ConfigSyncManager | null>(null);
  const [configSyncIssues, setConfigSyncIssues] = useState<string[]>([]);
  
  // 🌉 建立 Tauri 事件桥接
  useTauriEventBridge();

  // 💾 Store 已在 main.tsx 中初始化，这里不需要重复初始化

  // 全局错误处理 - 防止黑屏
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      log.error('全局错误捕获', {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error
      });
      message.error(`应用错误: ${event.message}`, 5);
      event.preventDefault(); // 阻止默认的错误处理，避免黑屏
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      log.error('未处理的Promise拒绝', {
        reason: event.reason,
        promise: event.promise
      });
      message.error(`异步操作失败: ${event.reason}`, 5);
      event.preventDefault(); // 阻止默认的错误处理
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      // 组件卸载时取消所有待处理的 API 请求
      apiClient.cancelAll();
    };
  }, []);

  // 初始化配置同步管理器
  useEffect(() => {
    const syncManager = new ConfigSyncManager();
    configSyncRef.current = syncManager;
    
    // 初始化配置同步
    syncManager.initialize().catch((error: unknown) => {
      log.error('配置同步管理器初始化失败', { error });
    });
    
    // 监听配置不一致事件
    const unsubscribe = eventDispatcher.on('config:out-of-sync', (data) => {
      log.warn('⚠️ 检测到配置不一致', data);
      setConfigSyncIssues(data.issues || []);
    });
    
    return () => {
      syncManager.destroy();
      unsubscribe();
    };
  }, []);

  // 加载配置并检查AI配置
  useEffect(() => {
    const initApp = async () => {
      await loadConfig();
      
      // 检查AI配置（使用ref防止重复执行）
      if (!hasCheckedAIConfig.current) {
        hasCheckedAIConfig.current = true;
        
        setTimeout(async () => {
          try {
            const activeConfig = await aiConfigApi.getActiveConfig();
            if (!activeConfig) {
              // 直接打开设置窗口，不显示消息
              setSettingsVisible(true);
              log.info('未检测到AI配置，已自动打开设置窗口');
            }
          } catch (error) {
            log.logError(error, '检查AI配置失败');
          }
        }, 500); // 延迟500ms执行
      }
    };
    
    initApp();
  }, []);

  // 全局快捷键监听
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl+O 打开文件
      if ((event.ctrlKey || event.metaKey) && event.key === 'o') {
        event.preventDefault();
        openFile();
      }
      // Ctrl+S 保存文件
      else if ((event.ctrlKey || event.metaKey) && event.key === 's') {
        event.preventDefault();
        saveFile();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [currentFilePath, entries]); // 依赖 currentFilePath 和 entries，确保闭包中获取最新值

  // 文件拖放监听（使用 Tauri API）
  useEffect(() => {
    let unlistenFn: (() => void) | null = null;

    const setupListener = async () => {
      // 使用 @tauri-apps/api/event 的 listen
      unlistenFn = await listen<string[]>('tauri://file-drop', async (event) => {
        const files = event.payload;
        log.info('文件拖放事件接收', { files });
        
        if (files && files.length > 0) {
          const filePath = files[0];
          // 检查是否为 .po 文件
          if (filePath.toLowerCase().endsWith('.po')) {
            try {
              const entries = await parsePOFile(filePath) as POEntry[];
              setEntries(entries);
              setCurrentFilePath(filePath);
              log.info('通过拖放导入文件成功', { filePath });
              alert(`成功导入文件: ${filePath.split(/[/\\]/).pop()}`);
            } catch (error) {
              log.logError(error, '解析拖放文件失败');
              alert(`文件解析失败：${error instanceof Error ? error.message : '未知错误'}`);
            }
          } else {
            alert('⚠️ 仅支持 .po 文件！');
          }
        }
      });
      
      log.debug('文件拖放监听器设置完成');
    };

    setupListener();

    return () => {
      if (unlistenFn) {
        unlistenFn();
      }
    };
  }, []); // 空依赖数组，只在组件挂载时设置一次监听器

  const loadConfig = async () => {
    try {
      const config = await configApi.get();
      if (config && typeof config === 'object' && 'api_key' in config) {
        const apiKeyValue = (config as any).api_key;
        if (apiKeyValue) {
          setApiKey(apiKeyValue);
        }
        // 配置现在由 ConfigSyncManager 管理，无需手动同步
      }
    } catch (error) {
      log.logError(error, '加载配置失败');
    }
  };

  // Phase 5: 检测语言并设置默认目标语言
  const detectAndSetLanguages = async (entries: POEntry[]) => {
    try {
      // 取前几个有效条目的文本进行检测
      const sampleTexts = entries
        .filter(e => e.msgid && e.msgid.trim())
        .slice(0, 5)
        .map(e => e.msgid)
        .join(' ');
      
      if (sampleTexts) {
        const detectedLang = await languageApi.detectLanguage(sampleTexts);
        setSourceLanguage(detectedLang.display_name);
        log.info('检测到源语言', { code: detectedLang.code, name: detectedLang.display_name });
        
        // 获取默认目标语言
        const defaultTarget = await languageApi.getDefaultTargetLanguage(detectedLang.code);
        setTargetLanguage(defaultTarget.code);
        log.info('设置默认目标语言', { code: defaultTarget.code, name: defaultTarget.display_name });
      }
    } catch (error) {
      log.logError(error, '语言检测失败，使用默认设置');
      setSourceLanguage('未知');
      setTargetLanguage('zh-CN'); // 默认中文
    }
  };

  // Phase 5: 处理目标语言变更
  const handleTargetLanguageChange = (langCode: string, langInfo: LanguageInfo | undefined) => {
    setTargetLanguage(langCode);
    if (langInfo) {
      log.info('切换目标语言', { code: langInfo.code, name: langInfo.display_name });
    }
  };

  const openFile = async () => {
    try {
      const filePath = await dialogApi.openFile();
      if (filePath) {
        const entries = await parsePOFile(filePath) as POEntry[];
        setEntries(entries);
        setCurrentFilePath(filePath);
        
        // Phase 5: 检测源语言并设置默认目标语言
        await detectAndSetLanguages(entries);
        
        // 触发文件加载事件
        await eventDispatcher.emit('file:loaded', { path: filePath, entries });
        log.info('文件加载成功', { filePath, entryCount: entries.length });
      }
    } catch (error) {
      log.logError(error, '打开文件失败');
      await eventDispatcher.emit('file:error', { 
        path: undefined, 
        error: error as Error, 
        operation: 'load' 
      });
    }
  };

  const translateAll = async () => {
    // 检查是否有启用的AI配置
    try {
      const activeConfig = await aiConfigApi.getActiveConfig();
      if (!activeConfig) {
        alert('请先在设置中配置并启用 AI 服务！');
        setSettingsVisible(true);
        return;
      }
    } catch (error) {
      alert('无法获取AI配置，请先在设置中配置！');
      setSettingsVisible(true);
      return;
    }

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

    const success = await executeTranslation(untranslatedEntries, 'all');
    
    if (success && translationStats) {
      const statsMsg = `
📊 翻译统计：
- 总条目：${translationStats.total}
- 记忆库命中：${translationStats.tm_hits} 条
- 去重后：${translationStats.deduplicated} 条
- AI翻译：${translationStats.ai_translated} 条
- 新学习：${translationStats.tm_learned} 条短语
- Token消耗：${translationStats.token_stats.total_tokens} (¥${translationStats.token_stats.cost.toFixed(4)})

节省了 ${translationStats.tm_hits + (translationStats.total - translationStats.deduplicated)} 次API调用！
      `.trim();

      alert(`翻译完成！\n\n${statsMsg}\n\n这些条目已标记为"待确认"，请检查后确认。`);
    }
  };

  // 保存到原文件
  const saveFile = async () => {
    if (!currentFilePath) {
      message.warning('没有打开的文件，请使用"另存为"');
      return;
    }
    
    try {
      await poFileApi.save(currentFilePath, entries);
      message.success('保存成功！');
      
      // 触发文件保存事件
      await eventDispatcher.emit('file:saved', { 
        path: currentFilePath, 
        success: true 
      });
      log.info('文件保存成功', { filePath: currentFilePath });
    } catch (error) {
      log.logError(error, '保存文件失败');
      message.error(`保存失败：${error instanceof Error ? error.message : '未知错误'}`);
      
      await eventDispatcher.emit('file:error', { 
        path: currentFilePath, 
        error: error as Error, 
        operation: 'save' 
      });
    }
  };
  
  // 另存为
  const saveAsFile = async () => {
    try {
      const filePath = await dialogApi.saveFile();
      if (filePath) {
        await poFileApi.save(filePath, entries);
        setCurrentFilePath(filePath);
        message.success('保存成功！');
        
        // 触发文件保存事件
        await eventDispatcher.emit('file:saved', { 
          path: filePath, 
          success: true 
        });
        log.info('文件另存为成功', { filePath });
      }
    } catch (error) {
      log.logError(error, '另存为失败');
      message.error(`保存失败：${error instanceof Error ? error.message : '未知错误'}`);
      
      await eventDispatcher.emit('file:error', { 
        path: undefined, 
        error: error as Error, 
        operation: 'save' 
      });
    }
  };

  const handleSettings = () => {
    setSettingsVisible(true);
  };

  const handleDevTools = () => {
    setDevToolsVisible(true);
  };

  const handleResetStats = () => {
    setTranslationStats(null);
  };

  // 🔧 统一的翻译处理函数 - 智能选择 Channel API 或 Event API
  const executeTranslation = async (
    entriesToTranslate: POEntry[], 
    sourceType: 'all' | 'selected' = 'all'
  ) => {
    if (!apiKey) {
      message.warning('请先设置API密钥');
      return false;
    }

    const texts = entriesToTranslate.map(e => e.msgid);
    const USE_CHANNEL_THRESHOLD = 100; // 超过此数量使用 Channel API
    const useChannelAPI = texts.length >= USE_CHANNEL_THRESHOLD;
    
    let completedCount = 0;
    
    try {
      setTranslating(true);
      setProgress(0);
      
      // 触发翻译开始事件
      await eventDispatcher.emit('translation:before', { texts, source: sourceType });
      log.info(`🚀 开始翻译 (${useChannelAPI ? 'Channel API' : 'Event API'})`, { 
        count: texts.length, 
        source: sourceType 
      });
      
      if (useChannelAPI) {
        // ========== Tauri 2.x: 使用 Channel API (高性能) ==========
        const result = await channelTranslation.translateBatch(texts, targetLanguage, {
          onProgress: (current, _total, percentage) => {
            setProgress(percentage);
            completedCount = current;
          },
          onStats: (stats) => {
            // 转换 Channel API 的统计格式到 TranslationStats
            setTranslationStats({
              ...stats,
              token_stats: {
                total_tokens: stats.token_stats.total_tokens,
                prompt_tokens: stats.token_stats.prompt_tokens,
                completion_tokens: stats.token_stats.completion_tokens,
                input_tokens: stats.token_stats.prompt_tokens, // Channel API uses prompt_tokens
                output_tokens: stats.token_stats.completion_tokens, // Channel API uses completion_tokens
                cost: stats.token_stats.cost,
              },
            } as TranslationStats);
          },
        });
        
        // 应用翻译结果
        Object.entries(result.translations).forEach(([indexStr, translation]) => {
          const index = parseInt(indexStr, 10);
          const entry = entriesToTranslate[index];
          const entryIndex = entries.indexOf(entry);
          
          if (entryIndex >= 0) {
            updateEntry(entryIndex, { 
              msgstr: translation, 
              needsReview: true 
            });
            
            setAiTranslations(prev => {
              const newMap = new Map(prev);
              newMap.set(entryIndex, translation);
              return newMap;
            });
          }
        });
        
        // 确保统计已设置（通过 onStats 回调）
        if (!translationStats) {
          setTranslationStats({
            ...result.stats,
            token_stats: {
              total_tokens: result.stats.token_stats.total_tokens,
              prompt_tokens: result.stats.token_stats.prompt_tokens,
              completion_tokens: result.stats.token_stats.completion_tokens,
              input_tokens: result.stats.token_stats.prompt_tokens,
              output_tokens: result.stats.token_stats.completion_tokens,
              cost: result.stats.token_stats.cost,
            },
          } as TranslationStats);
        }
        
      } else {
        // ========== 传统: 使用 Event API ==========
        const unsubProgress = eventDispatcher.on('translation:progress', ({ index, translation }) => {
          const logPrefix = sourceType === 'all' ? '全部翻译' : '选中翻译';
          log.debug(`📥 收到翻译进度（${logPrefix}）`, { index, translation });
          
          const entry = entriesToTranslate[index];
          const entryIndex = entries.indexOf(entry);
          
          if (entryIndex >= 0) {
            updateEntry(entryIndex, { 
              msgstr: translation, 
              needsReview: true 
            });
            
            setAiTranslations(prev => {
              const newMap = new Map(prev);
              newMap.set(entryIndex, translation);
              return newMap;
            });
            
            completedCount++;
            setProgress((completedCount / texts.length) * 100);
          }
        });
        
        const unsubStats = eventDispatcher.on('translation:stats', (stats) => {
          setTranslationStats(stats);
        });
        
        await translatorApi.translateBatch(texts, targetLanguage);
        
        unsubProgress();
        unsubStats();
      }
      
      // 触发翻译完成事件
      await eventDispatcher.emit('translation:after', { 
        success: true, 
        stats: translationStats || undefined 
      });
      log.info('✅ 翻译完成', { count: completedCount, api: useChannelAPI ? 'Channel' : 'Event' });
      
      // 📬 发送完成通知
      if (translationStats) {
        const failedCount = translationStats.total - translationStats.ai_translated - translationStats.tm_hits;
        await notificationManager.batchTranslationComplete(
          translationStats.total,
          translationStats.ai_translated + translationStats.tm_hits,
          failedCount
        );
      }
      
      return true; // 成功
    } catch (error) {
      log.logError(error, '翻译失败');
      
      // 直接显示错误信息（后端已经处理成友好提示）
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      message.error({
        content: errorMessage,
        duration: 8,
      });
      
      // 触发翻译错误事件
      await eventDispatcher.emit('translation:error', { 
        error: error as Error, 
        phase: 'execution' 
      });
      
      return false; // 失败
    } finally {
      setTranslating(false);
      setProgress(0);
    }
  };

  // 翻译选中的条目
  const handleTranslateSelected = async (indices: number[]) => {
    // 检查是否有启用的AI配置
    try {
      const activeConfig = await aiConfigApi.getActiveConfig();
      if (!activeConfig) {
        message.warning('请先在设置中配置并启用 AI 服务！');
        setSettingsVisible(true);
        return;
      }
    } catch (error) {
      message.warning('无法获取AI配置，请先在设置中配置！');
      setSettingsVisible(true);
      return;
    }
    
    const selectedEntries = indices.map(i => entries[i]).filter(e => e && e.msgid && !e.msgstr);
    if (selectedEntries.length === 0) {
      message.info('选中的条目都已翻译');
      return;
    }

    const success = await executeTranslation(selectedEntries, 'selected');
    if (success) {
      message.success(`翻译完成！共翻译 ${selectedEntries.length} 个条目`);
    }
  };

  // Phase 7: 精翻选中的条目（Contextual Refine）
  const handleContextualRefine = async (indices: number[]) => {
    // 检查是否有启用的AI配置
    try {
      const activeConfig = await aiConfigApi.getActiveConfig();
      if (!activeConfig) {
        message.warning('请先在设置中配置并启用 AI 服务！');
        setSettingsVisible(true);
        return;
      }
    } catch (error) {
      message.warning('无法获取AI配置，请先在设置中配置！');
      setSettingsVisible(true);
      return;
    }
    
    // 过滤出待确认的条目
    const selectedEntries = indices
      .map(i => ({ index: i, entry: entries[i] }))
      .filter(({ entry }) => entry && entry.msgid && entry.needsReview);

    if (selectedEntries.length === 0) {
      message.info('选中的条目中没有待确认的项');
      return;
    }

    if (!apiKey) {
      message.error('请先在设置中配置 API Key');
      setSettingsVisible(true);
      return;
    }

    setTranslating(true);
    
    try {
      // 构建精翻请求
      const requests = selectedEntries.map(({ index, entry }) => ({
        msgid: entry.msgid,
        msgctxt: entry.msgctxt || undefined,
        comment: entry.comments.join('\n') || undefined,
        previous_entry: index > 0 ? entries[index - 1]?.msgstr : undefined,
        next_entry: index < entries.length - 1 ? entries[index + 1]?.msgstr : undefined,
      }));

      log.info('[精翻] 开始精翻', { 
        count: requests.length,
        targetLanguage: targetLanguage 
      });

      // 调用精翻 API
      // 注意：后端会从配置管理器获取启用的AI配置
      const results = await translatorApi.contextualRefine(
        requests,
        targetLanguage
      );

      // 应用翻译结果
      results.forEach((translation, i) => {
        const { index } = selectedEntries[i];
        updateEntry(index, { 
          msgstr: translation,
          needsReview: true  // 精翻后仍需手动确认
        });
      });

      message.success(`精翻完成！共处理 ${results.length} 个条目`);
      log.info('[精翻] 完成', { count: results.length });

    } catch (error) {
      log.error('[精翻] 失败', { error });
      
      // 直接显示错误信息（后端已经处理成友好提示）
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      message.error({
        content: errorMessage,
        duration: 8,
      });
    } finally {
      setTranslating(false);
    }
  };

  // 拖拽调整宽度
  const handleMouseDown = () => {
    setIsResizing(true);
  };

  useEffect(() => {
    // 使用throttle优化拖拽性能，限制为60fps (16ms)
    const handleMouseMove = throttle((e: MouseEvent) => {
      if (!isResizing) return;
      
      const windowWidth = window.innerWidth;
      const newWidth = (e.clientX / windowWidth) * 100;
      
      // 限制最小宽度20%，最大宽度60%
      if (newWidth >= 20 && newWidth <= 60) {
        setLeftWidth(newWidth);
      }
    }, 16); // 60fps = 1000ms/60 ≈ 16ms

    const handleMouseUp = () => {
      setIsResizing(false);
      handleMouseMove.cancel(); // 取消待执行的throttle调用
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      handleMouseMove.cancel(); // 清理待执行的throttle
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
          onSaveAsFile={saveAsFile}
          onTranslateAll={translateAll}
          onSettings={handleSettings}
          onDevTools={handleDevTools}
          apiKey={apiKey}
          onApiKeyChange={setApiKey}
          isTranslating={isTranslating}
          hasEntries={entries.length > 0}
          isDarkMode={isDark}
          onThemeToggle={toggleTheme}
          sourceLanguage={sourceLanguage}
          targetLanguage={targetLanguage}
          onTargetLanguageChange={handleTargetLanguageChange}
        />
        
        {/* 配置同步警告 */}
        {configSyncIssues.length > 0 && (
          <Alert
            message="配置同步警告"
            description={
              <Space direction="vertical" size="small" style={{ width: '100%' }}>
                <div>检测到前后端配置不一致：</div>
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  {configSyncIssues.map((issue, index) => (
                    <li key={index}>{issue}</li>
                  ))}
                </ul>
              </Space>
            }
            type="warning"
            showIcon
            closable
            onClose={() => setConfigSyncIssues([])}
            action={
              <Button 
                size="small" 
                type="primary"
                onClick={async () => {
                  if (configSyncRef.current) {
                    await configSyncRef.current.syncFromBackend();
                    setConfigSyncIssues([]);
                    message.success('配置已重新同步');
                  }
                }}
              >
                重新同步
              </Button>
            }
            style={{ margin: '8px 16px', borderRadius: 4 }}
          />
        )}
      
      <Layout style={{ height: configSyncIssues.length > 0 ? 'calc(100vh - 128px)' : 'calc(100vh - 48px)', width: '100%', position: 'relative' }}>
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
          <ErrorBoundary fallback={
            <div style={{ padding: '20px', textAlign: 'center' }}>
              <Alert 
                message="条目列表加载失败" 
                description="请尝试重新打开文件"
                type="error" 
                showIcon 
              />
            </div>
          }>
            <EntryList
              entries={entries}
              currentEntry={currentEntry}
              isTranslating={isTranslating}
              progress={progress}
              onEntrySelect={setCurrentEntry}
              onTranslateSelected={handleTranslateSelected}
              onContextualRefine={handleContextualRefine} /* Phase 7: 精翻 */
            />
          </ErrorBoundary>
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
          <ErrorBoundary fallback={
            <div style={{ padding: '20px', textAlign: 'center' }}>
              <Alert 
                message="编辑器加载失败" 
                description="请尝试选择其他条目"
                type="error" 
                showIcon 
              />
            </div>
          }>
            <EditorPane
              entry={currentEntry}
              onEntryUpdate={updateEntry}
              aiTranslation={currentIndex >= 0 ? aiTranslations.get(currentIndex) : undefined}
              apiKey={apiKey}
            />
          </ErrorBoundary>
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
          <ErrorBoundary fallback={
            <div style={{ padding: '20px', textAlign: 'center' }}>
              <Alert 
                message="AI工作区加载失败" 
                description="部分功能可能无法使用"
                type="warning" 
                showIcon 
              />
            </div>
          }>
            <AIWorkspace 
              stats={translationStats} 
              isTranslating={isTranslating}
              onResetStats={handleResetStats}
              apiKey={apiKey}
            />
          </ErrorBoundary>
        </Sider>
      </Layout>

      <ErrorBoundary>
        <SettingsModal
          visible={settingsVisible}
          onClose={() => setSettingsVisible(false)}
        />
      </ErrorBoundary>

      <ErrorBoundary>
        <DevToolsModal
          visible={devToolsVisible}
          onClose={() => setDevToolsVisible(false)}
        />
      </ErrorBoundary>
    </Layout>
    </div>
    </ConfigProvider>
  );
}

export default App;
