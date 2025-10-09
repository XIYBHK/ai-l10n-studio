# PO Translator GUI - API 参考手册 v2.0

**版本**: Phase 8 (已优化)  
**更新日期**: 2025-10-08  
**命令总数**: 41 个（新增 Channel 批量翻译）

---

## 🎯 快速导航

- [架构](#架构)
- [前端 API (13 模块)](#前端-api)
- [Tauri 命令 (40 个)](#tauri-命令)
- [事件系统](#事件系统)
- [状态管理](#状态管理)

---

## 架构

```
前端 (React + TypeScript)
    ↓ 13 个 API 模块
Tauri Bridge
    ↓ 40 个命令
后端 (Rust)
```

---

## 前端 API

### 1. 术语库 (`termLibraryApi`)
```typescript
termLibraryApi.get()                    // 获取术语库
termLibraryApi.addTerm({...})          // 添加术语
termLibraryApi.removeTerm(source)      // 删除术语
termLibraryApi.generateStyleSummary()  // 生成风格总结
termLibraryApi.shouldUpdateStyleSummary() // 检查更新
```

### 2. 翻译记忆 (`translationMemoryApi`)
```typescript
translationMemoryApi.get()             // 获取TM
translationMemoryApi.getBuiltinPhrases() // 内置短语
translationMemoryApi.save(memory)      // 保存TM
```

### 3. PO 文件 (`poFileApi`)
```typescript
poFileApi.parse(filePath)              // 解析PO
poFileApi.save(filePath, entries)      // 保存PO
```

### 4. 配置 (`configApi`)
```typescript
configApi.get()                        // 获取配置
configApi.update(config)               // 更新配置
configApi.validate(config)             // 验证配置
configApi.getAppConfig()               // 获取应用配置
configApi.updateAppConfig(config)      // 更新应用配置
configApi.getVersion()                 // 获取版本
```

### 5. 对话框 (`dialogApi`)
```typescript
dialogApi.openFile()                   // 打开文件
dialogApi.saveFile()                   // 保存文件
```

### 6. 日志 (`logApi`)
```typescript
logApi.get()                           // 获取日志
logApi.clear()                         // 清空日志
```

### 7. 提示词日志 (`promptLogApi`)
```typescript
promptLogApi.get()                     // 获取提示词日志
promptLogApi.clear()                   // 清空提示词日志
```

### 8. 翻译器 (`translatorApi`)
```typescript
translatorApi.translateEntry(msgid)    // 单条翻译
translatorApi.translateBatch(texts)    // 批量翻译（带统计）
translatorApi.translateDirectory(dir)  // 翻译目录
translatorApi.contextualRefine([...])  // 精翻
// New in v2: 高性能 Channel API（推荐用 Hook 调用）
translatorApi.translateBatchWithChannel(texts, targetLanguage, progressChannel, statsChannel)
```

### 9. AI 配置 (`aiConfigApi`)
```typescript
aiConfigApi.getAll()                   // 获取所有配置
aiConfigApi.getActive()                // 获取启用配置
aiConfigApi.add(config)                // 添加配置
aiConfigApi.update(index, config)      // 更新配置
aiConfigApi.remove(index)              // 删除配置
aiConfigApi.setActive(index)           // 设为启用
aiConfigApi.testConnection({...})      // 测试连接
```

### 10. 文件格式 (`fileFormatApi`)
```typescript
fileFormatApi.detect(filePath)         // 检测格式
fileFormatApi.getMetadata(filePath)    // 获取元数据
```

### 11. 系统提示词 (`systemPromptApi`)
```typescript
systemPromptApi.get()                  // 获取提示词
systemPromptApi.update(prompt)         // 更新提示词
systemPromptApi.reset()                // 重置提示词
```

### 12. 语言 (`languageApi`)
```typescript
languageApi.detectText(text)           // 检测语言
languageApi.getDefaultTarget(source)   // 默认目标语言
languageApi.getSupportedLanguages()    // 支持的语言
```

### 13. 系统 (`systemApi`)
```typescript
systemApi.getLanguage()                // 获取系统语言
```

---

## Tauri 命令

### PO 文件 (4)
```
parse_po_file              解析PO文件
save_po_file               保存PO文件
open_file_dialog           打开对话框
save_file_dialog           保存对话框
```

### 翻译 (5)
```
translate_entry            单条翻译
translate_batch            批量翻译（已合并，含统计）
translate_batch_with_channel 高性能批量翻译（Channel）
translate_directory        翻译目录
contextual_refine          精翻
```

### 翻译记忆 (3)
```
get_translation_memory     获取TM
get_builtin_phrases        内置短语
save_translation_memory    保存TM
```

### 术语库 (5)
```
get_term_library           获取术语库
add_term_to_library        添加术语
remove_term_from_library   删除术语
generate_style_summary     生成风格
should_update_style_summary 检查更新
```

### AI 配置 (7)
```
get_all_ai_configs         所有配置
get_active_ai_config       启用配置
add_ai_config              添加配置
update_ai_config           更新配置
remove_ai_config           删除配置
set_active_ai_config       设为启用
test_ai_connection         测试连接
```

### 应用配置 (4)
```
get_app_config             获取应用配置（已优化）
update_app_config          更新应用配置
validate_config            验证配置
get_config_version         配置版本
```

### 系统提示词 (3)
```
get_system_prompt          获取提示词
update_system_prompt       更新提示词
reset_system_prompt        重置提示词
```

### 日志 (4)
```
get_app_logs               应用日志
clear_app_logs             清空日志
get_prompt_logs            提示词日志
clear_prompt_logs          清空提示词日志
```

### 文件格式 (2)
```
detect_file_format         检测格式
get_file_metadata          文件元数据
```

### 语言 (4)
```
detect_text_language       检测语言
get_default_target_lang    默认目标语言
get_supported_langs        支持的语言
get_system_language        系统语言
```

**总计**: 40 个命令

---

## 事件系统

### 翻译事件
```typescript
'translation:before'       // 翻译前
'translation:progress'     // 进度
'translation:stats'        // 统计
'translation:after'        // 翻译后
'translation:error'        // 错误
// 新增（Channel）
'channel:progress'         // Channel 进度（Hook 内部使用）
'channel:stats'            // Channel 统计（Hook 内部使用）
```

### 术语库事件
```typescript
'term:added'               // 添加
'term:removed'             // 删除
'term:updated'             // 更新
'term:style-updated'       // 风格更新
```

### 文件事件
```typescript
'file:loaded'              // 加载
'file:saved'               // 保存
'file:error'               // 错误
```

### 记忆库事件
```typescript
'memory:updated'           // 更新
'memory:cleared'           // 清空
'memory:loaded'            // 加载
```

### UI 事件
```typescript
'ui:entry-selected'        // 选中
'ui:entry-updated'         // 更新
```

### 配置事件
```typescript
'config:updated'           // 更新
'config:synced'            // 同步
'config:out-of-sync'       // 不一致
```

### 精翻事件（已优化命名）
```typescript
'refine:start'             // 开始（原 contextual-refine:start）
'refine:progress'          // 进度
'refine:complete'          // 完成（原 contextual-refine:complete）
'refine:error'             // 错误（原 contextual-refine:error）
```

---

## 状态管理

### Session Store（瞬态）
```typescript
entries          // 条目
currentEntry     // 当前条目
isTranslating    // 翻译中
progress         // 进度
```

### Settings Store（持久化）
```typescript
theme            // 主题
language         // 语言
```

### Stats Store（持久化）
```typescript
cumulativeStats  // 累计统计
```

---

## ⚡ 优化记录

### v2.0 改进（2025-10-08）
- ✅ 删除冗余命令 `get_config`（使用 `get_app_config`）
- ✅ 删除未使用命令 `get_provider_configs`
- ✅ 合并翻译命令（`translate_batch` 统一返回统计）
- ✅ 统一事件命名（`refine:*` 替代 `contextual-refine:*`）
- ✅ 命令总数：52 → 40（-12）

### 收益
- 减少 50+ 行代码
- 统一命名规范
- 提升可维护性

---

## 🎯 最佳实践

### API 调用
```typescript
// ✅ 使用封装的 API
await translatorApi.translateBatch(texts);

// ❌ 避免直接 invoke
// await invoke('translate_batch', { texts });
```

### 事件订阅
```typescript
// ✅ 记得取消订阅
useEffect(() => {
  const unsub = eventDispatcher.on('translation:progress', handler);
  return () => unsub();
}, []);
```

### Store 使用
```typescript
// ✅ 使用分离的 stores
const { entries } = useSessionStore();
const { theme } = useSettingsStore();

// ❌ 避免旧 store（待废弃）
// const { entries, theme } = useAppStore();
```

---

**命令总数**: 40  
**API 模块**: 13  
**事件类型**: 20+  
**最后更新**: 2025-10-08

