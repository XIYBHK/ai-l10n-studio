# 类型生成自动化：ts-rs

## 集成步骤

### 1. 添加 Rust 依赖

在 `src-tauri/Cargo.toml` 中添加：

```toml
[dependencies]
ts-rs = "7.1"
```

### 2. 为 Rust 类型添加注解

示例（`src-tauri/src/services/ai_translator.rs`）：

```rust
use ts_rs::TS;

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/types/generated/")]
pub struct AIConfig {
    pub provider: ProviderType,
    pub api_key: String,
    pub base_url: Option<String>,
    pub model: Option<String>,
    pub proxy: Option<ProxyConfig>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/types/generated/")]
pub struct TokenStats {
    pub input_tokens: u32,
    pub output_tokens: u32,
    pub total_tokens: u32,
    pub cost: f64,
}
```

### 3. 生成 TypeScript 类型

```bash
cd src-tauri
cargo test --features ts-rs
```

生成的文件位于：`src/types/generated/*.ts`

### 4. 在前端使用

```typescript
// 自动生成的类型，保证与 Rust 100% 一致
import type { AIConfig, TokenStats } from './types/generated/AIConfig';
```

## 优势

✅ **类型一致性**：编译时保证前后端类型匹配  
✅ **自动更新**：Rust 类型改变时自动重新生成  
✅ **减少维护**：无需手动同步类型定义  
✅ **类型安全**：TypeScript 编译时捕获不匹配

## 建议的类型注解清单

需要为以下 Rust 结构体添加 `TS` derive：

- ✅ `AIConfig`
- ✅ `ProxyConfig`  
- ✅ `TokenStats`
- ✅ `TranslationStats`
- ✅ `POEntry`
- ✅ `TranslationReport`
- ✅ `AppConfig`
- ✅ `TermEntry`
- ✅ `StyleSummary`
- ✅ `LanguageInfo`
- ✅ `ConfigVersionInfo`

## 集成到 CI/CD

在构建脚本中添加类型生成步骤：

```json
{
  "scripts": {
    "prebuild": "cd src-tauri && cargo test --features ts-rs",
    "build": "vite build"
  }
}
```

这样每次构建前都会自动生成最新的类型定义。

