<!-- 73092a41-e9d9-4eb5-81eb-24575ff1c277 ff7a01a5-c990-4b5f-8789-91df5695f6a8 -->
# AI-L10n-Studio 工程化增强计划

## 核心原则

1. **自底向上实施**：基础设施 → 工具层 → 业务层 → UI层
2. **代码复用优先**：同一功能集中实现，一处修改全局生效
3. **直接复制成熟代码**：clash-verge-rev 代码可直接使用（改标识符即可）
4. **自动化工具优先**：批量修改用临时脚本，完成即删

---

## Phase 1：基础设施层（底层）

**目标**：建立稳定的基础工具，所有后续功能都依赖这一层

### 1.1 路径管理工具 `src-tauri/src/utils/paths.rs`

- **复制来源**：`clash-verge/utils/dirs.rs` (228行)
- **核心功能**：统一路径获取 API、便携模式支持、自动创建目录结构
- **修改点**：`APP_ID` 常量改为 `"com.potranslator.gui"`

### 1.2 日志系统 `src-tauri/src/utils/logging.rs`

- **复制来源**：`clash-verge/utils/logging.rs` (171行)
- **核心功能**：标准化日志宏、flexi_logger 集成、模块过滤
- **修改点**：`Type` 枚举改为项目模块（Translator/Parser/Config/TM）
- **依赖**：paths.rs

### 1.3 Clippy Lints 配置 `src-tauri/Cargo.toml`

- **复制来源**：`clash-verge/Cargo.toml` lints 部分 (165-213行)
- **核心规则**：禁止 unwrap/panic/expect、强制异步最佳实践、代码质量检查
- **修改点**：直接复制，无需修改

---

## Phase 2：工具层（中间层）

**目标**：基于基础设施，实现可复用的工具和配置

### 2.1 配置扩展 `src-tauri/src/services/config_manager.rs`

- **改造方式**：扩展现有 `AppConfig` 结构体
- **新增字段**：日志配置、主题配置、语言配置
- **原则**：向后兼容、配置验证
- **依赖**：paths.rs, logging.rs

### 2.2 后端国际化 `src-tauri/src/utils/i18n.rs`

- **复制来源**：`clash-verge/utils/i18n.rs` (99行)
- **核心功能**：系统语言检测、支持的语言列表、异步翻译函数
- **修改点**：默认语言改为 `"zh-CN"`，路径使用 `paths.rs`
- **新增 Command**：`get_system_language()`
- **依赖**：paths.rs

### 2.3 开发工具脚本 `scripts/`

- **脚本1**：`check-unused-i18n.js` - i18n 键清理工具
- **脚本2**：`portable.js` - Windows 便携版打包
- **依赖**：无（独立工具）

---

## Phase 3：业务集成层

**目标**：将基础设施集成到现有业务逻辑

### 3.1 应用初始化重构 `src-tauri/src/main.rs`

- **改造点**：初始化便携模式、日志系统、配置目录、加载配置、启动 Tauri
- **参考**：`clash-verge/utils/init.rs` 的 `init_logger()` 函数
- **依赖**：Phase 1 + Phase 2

### 3.2 统一错误处理（自动化重构）

- **方式**：临时脚本 `scripts/refactor-error-handling.js`
- **功能**：Dry-run 模式、自动备份、批量替换、编译验证
- **完成后**：删除脚本和备份文件
- **依赖**：logging.rs

---

## Phase 4：前端增强层

**目标**：前端 UI 和用户体验改进

### 4.1 主题系统增强 `src/hooks/useTheme.ts`

- **参考**：`clash-verge/components/layout/use-custom-theme.ts` (349行)
- **新增功能**：系统主题监听、三种模式（light/dark/system）、窗口主题同步
- **保留**：现有 Ant Design 主题配置
- **依赖**：config_manager.rs 的 `theme_mode` 字段

### 4.2 前端国际化增强 `src/i18n/config.ts`

