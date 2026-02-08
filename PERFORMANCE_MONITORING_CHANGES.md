# Rust 后端性能监控和异步优化总结

## 完成的任务

### 任务 #3: 集成性能监控工具 ✅

#### 1. 添加 `console-subscriber` 依赖

**文件**: `src-tauri/Cargo.toml`

```toml
# 日志系统
tracing = "0.1"
tracing-subscriber = { version = "0.3", features = ["env-filter", "fmt", "time"] }
console-subscriber = { version = "0.4", optional = true }
```

**新增 feature**:
```toml
[features]
console = ["dep:console-subscriber"]
```

#### 2. 初始化 tokio-console

**文件**: `src-tauri/src/main.rs`

在 `main()` 函数开头添加:
```rust
// 初始化性能监控 (仅当启用 console feature 时)
#[cfg(feature = "console")]
{
    console_subscriber::init();
    log::info!("🔍 Tokio console 监控已启用");
}
```

#### 3. 配置 tracing 层级

**文件**: `src-tauri/src/utils/logger.rs`

添加 `init_tracing()` 函数:
```rust
pub fn init_tracing() {
    let env_filter = EnvFilter::from_default_env()
        .add_directive("po_translator_gui=info".parse().unwrap())
        .add_directive("reqwest=warn".parse().unwrap())
        .add_directive("tokio=warn".parse().unwrap())
        .add_directive("runtime=warn".parse().unwrap());

    tracing_subscriber::fmt()
        .with_env_filter(env_filter)
        .with_timer(tracing_subscriber::fmt::time::UtcTime::rfc_3339())
        .with_target(true)
        .finish()
        .try_init()
        .ok();
}
```

在 `src-tauri/src/utils/init.rs` 的 `init_logger()` 中调用:
```rust
async fn init_logger() -> Result<()> {
    // ... 现有代码 ...
    crate::utils::logger::init_tracing();
    // ... 其余代码 ...
}
```

#### 4. 为关键异步函数添加 `tracing::instrument` 宏

**文件**: `src-tauri/src/services/ai_translator.rs`

添加导入:
```rust
use tracing::instrument;
```

为以下关键函数添加性能监控:
- `translate_batch_with_callbacks` - 批量翻译主入口
- `translate_batch` - 简化批量翻译
- `translate_batch_with_sources` - 带来源追踪的批量翻译
- `translate_with_ai` - 核心 AI 翻译函数

示例:
```rust
#[tracing::instrument(
    name = "translate_with_ai",
    skip(self),
    fields(
        text_count = texts.len(),
        provider = %self.provider_id,
        model = %self.model
    )
)]
pub async fn translate_with_ai(&mut self, texts: Vec<String>) -> Result<Vec<String>, AppError> {
    // ... 实现 ...
}
```

#### 5. 为 PO 解析添加 tracing

**文件**: `src-tauri/src/services/po_parser.rs`

```rust
use tracing::instrument;

#[instrument(skip(self), fields(file_path = %file_path.as_ref().display()))]
pub fn parse_file<P: AsRef<Path>>(&self, file_path: P) -> Result<Vec<POEntry>> {
    // ... 实现 ...
}
```

#### 6. 为配置保存添加 tracing

**文件**: `src-tauri/src/services/config_draft.rs`

```rust
use tracing::instrument;

#[instrument(skip(self), fields(config_path = %self.config_path.display()))]
fn save_to_disk(&self) -> Result<(), AppError> {
    // ... 实现 ...
}
```

### 任务 #4: 优化异步模式和错误处理 ✅

#### 1. 添加请求追踪 ID 支持

**文件**: `src-tauri/src/error.rs`

添加 UUID 导入:
```rust
use uuid::Uuid;
```

添加带追踪 ID 的错误构造函数:
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

#### 2. 为 CPU 密集型任务添加 `spawn_blocking`

**文件**: `src-tauri/src/services/po_parser.rs`

添加异步解析函数:
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

