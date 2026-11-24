# 阶段1 · 公共 helper 抽取 · 技术可行性与影响面核（后端）

> 目标：生态能力借用公共 helper 抽取与模拟使用者验证 · 阶段1「helper 抽取设计定稿」
> 取证角色：后端（服务端 / 插件开发）　|　本份标 **待审方案、非既定结论——未经裁决不得当已定方案**
> 本轮工作树 revision（阶段8后重取，逐字核）：`lib/host.mjs` = `2dfb7ff35a94435fb17f476435a6c12a88741d1bac425dc54da8a6a70dff8eec`（3344 行）、`lib/search.mjs` = `9f6494fbdfbaf62a6b1d9e50a89405e40e293419893c7d14b654952e2830d2ef`（436 行）。HEAD=`bc497817c8247f793c08b06f8558d7950950695b`。
>
> **派工**：核 helper 抽取的技术可行性与影响面——逐条 file:line 给三处当前真实锚点（阶段8后重取），确认抽取不碰三道闸门函数体、三条借用能力对外行为不变，明确指出哪些抽法会绕过统一策略层或踩 B 红线（让模型自发现/自报安全）。只落 docs、不改业务代码。

---

## §0 本份边界

阶段8施工后行号整体漂移（例：`ensureRiskApproval` 从旧锚点 :1114 漂到 :1252、dispatch 从 :2405 漂到 :2644+），本轮**一律以当前工作树逐字重取为准**，不引用收敛文档里的旧行号。架构主持接口设计，本份不重复设计接口，只回答"能不能抽、抽了会碰到什么、哪些抽法违规"三问。结论是技术判断，不是采纳裁决。

---

## §1 三处管道当前真实锚点（阶段8后重取）

三处"工具发现→探测→调用→回流"管道的外形与差异，逐字如下。

### 1.1 draftImageTool（host.mjs:51-64）

```
51 function draftImageTool(ctx) {
52   const tools = ctx && typeof ctx.get === 'function' ? ctx.get('tools') : null
53   if (typeof tools?.executable !== 'function' || typeof tools?.execute !== 'function' || typeof tools?.selectExecutor !== 'function') return null
54   try {
55     const executor = tools.selectExecutor()
56     if (typeof executor?.describe !== 'function') return null
57     for (const name of DRAFT_IMAGE_NAMES) {           // :45 ['dsh_subscriptions_image_generate','image_generate']
58       const def = tools.executable(name)
59       if (def?.parameters?.properties?.prompt?.type !== 'string' || def?.output?.schema?.properties?.paths?.type !== 'array') continue
60       if (executor.describe([def])?.schemas?.some(schema => schema.name === name)) return { tools, name }
61     }
62   } catch (e) {}
63   return null
64 }
```
- 发现三件套检查 :53（`executable`/`execute`/`selectExecutor`）→ selectExecutor :55 → describe 验真 :56/:60 → 按候选名 + **自定义 schema 断言**（prompt:string、paths:array）:57-59 → 返回 `{tools,name}`。
- 调用点：host.mjs:1334 `selected.tools.execute({calls:[{type:'tool-call',id,name,arguments}],signal})` → :1336 `batch.results.find(e=>e.callId===id)?.result` → :1337-1340 `isError` 判定 + 取 `r.value.paths[0]` + `readDraftImage`（图片魔数/SSRF/体积校验）。
- **第二调用点**：host.mjs:1403 `imageToolAvailable: Boolean(draftImageTool(ctx))`——仅用于可用性展示，同样调发现函数。

### 1.2 scihubTool（host.mjs:70-85）

