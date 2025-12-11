/**
 * AI L10N Studio 主应用
 * 简化架构，保持核心业务逻辑清晰
 */

import { useState, useEffect, useRef } from 'react';
import { Layout, ConfigProvider } from 'antd';
import { App as AntApp } from 'antd';
import { listen } from '@tauri-apps/api/event';
import { useTheme } from './hooks/useTheme';
import { useSessionStore, useStatsStore } from './store';
import { useAsync } from './hooks/useAsync';
import { useChannelTranslation } from './hooks/useChannelTranslation';
import { MenuBar } from './components/MenuBar';
import EntryList from './components/EntryList';
import EditorPane from './components/EditorPane';
import AIWorkspace from './components/AIWorkspace';
import { SettingsModal } from './components/SettingsModal';
import { DevToolsModal } from './components/DevToolsModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { FileInfoBar } from './components/FileInfoBar';
import { POEntry, TranslationStats } from './types/tauri';
import type { LanguageInfo } from './types/generated/LanguageInfo';
import {
  poFileCommands,
  dialogCommands,
  i18nCommands,
  translatorCommands,
} from './services/commands';
import { useAIConfigs } from './hooks/useConfig';
import { createModuleLogger } from './utils/logger';
import './i18n/config';
import './App.css';

const log = createModuleLogger('App');

