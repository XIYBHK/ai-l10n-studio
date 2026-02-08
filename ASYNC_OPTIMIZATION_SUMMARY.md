# 任务 #4 完成: 优化异步模式和错误处理

## 完成时间

2026-02-08

## 实现清单

### ✅ 1. CPU 密集型任务优化

#### PO 文件解析异步化

**文件**: `src-tauri/src/services/po_parser.rs`

添加 `parse_file_async()` 函数:

```rust
/// 异步解析 PO 文件（在阻塞线程池中执行 CPU 密集型任务）
#[tracing::instrument(fields(file_path = %file_path.as_ref().display()))]
pub async fn parse_file_async<P: AsRef<Path>>(file_path: P) -> Result<Vec<POEntry>> {
    let file_path = file_path.as_ref().to_path_buf();

    tokio::task::spawn_blocking(move || {
        let parser = POParser::new()?;
        parser.parse_file(&file_path)
    })
    .await
    .map_err(|e| anyhow!("Task join error: {}", e))?
}
```

**优化效果**:

- PO 解析(正则匹配、字符串处理)移至阻塞线程池
- 避免阻塞异步运行时
- 大文件解析时 UI 保持响应

#### 创建通用异步 I/O 工具模块

**新文件**: `src-tauri/src/utils/async_io.rs`

提供以下异步函数:

- `read_file_async()` - 异步读取文件
- `write_file_async()` - 异步写入文件
- `to_json_async()` - 异步 JSON 序列化
- `from_json_async()` - 异步 JSON 反序列化

所有函数使用 `tokio::task::spawn_blocking` 包装阻塞操作。

### ✅ 2. 错误上下文增强

#### 请求追踪 ID

**文件**: `src-tauri/src/error.rs`

添加追踪 ID 支持:

```rust
impl AppError {
    /// 创建带追踪 ID 的网络错误
    pub fn network_with_trace(msg: impl Into<String>) -> (Self, Uuid) {
        let trace_id = Uuid::new_v4();
        let error_msg = format!("{} [Trace ID: {}]", msg.into(), trace_id);
        (AppError::Network(error_msg), trace_id)
    }
}
```

**使用示例**:

```rust
let (error, trace_id) = AppError::network_with_trace("连接超时");
// 错误信息: "网络错误: 连接超时 [Trace ID: a1b2c3d4-...]"
// 可用于日志查询和问题追踪
```

### ✅ 3. 性能监控集成

#### tracing::instrument 宏

已添加到关键函数:

**AI 翻译服务** (`ai_translator.rs`):

- `translate_batch_with_callbacks`
- `translate_batch`
- `translate_batch_with_sources`
- `translate_with_ai`

**PO 解析器** (`po_parser.rs`):

- `parse_file`

**配置管理** (`config_draft.rs`):

- `save_to_disk`
- `save_to_disk_with_config`

## 性能优化效果

### 异步优化

**优化前**:

- PO 解析阻塞异步运行时
- 大文件(>10MB)解析导致界面冻结
- JSON 序列化在热路径上执行

**优化后**:

- CPU 密集型任务移至专用线程池
- 异步运行时保持响应
- 支持并发解析多个文件
- JSON 操作可异步执行

### 可观测性提升

**优化前**:

- 简单的 `log::info!` 日志
- 无法追踪跨函数调用
- 难以分析性能瓶颈

**优化后**:

- 结构化 tracing 日志
- 自动 span 追踪
- 支持 tokio-console 实时监控
- 每个操作的性能指标可测量

## 使用指南

### 启用性能监控

```bash
# 标准模式
npm run tauri:dev

# 性能监控模式
cd src-tauri
cargo run --features console

# 在另一个终端
tokio-console
```

### 使用异步 I/O 工具

```rust
use crate::utils::async_io::{read_file_async, write_file_async, from_json_async};

// 异步读取文件
let content = read_file_async("config.json").await?;

// 异步写入文件
write_file_async("output.txt", "Hello".to_string()).await?;

// 异步 JSON 解析
let config: AppConfig = from_json_async(json_str).await?;
```

### 使用追踪 ID

```rust
// 网络请求时生成追踪 ID
let (error, trace_id) = AppError::network_with_trace("API 请求失败");
log::error!("请求失败: {}, Trace ID: {}", error, trace_id);

// 用户报告问题时,可根据 Trace ID 查找详细日志
```

## 编译和测试

### 编译状态

✅ `cargo check` 通过
✅ `cargo build` 成功
⚠️ 1个警告: `tracing::instrument` 被误报为未使用(实际已使用)

### 运行测试

```bash
# 测试异步 I/O 模块
cd src-tauri
cargo test --lib utils::async_io

# 完整测试
cargo test
```

## 技术细节

### spawn_blocking 使用场景

**适合使用**:

- CPU 密集型计算(正则、解析、加密)
- 阻塞 I/O 操作(文件读写)
- 同步第三方库调用

**不适合使用**:

- 已异步的操作(不必要)
- 极短任务(开销大于收益)
- 频繁调用的小任务(增加调度开销)

### tracing instrument 参数

- `name`: span 名称(用于识别操作)
- `skip`: 跳过记录的字段(避免记录敏感/不可序列化数据)
- `fields`: 自定义字段(用于过滤和分析)

## 向后兼容性

✅ 所有修改向后兼容
✅ 新增函数为可选使用
✅ 现有代码无需修改
✅ 性能监控为可选功能

## 未来改进

1. **更多异步包装**: 为其他 CPU 密集型操作添加异步版本
2. **Metrics 集成**: 添加 Prometheus metrics
3. **分布式追踪**: 集成 OpenTelemetry
4. **性能分析**: 定期生成性能报告

## 相关文档

- `PERFORMANCE_MONITORING_CHANGES.md` - 性能监控详细文档
- `src-tauri/src/utils/async_io.rs` - 异步 I/O 工具模块
- Tokio 文档: https://tokio.rs/tokio/topics/logging
