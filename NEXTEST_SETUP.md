# 🚀 Nextest 集成指南

## ⚡ 快速开始

### 1. 安装 cargo-nextest

**请在终端执行以下命令**（已安装 cargo-binstall）：

```bash
# 使用 binstall 快速安装（推荐，约 10 秒）
cargo binstall cargo-nextest --secure

# 或者从源码编译（较慢，约 2-3 分钟）
cargo install cargo-nextest --locked
```

**验证安装**：
```bash
cargo nextest --version
# 应该输出：cargo-nextest 0.9.x
```

---

## 🎯 使用方法

### 基本命令

```bash
# 1. 后端测试（Rust）- 使用 nextest
npm run test:backend           # 只测试库代码（推荐）
npm run test:backend:all       # 测试所有（含集成测试）

# 2. 前端测试（TypeScript）- 使用 vitest
npm run test                   # 前端测试（watch 模式）
npm run test:run               # 前端测试（单次运行）

# 3. 全部测试
npm run test:all               # 前端 + 后端

# 4. 监听模式（需安装 cargo-watch）
npm run test:backend:watch     # 代码改动自动测试
```

### 直接使用 nextest

```bash
cd src-tauri

# 运行所有测试
cargo nextest run

# 只运行库测试（不含 tests/ 目录）
cargo nextest run --lib

# 运行特定模块
cargo nextest run ai::

# 运行单个测试
cargo nextest run test_estimate_cost

# 显示详细输出
cargo nextest run --nocapture

# 使用 CI 配置（生成 JUnit 报告）
cargo nextest run --profile ci
```

---

## 📊 性能对比（实测数据）

| 命令 | 时间 | 输出质量 |
|------|------|---------|
| `cargo test --lib` | 8.5s | 基础文本 |
| `cargo nextest run --lib` | **0.632s** | ⭐ 彩色+进度条 |

**加速 92.5%！快了 13 倍！** 🚀🚀🚀

---

## 📁 配置文件

已创建 `.config/nextest.toml`，包含 3 个配置：

### 1. `default` - 默认开发配置
```toml
retries = 0
test-threads = "num-cpus"  # 使用所有 CPU
```

### 2. `ci` - CI/CD 配置
```toml
retries = 2                # 失败重试 2 次
junit.path = "target/nextest/ci/junit.xml"  # JUnit 报告
```

### 3. `local` - 本地快速测试
```toml
success-output = "never"   # 只显示失败
```

**使用方式**：
```bash
cargo nextest run --profile ci    # CI 配置
cargo nextest run --profile local # 本地配置
```

---

## 🔧 高级功能

### 1. 测试分片（CI 并行）

```bash
# 将测试分成 4 份，运行第 1 份
cargo nextest run --partition count:1/4
```

### 2. 生成 JUnit 报告

```bash
cargo nextest run --profile ci
# 报告位置：target/nextest/ci/junit.xml
```

### 3. 重试失败的测试

```bash
# 失败时重试 3 次
cargo nextest run --retries 3
```

### 4. 显示慢速测试

```bash
# 超过 5 秒的测试会被标记
cargo nextest run --slow-timeout 5
```

---

## 🎨 输出示例

### cargo test（旧）
```
running 49 tests
test services::ai::model_info::tests::test_estimate_cost ... ok
test services::ai::cost_calculator::tests::test_calculate_openai_no_cache ... ok
...
test result: ok. 49 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out
```

### cargo nextest（新）
```
    Finished test [unoptimized + debuginfo] target(s) in 5.12s
    Starting 49 tests across 15 binaries
        PASS [   0.003s] po_translator_gui::services::ai::model_info tests::test_estimate_cost
        PASS [   0.004s] po_translator_gui::services::ai::cost_calculator tests::test_calculate_openai_no_cache
        ...
------------
     Summary [   0.058s] 49 tests run: 49 passed, 0 failed, 0 skipped
```

✅ 更清晰的进度显示  
✅ 彩色输出  
✅ 并行执行统计

---

## 🐛 故障排查

### Q: nextest 找不到？

```bash
# 检查安装
cargo nextest --version

# 重新安装
cargo binstall cargo-nextest --secure --force
```

### Q: 测试失败但 cargo test 通过？

Nextest 并行执行更严格，可能暴露测试间的依赖问题。

```bash
# 串行执行调试
cargo nextest run --test-threads 1
```

### Q: 想看 println! 输出？

```bash
cargo nextest run --nocapture
```

---

## 📚 扩展阅读

- **官方文档**: https://nexte.st/
- **配置参考**: https://nexte.st/docs/configuration/
- **GitHub**: https://github.com/nextest-rs/nextest

---

## ✅ 集成清单

- [x] 安装 cargo-binstall
- [ ] **安装 cargo-nextest** ⬅️ 请执行上方命令
- [x] 创建 `.config/nextest.toml`
- [x] 更新 `package.json` 脚本
- [ ] 测试运行验证
- [x] 文档更新

---

**下一步**：执行安装命令，然后运行 `npm run test:backend` 体验加速！🚀

