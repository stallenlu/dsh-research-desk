# scihub 下载窄动作 · 关1现状-目标差距表

## 结论先行
宿主侧通、科灵侧断：`dsh-scihub` 的 `scihub_pdf`、`scihub_batch` 已注册进 DSH 工具表（子代理工具清单即可见），但科灵台 `dsh-research-desk` 全库对 scihub 零命中，`ACTIONS` 无下载动作、提示词只让 agent 调 `research_desk`。本批只补一条窄下载动作，直接执行不设审批闸门，不建通用工具面板。

## 现状（逐字 file:line，已 live 读取核实）
| 项 | 现状 | 证据 |
|---|---|---|
| ACTIONS 白名单 | 45 项，无下载 | lib/host.mjs:42 数组末尾为 ...'draft_image' |
| 运行分派 | 无下载 case | lib/host.mjs:2243 switch，末 case :2288 draft_image，:2289 default |
| 参数枚举 | action enum 直接引用 ACTIONS | lib/host.mjs:2740-2743 enum: ACTIONS；描述数组 :2744-2790（:2789 draft_image） |
| 验真范式 | 已有，照搬 | lib/host.mjs:51-64 draftImageTool：ctx.get('tools') → selectExecutor → executable(name) → describe([def]).schemas 验名 → 返回 {tools, name} |
| 执行范式 | 已有，照搬 | lib/host.mjs:1160 tools.execute({calls:[{type:'tool-call',id,name,arguments:JSON.stringify(args)}],signal})，:1162-1166 results.find(e=>e.callId===id)?.result 解析 |
| 抓全文范式 | 同构可参照 | lib/search.mjs:11 WEB_FETCH_NAME、:17-30 webFetchTool 照验真范式、:358 同款 tools.execute |
| 测试范式 | 已有 | test/host.test.mjs:1172-1241 draft_image：draftImageCtx(tools) 造 ctx、executable/selectExecutor/execute 三件套、断言 calls.length |
| 宿主工具 schema | 已确认 | C:/Users/GT14/.dsh/profiles/desktop/node_modules/dsh-scihub/lib/host.mjs:315 scihub_pdf(doi:string/url:string, additionalProperties:false)；:379 scihub_batch(dois:string[], required) |
| 服务端读取 | 零命中 | lib/host.mjs 全库 case-insensitive grep scihub = 0 |

## 差距
1. 科灵无法调用下载：ACTIONS(:42) 无 download_paper，run switch(:2288 后) 无分派，PARAMETERS 描述数组(:2789 后) 无说明。
2. 无按名取宿主工具的窄封装：draftImageTool(:51-64) 范式只服务生图，未覆盖 scihub。
3. 无测试护栏：test 目录 grep scihub = 0，无法防止回归。

## 目标
- 新增 `download_paper` 动作（`doi` 单篇 / `url` 单篇 / `dois` 批量三选一），按名取 `scihub_pdf`/`scihub_batch`，验真后 execute，解析 status/path 原样回给调用方。
- 直接执行、无审批闸门（本批不新增任何审批相关代码），不打断用户。
- 只做这一条窄动作：不建通用工具面板、不新造 connector、不声称 MCP 可桥接。

## 硬边界
零新增 hex 复用现存 class；助手名科灵；禁自建 headless；approval 闸门/权限行为锁/KELIN_PROFILE 协议/既有断言零触碰；服务端现有 admitEncodedFile 与附件提纯零改。

## 五关待办
关2 Chief 带勾追溯（挂 1.2/1.3 不挂 1.4/1.7）→ 关3 施工 + lead 两轮逐字复核 → 关4 非施工终审 R1-R9 → 关5 门禁全量 + 提交推送 + Mnemon 沉淀。
