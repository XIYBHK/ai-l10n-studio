# Documentation Index

当前文档以源码为准；阶段报告和旧 specs 已收至 [archive](archive/README.md)，不能替代当前契约。

## Current docs

| File                    | Purpose                                      |
| ----------------------- | -------------------------------------------- |
| `Architecture.md`       | 当前架构与分层                               |
| `API.md`                | Tauri IPC、前端服务和状态接口                |
| `DataContract.md`       | 前后端数据类型与持久化边界                   |
| `SECURITY_NOTES.md`     | 配置与密钥文件边界                           |
| `THEME.md`              | 设计 token、Ant Design 6 和主题切换          |
| `COLOR_SYSTEM.md`       | `src/index.css` token SSOT                   |
| `ERRORS.md`             | 错误排查与已知问题目录                       |
| `ModelPresets.md`       | 快速预设的接口与核验记录                     |
| `LogicFixes.md`         | 文档、TM、术语和实测修复交付                 |
| `ArchitectureReview.md` | 本轮架构收敛、测试和保留边界                 |
| `UIRuntimeAudit.md`     | release 界面缺陷、同类问题修复与原生回归证据 |
| `WindowCloseAudit.md`   | 原生关闭权限、未保存保护和进程退出证据       |
| `GraphIndexAudit.md`    | 本地图谱索引失败原因、恢复和覆盖边界         |
| `UIUXDesignReview.md`   | UI/UX Pro Max 设计审查、release 复现与建议   |
| `UIRefinement.md`       | 中性配色、工作区设计优化与 release 验收      |

## Recommended order

1. `Architecture.md`
2. `DataContract.md`
3. `API.md`
4. `SECURITY_NOTES.md`

UI 改动先看 `COLOR_SYSTEM.md` 和 `THEME.md`；项目约定见根目录 `AGENTS.md` 与 `src/AGENTS.md`。

## Current boundaries

- 配置入口是 `ConfigDraft`，使用稳定 provider ID、多模型和 `defaultModel`。
- 设计 token 的唯一来源是 `src/index.css`；Ant Design 版本以 `package.json` 为准（当前为 6.x）。
- PO 是当前主编辑格式。JSON 仅用于检测和元信息，XLIFF/YAML 当前不支持翻译编辑。

## Links

- [根 README](../README.md)
- [安全说明](SECURITY_NOTES.md)
- [主题指南](THEME.md)
- [颜色系统](COLOR_SYSTEM.md)
