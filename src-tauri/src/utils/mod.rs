pub mod common;
pub mod logger;
pub mod paths;
pub mod path_validator;  // Tauri 2.x: 路径安全验证
pub mod progress_throttler;  // Phase 8: 性能优化
pub mod logging;  // Phase 9: 工程化日志系统
pub mod i18n;  // Phase 9: 后端国际化
pub mod init;  // Phase 9: 应用初始化
pub mod draft;  // Phase 9: Draft 配置管理模式