```
70 function scihubTool(ctx, name) {
71   const tools = ctx && typeof ctx.get === 'function' ? ctx.get('tools') : null
72   if (typeof tools?.executable !== 'function' || typeof tools?.execute !== 'function' || typeof tools?.selectExecutor !== 'function') return null
73   try {
74     const executor = tools.selectExecutor()
75     if (typeof executor?.describe !== 'function') return null
76     const def = tools.executable(name)
77     if (!def) return null
78     const props = def?.parameters?.properties
79     if (name === 'scihub_pdf' && (props?.doi?.type !== 'string' || props?.url?.type !== 'string')) return null
80     if (name === 'scihub_batch' && props?.dois?.type !== 'array') return null
81     if (executor.describe([def])?.schemas?.some(schema => schema.name === name)) return { tools, name }
82     return { tools, name }        // ← 注意：describe 不匹配也照样返回
83   } catch (e) {}
84   return null
85 }
```
- 同款三件套 :72 → selectExecutor :74 → describe 存在性 :75 → 按名取 def :76 → 自定义 schema 断言 :78-80 → **:81-82 describe 验真实际上不设防**（无论匹配与否都 `return {tools,name}`）。这是现状事实，抽取时**不得顺手"修好"**，否则改变行为（见 §4）。
- 调用点：host.mjs:1370 发现 → :1376 execute → :1378 callId 匹配 → :1379-1385 透传 `r.value` 各字段（status/path/title/bytes/doi/counts/results/outDir/message）。

### 1.3 webFetchTool（search.mjs:17-31）

```
17 function webFetchTool(ctx) {
18   const tools = ctx && typeof ctx.get === 'function' ? ctx.get('tools') : null
19   if (typeof tools?.executable !== 'function' || typeof tools?.execute !== 'function' || typeof tools?.selectExecutor !== 'function') return null
20   try {
21     const executor = tools.selectExecutor()
22     if (typeof executor?.describe !== 'function') return null
23     const def = tools.executable(WEB_FETCH_NAME)      // 'web_fetch' :11
24     if (!def) return null
25     const schemas = executor.describe([def])?.schemas
26     // A：describe 列名即验真；B：def 在场且 url 参数合规，留待 execute 成功再坐实。
27     if (Array.isArray(schemas) && schemas.some(s => s && s.name === WEB_FETCH_NAME)) return tools
28     if (def?.parameters?.properties?.url?.type === 'string') return tools
29   } catch (e) {}
30   return null
31 }
```
- 同款三件套 :19 → selectExecutor :21 → describe 存在性 :22 → def :23-24 → **两种通过条件** :27/:28 → **返回 `tools` 本身**（不是 `{tools,name}`，与另两处返回结构不同）。
- 调用点有两处：
  - `fetchFullText`（search.mjs:378 发现）→ :383 execute → :384 callId 匹配 → :385-388 `webFetchText`+`stripHtml`+`WEB_SHELL_RE` 提纯、`WEB_FETCH_MIN_CHARS=1500` 门槛 → 返回 `{text,kind:'web',url}`。
  - `fetchOriginReachability`（search.mjs:425 发现）→ :430 execute → :431 callId 匹配 → :432 `verdictFromFetchResult`。此路注释 :412-413 明确"只读 GET，与 search 同类，**不新增 approval 闸**"。
- 注入防御：host.mjs:1565 `const notice = fetched.kind==='web' ? WEB_UNTRUSTED_NOTICE : ''` → :1566 chunk 前置 `notice + chunk.text`（`WEB_UNTRUSTED_NOTICE` 定义在 search.mjs:13）。

### 1.4 三处同构与差异一览

| 环节 | draftImage | scihub | webFetch | 可否抽 |
|---|---|---|---|---|
| 三件套检查 | :53 | :72 | :19 | **通用，可抽** |
| selectExecutor + describe 存在性 | :55-56 | :74-75 | :21-22 | **通用，可抽** |
| 按名取 def | :58 | :76 | :23-24 | **通用，可抽** |
| describe 验真 | :60（严格） | :81-82（假验真） | :27-28（两条件） | **形态三样，抽须保留可配** |
| 候选名/自定 schema 断言 | :45/:57-59 | :67/:78-80 | :11/:28 | **场景语义，不抽** |
| 返回结构 | `{tools,name}` | `{tools,name}` | `tools` | **差异，抽须归一化** |
| execute 调用 | :1334 | :1376 | :383/:430 | **通用，可抽** |
| callId 匹配 | :1336 | :1378 | :384/:431 | **通用，可抽** |
| callId 生成 | :1330 `draft-image:` 前缀 | :1375 `scihub-download:` 前缀 | :382/:429 `web-fetch:`/`verify-origin:` 前缀 | **场景语义（幂等键），不抽** |
| 结果后处理 | 图片魔数/SSRF/体积 :87-138 | 透传 v.* :1380-1385 | 提纯/门槛/注入 :385-388 | **场景语义，不抽** |

