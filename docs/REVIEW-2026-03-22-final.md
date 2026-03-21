# 最终代码审查报告 (2026-03-22)

基于三方面并行审查（Rust 后端、React 前端、配置与安全），汇总新发现的问题。
已在第一份审查（REVIEW-2026-03-22.md）中修复的 14 项不再重复列出。

---

## P0 - 编码乱码（高优先）

### Issue 1: AIConfigTab.tsx 大量中文乱码（20+ 处）

**文件**: `src/components/settings/AIConfigTab.tsx`

**行号与修复对照**:
| 行 | 乱码 | 应为 |
|-----|------|------|
| 107 | `鍔犺浇璇ヤ緵搴斿晢鐨勬墍鏈夋ā锟?` | `加载该供应商的所有模型` |
| 112 | `锟窖硷拷锟斤拷模锟斤拷锟叫憋拷` | `加载动态模型列表` |
| 117 | `鍔犺浇妯″瀷鍒楄〃澶辫触` | `加载模型列表失败` |
| 125 | `娴嬭瘯杩炴帴鍓嶈閲嶆柊杈撳叆 API Key` | `测试连接前请重新输入 API Key` |
| 149 | `锟斤拷锟接诧拷锟皆成癸拷` | `连接测试成功` |
| 152 | `娴嬭瘯澶辫触` | `测试失败` |
| 167 | `缂栬緫閰嶇疆` | `编辑配置` |
| 169 | `閰嶇疆鏁版嵁` | `配置数据` |
| 183 | `[删锟斤拷] 锟斤拷始删锟斤拷锟斤拷锟斤拷` | `[删除] 开始删除配置` |
| 188 | `锟斤拷锟斤拷锟斤拷删锟斤拷` | `配置已删除` |
| 193 | `鍒犻櫎澶辫触` | `删除失败` |
| 206 | `锟斤拷锟斤拷锟斤拷锟斤拷锟斤拷` | `配置已启用` |
| 210 | `鍚敤澶辫触` | `启用失败` |
| 220 | `锟斤拷锟斤拷锟斤拷 API Key` | `请输入 API Key` |
| 224 | `纭繚绌哄瓧绗︿覆杞崲锟?null` | `确保空字符串转换为 null` |
| 243 | `锟斤拷锟斤拷锟斤拷锟斤拷锟斤拷` | `配置已添加` |
| 246 | `锟斤拷锟斤拷锟窖革拷锟斤拷` | `配置已更新` |
| 312 | `妯″瀷:` / `(鏈锟?)` | `模型:` / `(未设置)` |
| 313 | `瀵嗛挜:` / `(鏈锟?)` | `密钥:` / `(未设置)` |
| 328 | `鍚敤锟?` | `启用中` |

---

### Issue 2: 其他文件中文乱码

- `src/AppShell.tsx:106` — `璇峰厛鍦ㄨ缃腑閰嶇疆骞跺惎鐢?AI 鏈嶅姟` → `请先在设置中配置并启用 AI 服务`
- `src/components/MenuBar.tsx` — 多处（约 6 处）
- `src/components/SettingsModal.tsx:54` — 乱码

**根因**: 文件编码问题（GB2312 混入 UTF-8 项目）

---

## P1 - Emoji 残留

### Issue 3: 前端 emoji 残留（未在第一轮修复范围内的文件）

**新发现**:

- `src/components/EntryList.tsx:359` — `log.info('📊 条目分组', ...)`
- `src/pages/DevToolsPage.tsx:60,172,267` — `⏸️`、`▶️`、`📊`
- `src/pages/DevToolsPage.tsx:44,53,57,84,95` — 注释中的 emoji
- `src/components/TermLibraryManager.tsx:285` — `📝 当前风格总结`

### Issue 4: Rust 后端 emoji（约 78 处）

**涉及文件**: `main.rs`、`commands/ai_config.rs`、`commands/translator.rs`、`commands/system.rs`、`services/ai/models/*` 等

**示例**:

- `main.rs:29` — `log::info!("🚀 PO Translator GUI starting...")`
- `main.rs:25` — `eprintln!("❌ Failed to initialize application: {}", e)`
- `commands/ai_config.rs:94` — `crate::app_log!("❌ [AI配置] 保存配置失败: {}", e)`
- `commands/ai_config.rs:98` — `crate::app_log!("✅ [AI配置] 新增配置成功")`

