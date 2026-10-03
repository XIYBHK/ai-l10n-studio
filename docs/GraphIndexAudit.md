# 图谱索引失败核查

核验日期：2026-10-03。本地阻塞已解除，`ai-l10n-studio` 图谱状态为 `ready`，函数检索、源码片段和调用链查询均可用。

## 根因与证据

仓库根目录有一个未跟踪的历史 `nul` 文件，83 字节，最后修改时间为 2026-02-01 21:27:11。`NUL` 是 Windows 保留设备名，普通路径和扩展文件路径会产生不同的 Win32 行为。参见 [Microsoft 文件命名规则](https://learn.microsoft.com/en-us/windows/win32/fileio/naming-a-file)。

本机 CBM 为 `0.11.0`，二进制 SHA-256 为 `7EDCD3807EBCFD85EC1968985964080F2589748DA2FC3C7CE9261EEBAB31FF04`。失败复现使用 `repo_path=F:/Github/ai-l10n-studio`、`name=ai-l10n-studio`、`mode=fast`、`persistence=false`。工具返回 `aborted_previous_preserved`，随后覆盖检查返回 `project not found or not indexed`。

捕获 worker 完整日志后，确认它已发现 221 个文件并完成这些文件的清单哈希，但没有进入正常提取流程。结合源码和原生 API 探针，定位到配置控制文件遍历阶段：`semantic_manifest_walk_controls` 会先取得每个目录项的属性，再决定是否属于配置文件；该阶段遇到属性读取失败就返回失败。源码位置是本地 CBM checkout `src/pipeline/pipeline_incremental.c`，其 Windows 属性查询实现位于 `src/foundation/compat_fs.c`。源码辅助定位，当前二进制的行为另以以下直接实验验证。

| 验证                                                           | 结果                                  |
| -------------------------------------------------------------- | ------------------------------------- |
| `GetFileAttributesExW` 查询普通 `F:\Github\ai-l10n-studio\nul` | 失败，Windows 错误 87                 |
| 同一 API 查询 `\\?\F:\Github\ai-l10n-studio\nul`               | 成功                                  |
| 查询正常 `package.json`                                        | 成功                                  |
| 原文件仍在根目录时，同一索引参数重试                           | 发布前中止，未建立图谱                |
| 移走该文件后，同一索引参数重试                                 | `indexed`，2,690 个节点、8,160 条关系 |

因此，`.gitignore` 中已有的 `nul` 排除项并不能解除此处阻塞：普通代码发现会忽略它，但后续配置清单遍历仍先查询目录项属性。仅增加 Git 忽略项无法修复这个本地文件系统问题。

失败返回中的“上一版索引仍在服务”是通用提示。本仓库首次建立没有成功，此前项目列表也没有本仓库，不能把这句话当成存在可用旧索引的证据。

## 处理与验证

以 Windows 扩展路径将该文件移动到 `src-tauri/target/cbm-diagnostics/windows-reserved-name.original.backup`，移动前核实它未被 Git 跟踪，目标位于当前仓库内且不存在；移动后逐字节比较，原 83 字节内容保留。未删除原内容，也未修改应用源码。

重新索引后 `index_status` 返回 `ready`，分支为 `main`，受测源码提交为 `e81782da8d1c1772a2e5879e0a05920ebb0af83a`。检索到 `useTranslationFlow`，并成功查询其主界面调用者和实际关闭处理源码。

| 首次恢复指标                                   | 结果                                                          |
| ---------------------------------------------- | ------------------------------------------------------------- |
| 节点 / 关系                                    | 2,690 / 8,160                                                 |
| `skipped` / `parse_partial` / `parse_unusable` | 均为 0                                                        |
| 配置的排除项                                   | 20 个目录、58 个文件；fast 模式的正常范围                     |
| 覆盖记录                                       | `complete`，generation 一致，哈希记录完整                     |
| 源码独立核对                                   | 13 个关键文件的 SHA-256、大小、纳秒修改时间均与数据库记录一致 |

原始工具记录见 [失败返回](audits/2026-10-03/graph-index/before-index.json)、[成功返回](audits/2026-10-03/graph-index/after-index.json)、[状态](audits/2026-10-03/graph-index/index-status.json)、[覆盖检查](audits/2026-10-03/graph-index/coverage.json)、[源码核对](audits/2026-10-03/graph-index/source-matches.json)、[函数检索](audits/2026-10-03/graph-index/function-search.json) 和 [调用者查询](audits/2026-10-03/graph-index/caller-query.json)。完整诊断日志保留在 `src-tauri/target/cbm-diagnostics/`，不纳入 Git。

## 剩余工具边界

覆盖检查已能返回本仓库记录，但对所查文件仍报告 `freshness=metadata_changed`。只读 SQLite 和源码核对证明这 13 个文件的内容及元数据实际匹配，因此该提示在这些文件上是误报；尚未定位或修复 CBM 二进制内部比较逻辑，不通过改写数据库来消除提示。

fast 模式按规则排除测试目录、i18n、生成类型和部分脚本。源码核对只覆盖报告所列的 13 个文件；成功索引和没有解析失败都不能证明全仓结构关系完整。调查这些排除范围时仍须读源码，不能据图谱给出穷尽或否定结论。

CBM 的 worker 在索引逻辑失败时仍可正常退出；监督器按正常退出清理日志，使错误提示要求查看的临时日志消失。本轮通过只读保持该日志句柄取得完整记录，没有重启共享 daemon 或修改全局工具配置。该日志清理行为属于另一个诊断限制，未冒充已修复。

PowerShell 中丢弃输出使用 `$null` 或 `Out-Null`，避免混用其他 shell 的重定向写法产生保留名文件。文件的具体创建命令无法从现存证据确认。