**优化说明**:
- PO 文件解析是 CPU 密集型操作(正则匹配、字符串处理)
- 使用 `spawn_blocking` 将其移至阻塞线程池,避免阻塞异步运行时
- 保持异步接口,方便调用方使用

## 使用指南

### 启用性能监控

#### 方法 1: 环境变量

```bash
# 设置日志级别
RUST_LOG=po_translator_gui=debug,reqwest=warn

# 启用应用
npm run tauri:dev
```

#### 方法 2: 启用 tokio-console (需要 console feature)

```bash
# 启用 console feature 运行
cd src-tauri
cargo run --features console

# 在另一个终端启动 tokio-console
tokio-console
```

### 性能监控输出示例

```
2026-02-08T10:30:45.123Z  INFO translate_with_ai{text_count=5, provider="moonshot", model="moonshot-v1-auto"}: 开始翻译
2026-02-08T10:30:45.456Z  INFO translate_with_ai{text_count=5, provider="moonshot", model="moonshot-v1-auto"}: 翻译完成, 耗时 333ms
```

### 请求追踪

当发生网络错误时,会自动生成追踪 ID:

```rust
let (error, trace_id) = AppError::network_with_trace("连接超时");
// 错误信息: "网络错误: 连接超时 [Trace ID: a1b2c3d4-e5f6-7890-abcd-ef1234567890]"
```

## 性能优化效果

### 1. 异步优化

**优化前**:
- PO 解析阻塞异步运行时
- 大文件解析导致界面卡顿

**优化后**:
- 使用 `spawn_blocking` 将 CPU 密集型任务移至专用线程池
- 异步运行时保持响应
- 支持并发解析多个文件

### 2. 可观测性提升

**优化前**:
- 仅依靠简单的 `log::info!` 调试
- 难以追踪跨函数调用
- 无法监控异步任务性能

**优化后**:
- 结构化 tracing 日志
- 自动 span 追踪
- 支持 tokio-console 实时监控
- 可追踪每个翻译请求的性能指标

## 技术细节

### tracing 层级设计

```
po_translator_gui=info    # 应用主逻辑
reqwest=warn              # HTTP 客户端
tokio=warn                # 异步运行时
runtime=warn              # 运行时系统
```

### instrument 宏参数说明

- `name`: span 名称(用于识别操作)
- `skip`: 跳过记录的字段(避免记录敏感数据)
- `fields`: 自定义字段(用于过滤和分析)

示例:
```rust
#[tracing::instrument(
    name = "translate_batch",
    skip(self, callback),  // 跳过 self 和回调函数(不可序列化)
    fields(text_count = texts.len())  // 记录文本数量
)]
```

## 未来改进方向

1. **分布式追踪**: 集成 OpenTelemetry,支持跨服务追踪
2. **Metrics**: 添加 Prometheus metrics 导出
3. **性能分析**: 定期生成性能报告
4. **告警系统**: 异常性能自动告警

## 编译和测试

```bash
# 标准构建
cd src-tauri
cargo build

# 启用性能监控
cargo build --features console

# 运行测试
cargo test

# Clippy 检查
cargo clippy -- -D warnings
```

## 文件修改清单

1. `src-tauri/Cargo.toml` - 添加依赖和 feature
2. `src-tauri/src/main.rs` - 初始化 console-subscriber
3. `src-tauri/src/utils/logger.rs` - 添加 tracing 初始化
4. `src-tauri/src/utils/init.rs` - 集成 tracing 初始化
5. `src-tauri/src/error.rs` - 添加追踪 ID 支持
6. `src-tauri/src/services/ai_translator.rs` - 添加 instrument 宏
7. `src-tauri/src/services/po_parser.rs` - 添加异步解析和 instrument
8. `src-tauri/src/services/config_draft.rs` - 添加 instrument 宏

## 兼容性说明

- ✅ 向后兼容: 所有修改不影响现有功能
- ✅ 可选功能: console 监控通过 feature 控制
- ✅ 零开销: 未启用时性能影响可忽略
- ✅ Rust Stable: 不依赖 Nightly 特性