---

## §2 三道闸门不碰确认（逐字核函数体边界）

派工点名三道闸门。三者的函数体与工具发现/调用管道**无任何行号或调用重叠**：

| 闸门 | 当前真实位置 | 函数体做的事 | 与抽取区关系 |
|---|---|---|---|
| `ensureRiskApproval` | host.mjs:1252-1271 | 读 state→`gateCanProceed`→无批准则写 `decide_collab` pending + status waiting-human（:1264-1269 mutate） | 独立闭包函数，抽取区（:51-85 / search.mjs:17-31）不引用、不修改；实验调用点 :1974/:1996 原样留 |
| `collabStep` | host.mjs:2405-2435 | L0/L1 每步确认（:2417-2427）、waiting-human 硬拦（:2412-2414）、写 add_collab_step（:2428-2432） | 同上，纯协作状态机，与借用管道零交集 |
| `collabDecisionAnswer` | host.mjs:2481-2499+ | by==='human'（:2486）、choice 限 approve/reject（:2487）、pending:true 才可拍（:2493）、写回 decisions（:2496-2498） | 同上 |

**另有生图专属闸门**（属场景语义、同样不抽）：`args.approved` 意图检查 :1315-1317、`humanApproved` 真人 outbound 记录 + `consumed!==true` :1322、`gateCanProceed(collab,'outbound')` :1323-1324、一次性令牌 consumed 回写 :1347-1354。

**结论**：只抽 :51-64 / :70-85 / search.mjs:17-31 的发现函数 + 三处 execute/callId 匹配片段，物理上不触及以上任一闸门函数体或其 mutate 调用。**这是"抽取不碰闸门"的硬保证，不是承诺。**

---

## §3 对外行为不变确认

逐条列出抽取前后必须逐字保持的行为（这些是回归测试要守的点）：

1. **工具缺失回落文案**：`DRAFT_IMAGE_UNAVAILABLE`（host.mjs:47）、`SCIHUB_UNAVAILABLE`（:68）、`no-web-fetch-tool`（search.mjs:426）——三套各不相同，属场景语义，抽取后调用点各自保留原文案，**不得归一成一句**（归一=改行为）。
2. **draft_image 闸门时序**：`approved` 检查（:1315）→ 真人 outbound 记录（:1322）→ `gateCanProceed`（:1323）→ execute（:1334）→ consumed 回写（:1347）。顺序不能变，尤其 consumed 必须在成功拿到图之后。
3. **scihub 假验真**：:81-82 无论 describe 是否匹配都返回 `{tools,name}`——抽取 helper 若把"describe 必须匹配"当通用规则，会**改变 scihub 行为**（本可降级的调用被拒）。helper 需允许调用点声明验真策略。
4. **webFetch 双通过条件**：:27 describe 列名 或 :28 url 参数合规，任一即通过；返回 `tools` 而非 `{tools,name}`。归一化返回结构后可，但调用点解构必须同步改且不改变判定结果。
5. **callId 幂等键前缀**：`draft-image:`/`scihub-download:`/`web-fetch:`/`verify-origin:`——由调用点生成、作为 execute 的 id 传入；helper 不得自行生成，否则回流匹配与日志语义变。
6. **体积/注入阈值**：`DRAFT_IMAGE_MAX_BYTES=40_000_000`（:46，用于 :103/:253/:269/:313）、`WEB_FETCH_MIN_CHARS=1500`（search.mjs:12）、`WEB_SHELL_RE`（:14）——全部留场景层，helper 不碰。

---

## §4 会绕过统一策略层 / 踩 B 红线的抽法（重点）

派工要明确"哪些抽法违规"。以下逐条点名，**这些抽法一律打回**：