export default function App() {
  const { message: msg } = AntApp.useApp();

  // Store 状态
  const {
    entries,
    currentEntry,
    currentFilePath,
    isTranslating,
    progress,
    setEntries,
    setCurrentEntry,
    setCurrentFilePath,
    updateEntry,
    setTranslating,
    setProgress,
    resetSessionStats,
    updateSessionStats,
  } = useSessionStore();

  // 统计状态
  const { updateCumulativeStats } = useStatsStore();

  // UI 状态
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [devToolsVisible, setDevToolsVisible] = useState(false);
  const [translationStats, setTranslationStats] = useState<TranslationStats | null>(null);
  const [leftWidth, setLeftWidth] = useState(35);
  const [sourceLanguage, setSourceLanguage] = useState<string>('');
  const [targetLanguage, setTargetLanguage] = useState<string>('zh-CN');

  // Hooks
  const themeData = useTheme();
  const { execute: parsePOFile } = useAsync(poFileCommands.parse);
  const channelTranslation = useChannelTranslation();
  const { active, loading: aiConfigLoading } = useAIConfigs();
  const hasCheckedAIConfig = useRef(false);

  // 🔧 启动时重置会话统计
  useEffect(() => {
    resetSessionStats();
    log.info('🔄 应用启动，会话统计已重置');
  }, []);

  // ✅ Tauri 2.0 最佳实践：直接使用 listen() 监听翻译完成事件
  useEffect(() => {
    let unlisten: (() => void) | null = null;

    const setupListener = async () => {
      // 监听翻译完成事件，更新统计
      unlisten = await listen<{ stats: TranslationStats }>('translation:after', (event) => {
        // 后端发送的是 { stats: TranslationStats } 结构
        const stats = event.payload.stats;
        log.info('📊 收到翻译统计', stats);
        
        // 更新会话统计（当前会话累计）
        updateSessionStats(stats);
        
        // 更新累计统计（跨会话持久化）
        updateCumulativeStats(stats);
      });
    };

    setupListener();

    return () => {
      if (unlisten) unlisten();
    };
  }, [updateSessionStats, updateCumulativeStats]);

  // 检查 AI 配置（等待加载完成后再判断）
  useEffect(() => {
    if (aiConfigLoading) return; // 等待加载完成
    if (!hasCheckedAIConfig.current && !active) {
      hasCheckedAIConfig.current = true;
      setSettingsVisible(true);
      log.info('未检测到AI配置，已自动打开设置窗口');
    }
    if (active) {
      hasCheckedAIConfig.current = true;
    }
  }, [active, aiConfigLoading]);

  // 全局快捷键
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'o') {
        event.preventDefault();
        openFile();
      } else if ((event.ctrlKey || event.metaKey) && event.key === 's') {
        event.preventDefault();
        saveFile();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentFilePath, entries]);

  // 文件拖放监听
  useEffect(() => {
    let unlistenFn: (() => void) | null = null;

    const setupListener = async () => {
      unlistenFn = await listen<string[]>('tauri://file-drop', async (event) => {
        const files = event.payload;
        if (files && files.length > 0) {
          const filePath = files[0];
          if (filePath.toLowerCase().endsWith('.po')) {
            try {
              const entries = (await parsePOFile(filePath)) as POEntry[];
              setEntries(entries);
              setCurrentFilePath(filePath);
              await detectAndSetLanguages(entries);
              log.info('通过拖放导入文件成功', { filePath });
            } catch (error) {
              log.logError(error, '解析拖放文件失败');
            }
          }
        }
      });
    };

    setupListener();
    return () => {
      if (unlistenFn) unlistenFn();
    };
  }, []);

  // 语言检测
  const detectAndSetLanguages = async (entries: POEntry[]) => {
    try {
      const sampleTexts = entries
        .filter((e) => e.msgid && e.msgid.trim())
        .slice(0, 5)
        .map((e) => e.msgid)
        .join(' ');

      if (sampleTexts) {
        const detectedLang = await i18nCommands.detectLanguage(sampleTexts);
        setSourceLanguage(detectedLang.display_name);
        const defaultTarget = await i18nCommands.getDefaultTargetLanguage(detectedLang.code);
        setTargetLanguage(defaultTarget.code);
        log.info('语言检测完成', {
          source: detectedLang.display_name,
          target: defaultTarget.display_name,
        });
      }
    } catch (error) {
      log.logError(error, '语言检测失败');
      setSourceLanguage('未知');
      setTargetLanguage('zh-CN');
    }
  };

  // 打开文件
  const openFile = async () => {
    try {
      const filePath = await dialogCommands.openFile();
      if (filePath) {
        const entries = (await parsePOFile(filePath)) as POEntry[];
        setEntries(entries);
        setCurrentFilePath(filePath);
        await detectAndSetLanguages(entries);
        log.info('文件加载成功', { filePath, entryCount: entries.length });
      }
    } catch (error) {
      log.logError(error, '打开文件失败');
      msg.error(`打开文件失败：${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  // 保存文件
  const saveFile = async () => {
    if (!currentFilePath) {
      msg.warning('没有打开的文件，请使用"另存为"');
      return;
    }
    try {
      await poFileCommands.save(currentFilePath, entries);
      msg.success('保存成功！');
      log.info('文件保存成功', { filePath: currentFilePath });
    } catch (error) {
      log.logError(error, '保存文件失败');
      msg.error(`保存失败：${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  // 另存为
  const saveAsFile = async () => {
    try {
      const filePath = await dialogCommands.saveFile();
      if (filePath) {
        await poFileCommands.save(filePath, entries);
        setCurrentFilePath(filePath);
        msg.success('保存成功！');
        log.info('文件另存为成功', { filePath });
      }
    } catch (error) {
      log.logError(error, '另存为失败');
      msg.error(`保存失败：${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  // 翻译所有未翻译条目
  const translateAll = async () => {
    if (isTranslating) {
      log.warn('翻译正在进行中，忽略重复请求');
      return;
    }
    if (!active) {
      setSettingsVisible(true);
      return;
    }

    const untranslatedEntries = entries.filter((entry) => entry.msgid && !entry.msgstr);
    if (untranslatedEntries.length === 0) {
      return;
    }

    log.info('准备批量翻译', { untranslatedCount: untranslatedEntries.length });
    await executeTranslation(untranslatedEntries);
  };

  // 统一的翻译处理函数
  const executeTranslation = async (entriesToTranslate: POEntry[]) => {
    if (!active) {
      msg.warning('请先设置并启用AI配置');
      setSettingsVisible(true);
      return false;
    }

    const texts = entriesToTranslate.map((e) => e.msgid);
    let completedCount = 0;

    try {
      setTranslating(true);
      setProgress(0);

      log.info('🚀 开始翻译', { count: texts.length });

      const result = await channelTranslation.translateBatch(texts, targetLanguage, {
        onProgress: (current, _total, percentage) => {
          setProgress(percentage);
          completedCount = current;
        },
        onStats: (stats) => {
          const convertedStats = {
            ...stats,
            token_stats: {
              total_tokens: stats.token_stats.total_tokens,
              prompt_tokens: stats.token_stats.prompt_tokens,
              completion_tokens: stats.token_stats.completion_tokens,
              input_tokens: stats.token_stats.prompt_tokens,
              output_tokens: stats.token_stats.completion_tokens,
              cost: stats.token_stats.cost,
            },
          } as TranslationStats;
          setTranslationStats(convertedStats);
        },
        onItem: (index, translation) => {
          const entry = entriesToTranslate[index];
          const entryIndex = entries.indexOf(entry);
          if (entryIndex >= 0) {
            updateEntry(entryIndex, {
              msgstr: translation,
              needsReview: true,
            });
          }
        },
      });

      // 设置翻译来源标识
      if (result.translation_sources && result.translation_sources.length > 0) {
        entriesToTranslate.forEach((entry, localIndex) => {
          const entryIndex = entries.indexOf(entry);
          if (entryIndex >= 0 && localIndex < result.translation_sources.length) {
            const source = result.translation_sources[localIndex] as 'tm' | 'dedup' | 'ai';
            updateEntry(entryIndex, { translationSource: source });
          }
        });
      }

      // 更新统计数据
      if (result.stats) {
        const finalStats: TranslationStats = {
          total: texts.length,
          tm_hits: result.stats.tm_hits || 0,
          deduplicated: result.stats.deduplicated || 0,
          ai_translated: result.stats.ai_translated || 0,
          token_stats: {
            input_tokens: result.stats.token_stats.input_tokens || 0,
            output_tokens: result.stats.token_stats.output_tokens || 0,
            total_tokens: result.stats.token_stats.total_tokens || 0,
            cost: result.stats.token_stats.cost || 0,
          },
          tm_learned: result.stats.tm_learned || 0,
        };

        // 更新会话统计和累计统计
        updateSessionStats(finalStats);
        updateCumulativeStats(finalStats);
        
        log.info('📊 统计已更新', finalStats);
      }

      log.info('✅ 翻译完成', { count: completedCount });
      return true;
    } catch (error) {
      log.logError(error, '翻译失败');
      const errorMessage = error instanceof Error ? error.message : String(error);
      msg.error({ content: errorMessage, duration: 8 });
      return false;
    } finally {
      setTranslating(false);
      setProgress(0);
    }
  };

  // 翻译选中的条目
  const handleTranslateSelected = async (indices: number[]) => {
    if (!active) {
      msg.warning('请先在设置中配置并启用 AI 服务！');
      setSettingsVisible(true);
      return;
    }

    const selectedEntries = indices
      .map((i) => entries[i])
      .filter((e) => e && e.msgid && !e.msgstr);

    if (selectedEntries.length === 0) {
      msg.info('选中的条目都已翻译');
      return;
    }

    await executeTranslation(selectedEntries);
  };

  // 精翻选中的条目
  const handleContextualRefine = async (indices: number[]) => {
    if (!active) {
      msg.warning('请先在设置中配置并启用 AI 服务！');
      setSettingsVisible(true);
      return;
    }

    const selectedEntries = indices
      .map((i) => ({ index: i, entry: entries[i] }))
      .filter(({ entry }) => entry && entry.msgid && entry.needsReview);

    if (selectedEntries.length === 0) {
      msg.info('选中的条目中没有待确认的项');
      return;
    }

    setTranslating(true);

    try {
      const requests = selectedEntries.map(({ index, entry }) => ({
        msgid: entry.msgid,
        msgctxt: entry.msgctxt || undefined,
        comment: entry.comments.join('\n') || undefined,
        previousEntry: index > 0 ? entries[index - 1]?.msgstr : undefined,
        nextEntry: index < entries.length - 1 ? entries[index + 1]?.msgstr : undefined,
      }));

      log.info('[精翻] 开始精翻', { count: requests.length });
      const results = await translatorCommands.contextualRefine(requests, targetLanguage);

      results.forEach((translation, i) => {
        const { index } = selectedEntries[i];
        updateEntry(index, {
          msgstr: translation,
          needsReview: true,
          translationSource: 'ai',
        });
      });

      log.info('[精翻] 完成', { count: results.length });
    } catch (error) {
      log.logError(error, '精翻失败');
      const errorMessage = error instanceof Error ? error.message : String(error);
      msg.error({ content: errorMessage, duration: 8 });
    } finally {
      setTranslating(false);
    }
  };

  // 处理条目选择
  const handleEntrySelect = (entry: POEntry) => {
    setCurrentEntry(entry);
  };

  // 处理条目更新
  const handleEntryUpdate = (index: number, updates: Partial<POEntry>) => {
    updateEntry(index, updates);
  };

  // 处理目标语言变更
  const handleTargetLanguageChange = (langCode: string, langInfo: LanguageInfo | undefined) => {
    setTargetLanguage(langCode);
    if (langInfo) {
      log.info('切换目标语言', { code: langInfo.code, name: langInfo.display_name });
    }
  };

  // 拖拽调整列宽
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null); // 左侧边栏 ref

  const handleMouseDown = () => setIsResizing(true);

  useEffect(() => {
    if (!isResizing) return;
    
    let animationFrameId: number;

    const handleMouseMove = (e: MouseEvent) => {
      // 使用 requestAnimationFrame 节流 DOM 操作
      cancelAnimationFrame(animationFrameId);
      animationFrameId = requestAnimationFrame(() => {
        const windowWidth = window.innerWidth;
        const newWidth = (e.clientX / windowWidth) * 100;
        
        if (newWidth >= 20 && newWidth <= 60) {
          // 直接操作 DOM，不触发 React 重渲染
          if (sidebarRef.current) {
             sidebarRef.current.style.width = `${newWidth}%`;
          }
        }
      });
    };

    const handleMouseUp = (e: MouseEvent) => {
      cancelAnimationFrame(animationFrameId);
      setIsResizing(false);
      
      // 拖拽结束，同步最终状态
      const windowWidth = window.innerWidth;
      const newWidth = (e.clientX / windowWidth) * 100;
      if (newWidth >= 20 && newWidth <= 60) {
        setLeftWidth(newWidth);
      }
      
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    return () => {
      cancelAnimationFrame(animationFrameId);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing]);

  return (
    <ErrorBoundary>
      <ConfigProvider
        theme={{
          ...themeData.themeConfig,
          algorithm: themeData.algorithm,
        }}
      >
        <AntApp>
          <div data-theme={themeData.isDark ? 'dark' : 'light'} style={{ height: '100vh' }}>
            <Layout style={{ height: '100%' }}>
              {/* 顶部菜单栏 */}
              <MenuBar
                onOpenFile={openFile}
                onSaveFile={saveFile}
                onSaveAsFile={saveAsFile}
                onTranslateAll={translateAll}
                onSettings={() => setSettingsVisible(true)}
                onDevTools={() => setDevToolsVisible(true)}
                isTranslating={isTranslating}
                hasEntries={entries.length > 0}
                isDarkMode={themeData.isDark}
                onThemeToggle={themeData.toggleTheme}
                sourceLanguage={sourceLanguage}
                targetLanguage={targetLanguage}
                onTargetLanguageChange={handleTargetLanguageChange}
              />

              {/* 主布局：三列 */}
              <Layout style={{ height: 'calc(100vh - 48px - 28px)', position: 'relative' }}>
                {/* 左侧：条目列表 */}
                <div
                  ref={sidebarRef}
                  style={{
                    width: `${leftWidth}%`,
                    height: '100%',
                    background: themeData.colors.bgPrimary,
                    borderRight: `1px solid ${themeData.colors.borderPrimary}`,
                    overflow: 'hidden',
                    position: 'relative',
                    minWidth: '300px',
                    transition: isResizing ? 'none' : 'width 0.1s ease', // 拖拽时禁用过渡动画
                  }}
                >
                  <EntryList
                    entries={entries}
                    currentEntry={currentEntry}
                    isTranslating={isTranslating}
                    progress={progress}
                    onEntrySelect={handleEntrySelect}
                    onTranslateSelected={handleTranslateSelected}
                    onContextualRefine={handleContextualRefine}
                  />
                  {/* 拖拽分隔条 */}
                  <div
                    onMouseDown={handleMouseDown}
                    style={{
                      position: 'absolute',
                      right: 0,
                      top: 0,
                      bottom: 0,
                      width: '5px',
                      cursor: 'col-resize',
                      background: isResizing ? themeData.colors.borderPrimary : 'transparent',
                      zIndex: 10,
                    }}
                    onMouseEnter={(e) => {
                      if (!isResizing) {
                        e.currentTarget.style.background = `${themeData.colors.borderPrimary}80`;
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isResizing) {
                        e.currentTarget.style.background = 'transparent';
                      }
                    }}
                  />
                </div>

                {/* 中间：编辑器 */}
                <Layout.Content
                  style={{
                    background: themeData.colors.bgPrimary,
                    overflow: 'hidden',
                    flex: 1,
                  }}
                >
                  <EditorPane
                    entry={currentEntry}
                    onEntryUpdate={handleEntryUpdate}
                  />
                </Layout.Content>

                {/* 右侧：AI 工作区 */}
                <Layout.Sider
                  width={320}
                  style={{
                    background: themeData.colors.bgPrimary,
                    borderLeft: `1px solid ${themeData.colors.borderPrimary}`,
                    overflow: 'auto',
                  }}
                  collapsible={false}
                >
                  <AIWorkspace
                    stats={translationStats}
                    isTranslating={isTranslating}
                    onResetStats={() => setTranslationStats(null)}
                  />
                </Layout.Sider>
              </Layout>

              {/* 设置窗口 */}
              <SettingsModal
                visible={settingsVisible}
                onClose={() => setSettingsVisible(false)}
              />

              {/* 开发工具窗口 */}
              <DevToolsModal
                visible={devToolsVisible}
                onClose={() => setDevToolsVisible(false)}
              />

              {/* 底部文件信息栏 */}
              <FileInfoBar filePath={currentFilePath} />
            </Layout>
          </div>
        </AntApp>
      </ConfigProvider>
    </ErrorBoundary>
  );
}
