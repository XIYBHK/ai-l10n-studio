# Changelog

## [Unreleased]

### Fixed
- 修复批量翻译后 Token 统计（输入/输出）显示为 0 的问题
- 修复 `useChannelTranslation` 返回类型与后端不一致的问题
- 修复记忆库保存时错误被忽略的问题

### Added
- 词条列表"待确认"和"已翻译"列增加"移除"按钮，可批量清空翻译
- 清空记忆库时同步重置累计统计中的 tm_learned

### Changed
- **UI/UX 重大升级**:
  - 重构主题系统 (`src/theme/config.ts`)，引入现代蓝色调色板和更细腻的深色模式。
  - 优化 `MenuBar`，采用品牌化标题、胶囊式语言选择器和更合理的按钮布局。
  - 重设计 `EntryList`，使用 DataGrid 风格，引入 Badge 状态指示，提升列表可读性。
  - 改进 `EditorPane`，采用沉浸式双栏布局，支持等宽字体编辑，优化上下文展示。
  - 统一 `AIWorkspace` 风格，去除卡片边框，优化统计数据排版。
  - 全局应用现代滚动条样式和 Inter 字体。

### Removed
- 移除了过时的内联样式和简单的状态文本指示。

