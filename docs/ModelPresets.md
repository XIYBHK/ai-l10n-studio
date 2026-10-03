# 国产模型快速接入

核验日期：2026-10-03。入口：设置 → AI 模型配置 → 国产模型快速接入。选择供应商，填入该平台的普通 API Key，点击“保存并使用”。该操作在同一个配置事务中保存供应商并选择默认翻译模型。

| 供应商   | Base URL                                            | 协议               | 默认模型                        | 官方依据                                                                                   |
| -------- | --------------------------------------------------- | ------------------ | ------------------------------- | ------------------------------------------------------------------------------------------ |
| DeepSeek | `https://api.deepseek.com`                          | OpenAI Completions | `deepseek-flash`                | [首次调用](https://api-docs.deepseek.com/)                                                 |
| 通义千问 | `https://dashscope.aliyuncs.com/compatible-mode/v1` | OpenAI Completions | `qwen-plus`                     | [百炼北京地域调用](https://help.aliyun.com/zh/model-studio/model-calling-in-sub-workspace) |
| Kimi     | `https://api.moonshot.cn/v1`                        | OpenAI Completions | `kimi-k3`                       | [快速开始](https://platform.kimi.com/docs/get-api-key)                                     |
| 智谱 GLM | `https://open.bigmodel.cn/api/paas/v4`              | OpenAI Completions | `glm-5.2`                       | [GLM-5.2 调用示例](https://docs.bigmodel.cn/cn/guide/models/text/glm-5.2)                  |
| MiniMax  | `https://api.minimax.cn/anthropic/v1`               | Anthropic Messages | `MiniMax-M3`                    | [Anthropic 兼容 API](https://platform.minimax.cn/docs/api-reference/text-anthropic-api)    |
| 硅基流动 | `https://api.siliconflow.cn/v1`                     | OpenAI Completions | `deepseek-ai/DeepSeek-V4-Flash` | [Chat Completions API](https://docs.siliconflow.cn/docs/api/chat-completions-post)         |

以上是中国区普通开放平台接口，未使用 Coding Plan 专用接口。千问需要中国内地（北京）的百炼 API Key。账户的模型权限、余额和限流由供应商管理；保存预设不会调用收费接口，实际连通性可在编辑中的“测试连接”验证。

## 行为与维护

- 预设定义集中在 `src/config/modelPresets.ts`，不依赖旧插件目录的模型列表和价格。未核实的价格、上下文上限和输出上限不预填；成本界面显示“价格未配置”。
- “高级设置”保留已输入的密钥及预填资料，可改模型、接口或增加多个模型。高级编辑中的普通保存保持既有默认模型行为。
- 重复添加同一个供应商会使用新的稳定 ID（如 `deepseek-2`），不覆盖已有配置或密钥。
- 切换快速预设会清空尚未保存的密钥，避免误用另一个平台的凭据。
- 快速入口只接受非空密钥；无密钥的本地服务仍使用“添加自定义 API”。
- MiniMax 使用 Anthropic Messages，解析器只读取文本内容块；认证同时提供 Bearer（MiniMax 文档要求）和 `x-api-key`（Anthropic）。两个头都只发往用户配置的同一地址，HTTP 重定向已禁用。

预设交互与协议自动化验证使用本地模拟 HTTP。随后已对相同 DeepSeek 接口执行真实 Rust 翻译、保存回读和确认入库验证，记录见 [LogicFixes.md](LogicFixes.md)；其余供应商未做真实连接验证。官方可用模型变化时需重新核对本表来源并更新预设。
