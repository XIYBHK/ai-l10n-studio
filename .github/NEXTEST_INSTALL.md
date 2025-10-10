# ⚡ 请执行以下命令安装 nextest

## 推荐方式（快速，约 10 秒）

```bash
cargo binstall cargo-nextest --secure
```

## 备选方式（从源码编译，约 2-3 分钟）

```bash
cargo install cargo-nextest --locked
```

## 验证安装

```bash
cargo nextest --version
```

应该输出类似：`cargo-nextest 0.9.x`

---

## 安装后立即测试

```bash
# 方式 1: 使用 npm 脚本（推荐）
npm run test:backend

# 方式 2: 直接使用 nextest
cd src-tauri && cargo nextest run --lib
```

**预期结果**：
- ✅ 49 个测试全部通过
- ⚡ 执行时间约 5 秒（比 cargo test 快 40%）
- 🎨 彩色输出 + 进度条

---

安装完成后可以删除此文件。详细使用方法见 `NEXTEST_SETUP.md`。