---

## P2 - 代码质量

### Issue 5: logger.rs 使用 std::sync::Mutex 而非 parking_lot

**文件**: `src-tauri/src/utils/logger.rs:3`

项目规范要求使用 `parking_lot`，此处仍用 `std::sync::Mutex` 并手动处理 poisoning。

---

### Issue 6: MemoryManager.tsx 非响应式 getState()

**文件**: `src/components/MemoryManager.tsx:194`

```typescript
const { cumulativeStats, setCumulativeStats } = useStatsStore.getState();
```

如果只用 setter 则可接受，但应添加注释说明。

---

### Issue 7: tsconfig.json 未启用未使用代码检查

**文件**: `tsconfig.json:15-16`

```json
"noUnusedLocals": false,
"noUnusedParameters": false
```

建议单独 PR 启用。

---

## P2 - 安全相关

### Issue 8: npm 依赖存在已知漏洞

运行 `npm audit` 发现:

- **flatted** ≤3.4.1 — 递归 DoS + 原型污染
- **rollup** 4.0.0-4.58.0 — 路径遍历任意文件写入
- **undici** 7.0.0-7.23.0 — 6 个漏洞（WebSocket 溢出、HTTP 走私等）

**修复**: `npm audit fix` 或手动升级

---

### Issue 9: Tauri 文件系统权限过宽

**文件**: `src-tauri/capabilities/file-operations.json:13-27`

`fs:scope-document-recursive` 允许访问整个文档目录。建议收窄到应用专用子目录。

---

### Issue 10: Rust tracing 可能记录 API 密钥

**文件**: `src-tauri/src/services/ai_translator.rs`

`#[tracing::instrument]` 装饰器默认记录所有参数。应添加 `skip(self)` 避免 `api_key` 泄漏到日志。

---

## P3 - 小问题

### Issue 11: 测试代码硬编码敏感字符串

**文件**: `src-tauri/src/services/config_manager.rs:557,595,646`、`config_draft.rs:729`

如 `"real-secret-key"`、`"provider-secret"` 等。虽在 `#[cfg(test)]` 下，但可能出现在生产二进制的字符串表中。建议替换为 `"test-key-placeholder"` 等非特征值。

### Issue 12: release.yml Secrets 缺少验证

**文件**: `.github/workflows/release.yml:69-70`

`TAURI_PRIVATE_KEY: ${{ secrets.TAURI_PRIVATE_KEY || '' }}` 空值时静默失败。

### Issue 13: main.rs expect() 可改为优雅退出

**文件**: `src-tauri/src/main.rs:23,111`

Tokio runtime 创建和 Tauri 运行使用 `expect()`，失败时直接 panic。可改为 `eprintln` + `process::exit(1)`。

---

## 修复优先级建议

```
第一批（立即）:
  Issue 1, 2   → 修复中文乱码（4 个文件，影响用户可见文本）
  Issue 8      → npm audit fix（安全漏洞）

第二批（本周）:
  Issue 3, 4   → 清除所有 emoji（前端 ~10 处 + Rust ~78 处）
  Issue 5      → logger.rs 换 parking_lot::Mutex

第三批（下周）:
  Issue 9, 10  → 安全加固（权限收窄、tracing skip）
  Issue 6, 11-13 → 小修小补
  Issue 7      → tsconfig 严格模式（单独 PR）
```

---

## 总结

| 等级 | 数量 | 主要类别                                    |
| ---- | ---- | ------------------------------------------- |
| P0   | 2    | 中文编码乱码（约 30 处）                    |
| P1   | 2    | Emoji 残留（前端 ~10 + Rust ~78 处）        |
| P2   | 5    | 代码质量 + 安全（依赖漏洞、权限、日志泄漏） |
| P3   | 3    | 测试硬编码、CI 验证、expect 优化            |

**整体评价**: 项目核心架构和错误处理设计良好，上一轮审查的 14 项修复均已验证通过。
当前残留问题以编码乱码和 emoji 清理为主，无阻塞性缺陷。安全方面建议尽快更新 npm 依赖。
