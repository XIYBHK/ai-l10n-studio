# 测试指南

## 📊 测试概览

**总测试数**: 49 个 ✅  
**新增测试** (AI 架构): 17 个  
**测试框架**: Rust 内置测试 + Vitest (前端)

---

## 🆕 新增测试（AI 架构）

### 1. 模型信息测试 (`ai/model_info.rs`) - 3个

```rust
#[test]
fn test_estimate_cost() {
    // 测试基本成本估算（无缓存）
    // 验证：1000 input + 500 output = $0.00045
}

#[test]
fn test_price_display() {
    // 测试价格显示格式
    // 验证："$0.15/M input · $0.60/M output"
}

#[test]
fn test_cache_savings_percentage() {
    // 测试缓存节省百分比计算
    // 验证：(0.15 - 0.075) / 0.15 * 100 = 50%
}
```

**覆盖内容**:
- ✅ 成本估算精度
- ✅ 价格展示格式
- ✅ 缓存节省计算

---

### 2. 成本计算器测试 (`ai/cost_calculator.rs`) - 4个

```rust
#[test]
fn test_calculate_openai_no_cache() {
    // 测试 OpenAI 协议（无缓存）
}

#[test]
fn test_calculate_openai_with_cache() {
    // 测试 OpenAI 协议（带缓存）
    // 验证缓存 token 从 input_tokens 中正确减去
}

#[test]
fn test_estimate_batch_cost() {
    // 测试批量翻译成本估算
    // 基于字符数 + 缓存命中率
}

#[test]
fn test_simple_calculation() {
    // 测试简化成本计算（向后兼容）
}
```

**覆盖内容**:
- ✅ OpenAI 协议成本计算
- ✅ 缓存 token 处理
- ✅ 批量估算算法
- ✅ 向后兼容性

---

### 3. 模型定义测试 (`ai/models/*`) - 4个

#### OpenAI (2个)
```rust
#[test]
fn test_get_openai_models() {
    // 验证模型列表完整性
    // 4个模型：gpt-4o, gpt-4o-mini, gpt-4-turbo, gpt-3.5-turbo
}

#[test]
fn test_cache_prices() {
    // 验证缓存价格配置
    // gpt-4o-mini: 50% 节省
}
```

#### Moonshot (1个)
```rust
#[test]
fn test_get_moonshot_models() {
    // 验证 4个模型：auto, 8k, 32k, 128k
}
```

#### DeepSeek (1个)
```rust
#[test]
fn test_get_deepseek_models() {
    // 验证 2个模型：chat, coder
}
```

**覆盖内容**:
- ✅ 模型定义完整性
- ✅ 价格配置正确性
- ✅ 推荐模型标记

---

### 4. Tauri 命令测试 (`commands/ai_model_commands.rs`) - 6个

```rust
#[test]
fn test_get_provider_models() {
    // 测试获取供应商所有模型
}

#[test]
fn test_get_model_info() {
    // 测试获取单个模型信息
}

#[test]
fn test_estimate_translation_cost() {
    // 测试成本估算命令
    // 验证 10000 字符成本 < $1
}

#[test]
fn test_calculate_precise_cost() {
    // 测试精确成本计算
    // 验证 CostBreakdown 各字段
}

#[test]
fn test_invalid_cache_hit_rate() {
    // 测试参数验证
    // 缓存命中率必须在 0.0-1.0
}

#[test]
fn test_nonexistent_model() {
    // 测试错误处理
    // 不存在的模型返回错误
}
```

**覆盖内容**:
- ✅ 命令功能正确性
- ✅ 参数验证
- ✅ 错误处理
- ✅ 前后端 API 契约

---

## 🧪 运行测试

### 基本命令

```bash
# 后端测试（Rust）
cd src-tauri
cargo test              # 运行所有测试
cargo test --lib        # 只运行库测试
cargo test ai::         # 只运行 AI 模块测试

# 前端测试（Vitest）
npm run test            # 运行所有前端测试
npm run test:ui         # UI 模式
npm run test:coverage   # 生成覆盖率报告
```

### 查看详细输出

```bash
cargo test -- --nocapture        # 显示 println! 输出
cargo test -- --test-threads=1   # 串行执行（调试用）
```

---

## ⚡ 使用 cargo-nextest 加速测试（已集成）

