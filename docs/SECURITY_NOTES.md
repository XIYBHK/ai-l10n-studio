# 安全说明

## 配置与密钥边界

运行时配置由 `ConfigDraft` 管理。公开配置写入 `config.json`，密钥按稳定 `providerId` 写入同目录的 `config.secrets.json`。密钥不会写入公开配置或通过查询返回；前端摘要仅提供 `hasApiKey`。

所有配置写入通过 `transaction()` 完成克隆、修改、校验、持久化和内存发布。配置解析或校验失败时保留原文件并拒绝覆盖；供应商 ID、模型 ID 和 `defaultModel` 一起校验。每个文件通过原子替换保存；公开配置写入失败时恢复原凭据文件。

## 便携模式

便携包只携带程序、插件资源和 `.config/PORTABLE`，不携带个人配置、翻译记忆库或 API key。不要把 `config.secrets.json` 提交到版本库、日志或截图中。

凭据文件是本地 JSON，未加密，当前没有系统凭据库集成。IPC 参数日志递归脱敏，包括敏感字段下的数组和对象。提示词日志包含原文和译文；内容边界见 [数据契约](DataContract.md)。

## 相关文档

- [文档索引](README.md)
- [根 README](../README.md)
- [数据契约](DataContract.md)
- [架构说明](Architecture.md)