- **新增功能**：系统语言检测、动态加载语言文件、语言优先级
- **依赖**：i18n.rs 的 `get_system_language()` Command

### 4.3 设置页面增强 `src/components/SettingsModal.tsx`

- **新增配置项**：主题切换、日志级别、日志管理、自动清理策略
- **参考**：`clash-verge` 的 `ThemeModeSwitch` 组件
- **依赖**：Phase 3 所有功能

---

## Phase 5：代码质量提升（最后）

**目标**：清理和优化，确保代码一致性

### 5.1 统一代码风格

- Prettier 配置、EditorConfig

### 5.2 运行质量工具

- i18n 检查、Rust 格式化、Clippy 检查、前端 Lint

### 5.3 清理临时文件

- 删除备份文件、删除临时脚本、提交最终代码

---

## 实施依赖图（自底向上）

```
Phase 1: 基础设施层
├─ 1.1 paths.rs          [最底层，无依赖]
├─ 1.3 Clippy Lints      [独立配置]
└─ 1.2 logging.rs        [依赖: paths.rs]

Phase 2: 工具层
├─ 2.2 i18n.rs           [依赖: paths.rs]
├─ 2.3 scripts/          [独立工具]
└─ 2.1 config_manager    [依赖: paths.rs, logging.rs]

Phase 3: 业务集成层
├─ 3.2 错误处理重构      [依赖: logging.rs]
└─ 3.1 main.rs 初始化    [依赖: Phase 1+2]

Phase 4: 前端增强层
├─ 4.1 主题系统          [依赖: config_manager]
├─ 4.2 前端国际化        [依赖: i18n.rs]
└─ 4.3 设置页面          [依赖: Phase 1-4]

Phase 5: 代码质量
└─ 全局优化             [依赖: 所有]
```

---

## 技术依赖

**Rust 新增依赖**：

```toml
flexi_logger = "0.31.7"
sys-locale = "0.3.2"
chrono = "0.4"
once_cell = "1.21.3"
```

**Node.js 新增依赖**：

```json
{
  "devDependencies": {
    "adm-zip": "^0.5.16"
  }
}
```

---

## 可直接复制的文件清单

| 源文件 | 目标文件 | 修改点 | 行数 |

|--------|---------|--------|-----|

| `utils/dirs.rs` | `paths.rs` | APP_ID 常量 | 228 |

| `utils/logging.rs` | `logging.rs` | Type 枚举 | 171 |

| `utils/i18n.rs` | `i18n.rs` | 默认语言、路径 | 99 |

| `scripts/check-unused-i18n.js` | 同名 | 路径常量 | 103 |

| `scripts/portable.mjs` | `portable.js` | exe 名称 | 53 |

| `Cargo.toml` (lints) | `Cargo.toml` | 无 | 49行 |

---

## 预计工作量

- Phase 1: 0.5天
- Phase 2: 1天
- Phase 3: 1天
- Phase 4: 1.5天
- Phase 5: 0.5天

**总计**: 约1周（4.5天）

### To-dos

- [ ] Phase 1.1: paths.rs（最底层）
- [ ] Phase 1.3: Clippy Lints（独立）
- [ ] Phase 1.2: logging.rs（依赖 1.1）
- [ ] Phase 2.2: i18n.rs（依赖 1.1）
- [ ] Phase 2.3: scripts/（独立）
- [ ] Phase 2.1: config_manager（依赖 1.1, 1.2）
- [ ] Phase 3.2: 错误处理重构（依赖 1.2）
- [ ] Phase 3.1: main.rs 初始化（依赖 Phase 1+2）
- [ ] hase 4.1: 主题系统（依赖 2.1）
- [ ] Phase 4.2: 前端国际化（依赖 2.2）
- [ ] Phase 4.3: 设置页面（依赖 3.1, 4.1, 4.2）
- [ ] Phase 5: 代码质量提升（依赖所有）