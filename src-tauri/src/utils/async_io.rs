//! 异步 I/O 辅助工具
//!
//! 提供 CPU 密集型或阻塞 I/O 操作的异步包装器,
//! 使用 `tokio::task::spawn_blocking` 避免阻塞异步运行时。

use anyhow::{anyhow, Result};
use std::path::Path;

/// 异步读取文件内容到字符串
///
/// # 参数
///
/// - `file_path`: 文件路径
///
/// # 返回
///
/// 返回文件内容的字符串表示
///
/// # 示例
///
/// ```rust
/// use crate::utils::async_io::read_file_async;
///
/// let content = read_file_async("config.json").await?;
/// ```
pub async fn read_file_async<P: AsRef<Path>>(file_path: P) -> Result<String> {
    let file_path = file_path.as_ref().to_path_buf();

    tokio::task::spawn_blocking(move || {
        std::fs::read_to_string(&file_path).map_err(Into::into)
    })
    .await
    .map_err(|e| anyhow!("Task join error: {}", e))?
}

/// 异步写入字符串到文件
///
/// # 参数
///
/// - `file_path`: 文件路径
/// - `content`: 要写入的内容
///
/// # 示例
///
/// ```rust
/// use crate::utils::async_io::write_file_async;
///
/// write_file_async("output.txt", "Hello, world!").await?;
/// ```
pub async fn write_file_async<P: AsRef<Path>>(
    file_path: P,
    content: String,
) -> Result<()> {
    let file_path = file_path.as_ref().to_path_buf();

    tokio::task::spawn_blocking(move || {
        std::fs::write(&file_path, content).map_err(Into::into)
    })
    .await
    .map_err(|e| anyhow!("Task join error: {}", e))?
}

/// 异步 JSON 序列化
///
/// # 参数
///
/// - `value`: 要序列化的值
///
/// # 返回
///
/// 返回 JSON 字符串
///
/// # 示例
///
/// ```rust
/// use crate::utils::async_io::to_json_async;
/// use serde::Serialize;
///
/// #[derive(Serialize)]
/// struct Data {
///     field: String,
/// }
///
/// let json = to_json_async(&Data { field: "value".to_string() }).await?;
/// ```
pub async fn to_json_async<T: serde::Serialize + Send + 'static>(value: T) -> Result<String> {
    tokio::task::spawn_blocking(move || {
        serde_json::to_string(&value).map_err(Into::into)
    })
    .await
    .map_err(|e| anyhow!("Task join error: {}", e))?
}

/// 异步 JSON 反序列化
///
/// # 参数
///
/// - `json_str`: JSON 字符串
///
/// # 返回
///
/// 返回反序列化的值
///
/// # 示例
///
/// ```rust
/// use crate::utils::async_io::from_json_async;
/// use serde::Deserialize;
///
/// #[derive(Deserialize)]
/// struct Data {
///     field: String,
/// }
///
/// let data: Data = from_json_async(r#"{"field":"value"}"#).await?;
/// ```
pub async fn from_json_async<T: for<'de> serde::Deserialize<'de> + Send + 'static>(
    json_str: &str,
) -> Result<T> {
    let json_str = json_str.to_owned();

    tokio::task::spawn_blocking(move || {
        serde_json::from_str::<T>(&json_str).map_err(Into::into)
    })
    .await
    .map_err(|e| anyhow!("Task join error: {}", e))?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_read_file_async() {
        let temp_file = "test_temp_async.txt";
        std::fs::write(temp_file, "test content").unwrap();

        let content = read_file_async(temp_file).await.unwrap();
        assert_eq!(content, "test content");

        std::fs::remove_file(temp_file).ok();
    }

    #[tokio::test]
    async fn test_write_file_async() {
        let temp_file = "test_temp_write_async.txt";

        write_file_async(temp_file, "async write".to_string())
            .await
            .unwrap();

        let content = std::fs::read_to_string(temp_file).unwrap();
        assert_eq!(content, "async write");

        std::fs::remove_file(temp_file).ok();
    }

    #[tokio::test]
    async fn test_to_json_async() {
        #[derive(serde::Serialize)]
        struct Test {
            value: String,
        }

        let test = Test {
            value: "test".to_string(),
        };

        let json = to_json_async(test).await.unwrap();
        assert_eq!(json, r#"{"value":"test"}"#);
    }

    #[tokio::test]
    async fn test_from_json_async() {
        #[derive(serde::Deserialize, PartialEq, Debug)]
        struct Test {
            value: String,
        }

        let json = r#"{"value":"test"}"#;
        let test: Test = from_json_async(json).await.unwrap();

        assert_eq!(test, Test { value: "test".to_string() });
    }
}