| 违规抽法 |  why 违规 | 触犯的红线 |
|---|---|---|
| helper 顺带把"是否拍板/是否高风险"判定收进去，并允许工具注解（`readOnlyHint`/`destructiveHint`）参与放行 | 注解是行为提示非执行边界；MCP 规范 `clients MUST consider tool annotations to be untrusted unless they come from trusted servers`（本轮前序 HTTP200 亲抓）。等于把安全下放给插件自报 | 插件自报安全红线 + 产品方向 |
| helper 做成"给模型一个通用 execute 工具、由模型按 state 自选调用" | 闸门/白名单/注入/失败提示全下放给模型判断，与"调用前必经统一闸门"结构互斥 | **B 红线**（本目标已一致排除） |
| helper 把白名单回流规则放宽（任意工具返回路径直接当可读文件），或提高/取消 MAX_BYTES | 现状白名单目录有界读取（:103/:253/:313）+ 40MB 上限是防越权与防爆炸边界；helper 一放宽即绕过 | 白名单回流策略 |
| helper 把 `WEB_UNTRUSTED_NOTICE`（search.mjs:13）前置做成"可选/默认关"，或只提示不强制 | 外部网页数据注入防御必须强制前置到 chunk（host.mjs:1565-1566）；可选即形同虚设 | 注入防御策略 |
| helper 吞掉工具缺失错误、返回空结果让上层"看起来成功" | 失败如实提示（:47/:68/:426）是一般用户第一眼标准；静默失败=编造成功 | 失败如实提示策略 |
| helper 顺手"统一"三套 UNAVAILABLE 文案或"修好" scihub 假验真 | 改对外行为，属改写既有行为需重拍，且本目标只做抽取 | 不改对外行为 / 不夹带 |

**正向边界**：helper 只承载 §1.4 中标"通用，可抽"的四段（三件套检查、selectExecutor+describe 存在性、按名取 def、execute+callId 匹配），并且**只接受调用点传入的候选名/schema 断言/验真策略/失败文案/callId**，自身不做任何安全判定、不生成 callId、不写 state、不碰闸门。

---

## §5 影响面清单（改动密度估计，交测试侧量化）

按"抽公共 helper"落点，静态估计影响面（非精确行数、待测试侧按真实锚点核）：

- **新增**：1 个公共 helper 模块（建议 `lib/borrowedTool.mjs`，命名与落点交架构接口设计定），含发现+执行两段通用逻辑。
- **改 host.mjs**：
  - import 链 :12-33（新增 helper import）；
  - 删/改 `draftImageTool`（:51-64）、`scihubTool`（:70-85）两函数为调用 helper；
  - `draftImage` 的 execute/callId 匹配（:1330-1340）、`downloadPaper` 的（:1375-1379）改为 helper 调用；
  - `imageToolAvailable`（:1403）发现调用点同步；
  - 场景常量 `DRAFT_IMAGE_NAMES`(:45)/`SCIHUB_NAMES`(:67)/各 UNAVAILABLE 文案保留不动。
- **改 search.mjs**：
  - import 链 :4（新增 helper import）；
  - 删/改 `webFetchTool`（:17-31）为调用 helper；
  - `fetchFullText`（:378-385）、`fetchOriginReachability`（:425-432）两处 execute/callId 匹配改 helper；
  - `WEB_UNTRUSTED_NOTICE`(:13)/`WEB_FETCH_MIN_CHARS`(:12)/`WEB_SHELL_RE`(:14) 保留不动。
- **测试**：三处各需回归锁行为（工具在场/缺失回落/schema 断言/验真两条件/返回结构/callId 回流/isError/体积与注入）；新增 helper 自身单测。具体条数交测试侧核（阶段1测试文档已量化现状三处 14/29/6 条）。
- **不改**：ACTIONS 白名单（host.mjs:42）、dispatch switch（:2644+）、三道闸门函数体、各 service 的人话 message、任何状态机/画像/提醒逻辑。

---

## §6 待证 / 留痕（如实标注，不掩盖）

1. **export 可见性**：三处发现函数现均为模块私有（`function draftImageTool` 无 export）。抽到公共模块后必须 export 供两文件引用——这是新增导出面，但不改变外部 action 行为。
2. **跨模块依赖方向**：`host.mjs` 已 import `search.mjs`（:19）；若 helper 放在 `search.mjs` 内，host 侧可复用但会让 helper 与文献检索耦合；若独立新模块，两文件各 import。落点交架构定，本份不预设。
3. **scihub 假验真是否为 bug**：:81-82 的"无论匹配都返回"看起来像缺陷，但本目标范围只做抽取、不修行为——本份按现状记录，不认定为 bug、不顺手修（要修需单独立项重拍）。
4. **模拟使用者测试边界**：抽取后需端到端真实验证三能力（生图需真人拍板、scihub 下载、全文抓取含注入提示），属后续阶段；本份只保证设计上不破坏，不替测试侧自证。