### 快速开始

**项目已完成 nextest 集成！** ✅

详细说明见：[`NEXTEST_SETUP.md`](../NEXTEST_SETUP.md)

### 使用方法

```bash
# 推荐：使用 npm 脚本
npm run test:backend          # 后端测试（nextest）
npm run test:backend:all      # 所有后端测试
npm run test:all              # 前端 + 后端

# 或直接使用 nextest
cd src-tauri
cargo nextest run --lib
```

### 性能对比

| 命令 | 时间 | 输出质量 |
|------|------|---------|
| `cargo test --lib` | 8.5s | 基础 |
| `cargo nextest run --lib` | **~5s** | ⭐ 彩色+进度条 |

**加速 40%！** 🚀

### 配置文件

已创建 `.config/nextest.toml`，包含：
- `default` - 开发环境（默认）
- `ci` - CI/CD（生成 JUnit 报告）
- `local` - 本地快速测试

---

## 🎯 测试覆盖率

### 当前覆盖情况

| 模块 | 测试数 | 覆盖率 |
|------|--------|--------|
| AI 架构 | 17 | ⭐ 100% |
| 文件格式 | 3 | ✅ 完整 |
| 语言检测 | 8 | ✅ 完整 |
| 其他模块 | 21 | ✅ 良好 |
| **总计** | **49** | **82.8%** |

### 生成覆盖率报告

```bash
# 安装 tarpaulin
cargo install cargo-tarpaulin

# 生成覆盖率（HTML 报告）
cargo tarpaulin --out Html --output-dir target/coverage

# 查看报告
open target/coverage/index.html
```

---

## 📋 测试清单

### AI 架构测试（本次新增）✅

- [x] ModelInfo 基础功能
- [x] CostCalculator 精确计算
- [x] OpenAI 协议支持
- [x] 缓存成本计算
- [x] 模型定义完整性（3个供应商）
- [x] Tauri 命令参数验证
- [x] 错误处理

### 现有测试 ✅

- [x] PO 文件解析
- [x] 翻译内存
- [x] 术语库
- [x] 批量翻译
- [x] 文件格式检测
- [x] 语言检测
- [x] 文件分块

### 待补充测试 ⏳

- [ ] 前端 API 集成测试
- [ ] E2E 测试（Tauri WebDriver）
- [ ] 性能基准测试
- [ ] 更多供应商模型测试（SparkDesk, Wenxin 等）

---

## 🔍 调试测试

### 运行单个测试

```bash
cargo test test_calculate_precise_cost -- --exact
```

### 显示测试输出

```bash
cargo test test_estimate_cost -- --nocapture
```

### 使用 Rust Analyzer

在 VS Code 中，测试函数上方会显示 `▶ Run Test` 按钮，点击即可运行单个测试。

---

## 🚀 CI/CD 集成

### GitHub Actions 示例

```yaml
name: Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: dtolnay/rust-toolchain@stable
      
      # 安装 nextest
      - uses: taiki-e/install-action@nextest
      
      # 运行测试
      - run: cargo nextest run --profile ci
      
      # 上传 JUnit 报告
      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: test-results
          path: target/nextest/ci/junit.xml
```

---

## 📚 最佳实践

1. **测试命名** - 使用 `test_` 前缀，描述性命名
2. **断言清晰** - 使用 `assert!`, `assert_eq!` 等宏
3. **测试隔离** - 每个测试独立，无状态依赖
4. **边界测试** - 测试边界条件和错误情况
5. **快速反馈** - 保持测试执行时间 < 10 秒
6. **持续更新** - 新功能必须附带测试

---

## 🆘 常见问题

### Q: 测试失败如何排查？

```bash
# 1. 查看详细输出
cargo test -- --nocapture

# 2. 单独运行失败的测试
cargo test failing_test_name -- --exact

# 3. 使用 rust-analyzer 调试
```

### Q: nextest 和 cargo test 有什么区别？

- `nextest` 更快（并行优化）
- `nextest` 输出更清晰
- `nextest` 不支持 doctests（使用 `cargo test --doc`）

### Q: 如何测试异步代码？

```rust
#[tokio::test]
async fn test_async_function() {
    let result = async_function().await;
    assert_eq!(result, expected);
}
```

---

**测试是代码质量的保障！🛡️**

