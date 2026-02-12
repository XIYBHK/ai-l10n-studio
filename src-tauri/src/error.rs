/**
 * 统一应用错误类型
 *
 * 设计目标：
 * 1. 集中管理所有错误类型
 * 2. 提供清晰的错误分类
 * 3. 自动转换常见错误（通过 From trait）
 * 4. 友好的中文错误信息
 * 5. 支持请求追踪 ID（用于性能监控）
 */
use thiserror::Error;
use uuid::Uuid;

/// 统一应用错误类型
#[derive(Error, Debug)]
pub enum AppError {
    /// 配置错误（配置文件、参数验证等）
    #[error("配置错误: {0}")]
    Config(String),

    /// 翻译错误（AI 翻译相关）
    #[error("翻译错误: {msg}")]
    Translation { msg: String, retryable: bool },

    /// IO 错误（文件读写、目录操作等）
    #[error("IO 错误: {0}")]
    Io(#[from] std::io::Error),

    /// 网络错误（HTTP 请求、API 调用等）
    #[error("网络错误: {0}")]
    Network(String),

    /// 序列化错误（JSON 解析、序列化等）
    #[error("序列化错误: {0}")]
    Serde(#[from] serde_json::Error),

    /// 代理配置错误
    #[error("代理配置错误: {0}")]
    Proxy(String),

    /// 解析错误（PO 文件、配置文件等）
    #[error("解析错误: {0}")]
    Parse(String),

    /// 插件错误（AI 插件加载、执行等）
    #[error("插件错误: {0}")]
    Plugin(String),

    /// 验证错误（输入验证、参数检查等）
    #[error("验证错误: {0}")]
    Validation(String),

    /// 通用错误（catch-all）
    #[error("错误: {0}")]
    Generic(String),
}

// ========================================
// From trait 实现（自动转换）
// ========================================

impl From<anyhow::Error> for AppError {
    fn from(err: anyhow::Error) -> Self {
        AppError::Generic(err.to_string())
    }
}

impl From<reqwest::Error> for AppError {
    fn from(err: reqwest::Error) -> Self {
        // 判断是否是请求超时（可重试）
        let is_timeout = err.is_timeout();
        let is_connect = err.is_connect();

        if is_timeout || is_connect {
            AppError::Network(format!("网络连接失败: {}", err))
        } else if err.is_request() {
            AppError::Network(format!("请求失败: {}", err))
        } else {
            AppError::Network(format!("网络错误: {}", err))
        }
    }
}

// ========================================
// 辅助构造函数
// ========================================

impl AppError {
    /// 创建配置错误
    pub fn config(msg: impl Into<String>) -> Self {
        AppError::Config(msg.into())
    }

    /// 创建翻译错误
    pub fn translation(msg: impl Into<String>, retryable: bool) -> Self {
        AppError::Translation {
            msg: msg.into(),
            retryable,
        }
    }

    /// 创建带追踪 ID 的网络错误
    pub fn network_with_trace(msg: impl Into<String>) -> (Self, Uuid) {
        let trace_id = Uuid::new_v4();
        let error_msg = format!("{} [Trace ID: {}]", msg.into(), trace_id);
        (AppError::Network(error_msg), trace_id)
    }

    /// 创建网络错误
    pub fn network(msg: impl Into<String>) -> Self {
        AppError::Network(msg.into())
    }

    /// 创建代理错误
    pub fn proxy(msg: impl Into<String>) -> Self {
        AppError::Proxy(msg.into())
    }

    /// 创建解析错误
    pub fn parse(msg: impl Into<String>) -> Self {
        AppError::Parse(msg.into())
    }

    /// 创建插件错误
    pub fn plugin(msg: impl Into<String>) -> Self {
        AppError::Plugin(msg.into())
    }

    /// 创建验证错误
    pub fn validation(msg: impl Into<String>) -> Self {
        AppError::Validation(msg.into())
    }

    /// 创建通用错误
    pub fn generic(msg: impl Into<String>) -> Self {
        AppError::Generic(msg.into())
    }

    /// 检查错误是否可重试
    pub fn is_retryable(&self) -> bool {
        match self {
            AppError::Translation { retryable, .. } => *retryable,
            AppError::Network(_) => true, // 网络错误通常可重试
            _ => false,
        }
    }
}

// ========================================
// Tauri 命令兼容性
// ========================================

/// 将 AppError 转换为 String（用于 Tauri 命令返回）
impl From<AppError> for String {
    fn from(err: AppError) -> Self {
        err.to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_error_display() {
        let err = AppError::Config("配置文件不存在".to_string());
        assert_eq!(err.to_string(), "配置错误: 配置文件不存在");

        let err = AppError::translation("API 密钥无效", false);
        assert!(err.to_string().contains("翻译错误"));
        assert!(!err.is_retryable());
    }

    #[test]
    fn test_from_io_error() {
        let io_err = std::io::Error::new(std::io::ErrorKind::NotFound, "文件未找到");
        let app_err: AppError = io_err.into();
        assert!(matches!(app_err, AppError::Io(_)));
        assert!(app_err.to_string().contains("IO 错误"));
    }

    #[test]
    fn test_from_serde_error() {
        let json_str = "{invalid json}";
        let serde_err = serde_json::from_str::<serde_json::Value>(json_str).unwrap_err();
        let app_err: AppError = serde_err.into();
        assert!(matches!(app_err, AppError::Serde(_)));
        assert!(app_err.to_string().contains("序列化错误"));
    }

    #[test]
    fn test_error_constructors() {
        let err = AppError::network("连接超时");
        assert!(matches!(err, AppError::Network(_)));

        let err = AppError::proxy("无效的代理地址");
        assert!(matches!(err, AppError::Proxy(_)));

        let err = AppError::parse("PO 文件格式错误");
        assert!(matches!(err, AppError::Parse(_)));
    }

    #[test]
    fn test_retryable_check() {
        let err = AppError::translation("请求超时", true);
        assert!(err.is_retryable());

        let err = AppError::translation("API 密钥无效", false);
        assert!(!err.is_retryable());

        let err = AppError::network("连接失败");
        assert!(err.is_retryable());

        let err = AppError::Config("配置文件损坏".to_string());
        assert!(!err.is_retryable());
    }
}