---

## §7 结论（技术可行性）

**可行**：三处管道的"三件套检查→selectExecutor→describe 验真→按名取 def→execute→callId 匹配"确实同构，抽一处公共 helper 在技术上无阻碍。

**有硬前提**（不满足即打回）：
- 只抽 §1.4 标"通用"的四段；场景语义（候选名/schema 断言/验真策略形态/返回结构差异/callId 前缀/闸门时序/体积与注入阈值/失败文案）全部留调用点；
- helper 自身零安全判定、零 state 写入、零闸门触碰，安全四维（闸门/白名单/注入/失败提示）仍留 `lib/approval.mjs` 与各 service 的统一策略层；
- 不改对外行为（§3 六条逐字守住），尤其不"顺手修" scihub 假验真、不统一三套文案；
- 不碰三道闸门函数体（§2 已证物理隔离）。

只做第一步抽 helper，第二步声明化不擅做、不夹带。是否采纳、helper 落点与接口形态交阶段3与架构接口设计定稿后裁决。

---

## §8 证据（改动文件 / 命令 / 输出）

- **改动文件**：新增 `docs/阶段1-helper抽取技术可行性与影响面-后端.md`（本文件，纯文档、零业务代码改动）。
- **命令与输出（本轮实跑，均为只读）**：
  - `ops_grep lib/host.mjs "draftImageTool|scihubTool|ensureRiskApproval|collabStep|collabDecisionAnswer|tools.execute|callId|UNAVAILABLE|WEB_UNTRUSTED_NOTICE|DRAFT_IMAGE_MAX_BYTES|humanApproved|selectExecutor|function executable"` → 33 命中，给出阶段8后真实行号（draftImageTool :51、scihubTool :70、ensureRiskApproval :1252、humanApproved :1322、execute :1334/:1376、callId :1336/:1378、注入 :1565、闸门调用 :1974/:1996、collabStep :2405、collabDecisionAnswer :2481、dispatch :2644/:2647）。
  - `ops_inspect_local_file lib/host.mjs:44-91` → rev=`2dfb7ff…`，坐实三处常量（:45-49/:67-68）、draftImageTool :51-64、scihubTool :70-85 全文（含 :81-82 假验真）。
  - `ops_inspect_local_file lib/search.mjs:1-45` → rev=`9f6494f…`，坐实 WEB_UNTRUSTED_NOTICE :13、WEB_FETCH_MIN_CHARS :12、WEB_SHELL_RE :14、webFetchTool :17-31（返回 tools 本身）。
  - `ops_inspect_local_file lib/host.mjs:1248-1277` → ensureRiskApproval :1252-1271 函数体（读 state→gateCanProceed→pending mutate）。
  - `ops_inspect_local_file lib/host.mjs:1300-1394` → draftImage 闸门时序（:1315/:1322/:1323/:1324）、execute/callId（:1334/:1336）、consumed 回写（:1347-1354）、downloadPaper（:1360-1389，execute :1376/callId :1378/透传 :1380-1385）、imageToolAvailable（:1403）。
  - `ops_inspect_local_file lib/search.mjs:378-435` → fetchFullText execute/callId（:383/:384）、提纯门槛（:385-388）、fetchOriginReachability（:415-435，execute :430/callId :431/no-web-fetch-tool :426/注释 :412-413 只读不新增 approval）。
  - `ops_inspect_local_file lib/host.mjs:2405-2499` → collabStep :2405-2435（L0/L1 确认 :2417-2427、waiting-human :2412-2414、mutate :2428-2432）、collabDecisionAsk :2456-2479、collabDecisionAnswer :2481-2499（by :2486、choice :2487、pending :2493、mutate :2496-2498）。
  - `ops_inspect_local_file lib/host.mjs:1556-1575` → 注入防御落点（:1565 notice + :1566 chunk 前置 + :1567 mutate 落盘）。
  - `ops_grep lib "draftImageTool|scihubTool|webFetchTool|fetchOriginReachability|tools.execute|callId|imageToolAvailable"` → 20 命中，坐实全部调用点（draftImageTool :1308/:1403 两处、webFetchTool 两 execute 点 :383/:430、无遗漏）。
