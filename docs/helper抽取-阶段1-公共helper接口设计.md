# 生态能力借用公共 helper 抽取 · 阶段1 公共 helper 接口设计（待审）

> **待审方案、非既定结论**：本文是"两步走"第一步（抽公共 helper）的接口设计提案，未经 Chief 与验收非施工方审查裁决前，不得当作已定方案，不得进入施工。第二步场景语义声明化不在本文范围、不擅做、不夹带。

## §0 取证基准

- HEAD = `90061145c4ed8f46db2222533d2a41ae4486cc6f`（上一目标「生态能力借用扩展机制优化」收口提交 9006114；本目标 stage1 起手时点）。
- 工作树：`git status --short` 仅一条未跟踪 `docs/科研语义映射-人话转译层-接口设计.md`（按纪律留档、不混入本目标）；`git diff --check` exit 0。零业务代码改动。
- **行号重取铁律**：阶段8施工后 line 号已整体漂移（旧文档记 draftImageTool 调用 :1334 / scihubTool :1376 / webFetchTool :383/:430 均已过时）。本文全部锚点以本轮 `ops_inspect_local_file` / `ops_grep` 逐字重取为准，revision：host.mjs=`2dfb7ff35a9…`、search.mjs=`9f6494fbdf…`、approval.mjs=`f9738fc9b7b…`。禁止引用收敛文档、阶段1取证文档的旧行号。

## §1 三处管道当前真值逐条取证

三处借用能力：`lib/host.mjs` 的 `draftImageTool`（配图）、`scihubTool`（论文下载），`lib/search.mjs` 的 `webFetchTool`（抓全文）。逐条列当前真实行号。

### §1.1 发现 + 探测 + 选执行器（通用骨架）

| 步骤 | draftImageTool (host.mjs) | scihubTool (host.mjs) | webFetchTool (search.mjs) |
|---|---|---|---|
| 函数定义 | `:51` | `:70` | `:17` |
| 取工具集 `ctx.get('tools')` | `:52` | `:71` | `:18` |
| 三件套探测 `executable/execute/selectExecutor` | `:53` | `:72` | `:19` |
| `selectExecutor()` | `:55` | `:74` | `:21` |
| 取 `describe` | `:56` | `:75` | `:22` |
| 失败回落（返回 null） | `:63` | `:84` | `:30` |

三处此六步**逐字同构**（仅变量名不同），是全量可抽部分。

### §1.2 按名取定义 + 验真（差异最大，决定接口能否统一）

| 维度 | draftImageTool | scihubTool | webFetchTool |
|---|---|---|---|
| 候选工具名 | `DRAFT_IMAGE_NAMES` `:45` = `['dsh_subscriptions_image_generate','image_generate']`，遍历 `:57` | `SCIHUB_NAMES` `:67` = `['scihub_pdf','scihub_batch']`，由调用方传入 `name`（`:70`） | `WEB_FETCH_NAME` `:11` = `'web_fetch'`，单名 `:23` |
| `tools.executable(name)` | `:58`（循环内） | `:76` | `:23` |
| 验真对象 | **输出契约**：`parameters.prompt:string` 且 `output.schema.properties.paths:array`（`:59`） | **入参契约**：`scihub_pdf` 验 `doi/url:string`（`:79`）、`scihub_batch` 验 `dois:array`（`:80`） | **入参契约**：`url:string`（`:28`） |
| describe 列名验真 | 严格：`executor.describe([def])?.schemas?.some(name)` 为真才返回（`:60`） | **形同虚设**：`:81` 与 `:82` 无论 `some()` 真假都 `return {tools,name}`，describe 结果不影响返回 | **或关系**：describe 列名命中（`:27`）**或** url 参数合规（`:28`）即返回 tools |
| 返回形态 | `{ tools, name }` `:60` | `{ tools, name }` `:81`/`:82` | `tools`（执行器本体）`:27`/`:28` |

**关键实证（旧文档未写清，直接影响设计）**：三处"验真"语义根本不同——一处校验输出 schema、两处校验入参 schema；一处的 describe 判定是硬闸、一处是摆设、一处是"或"关系；返回形态也不同（`{tools,name}` vs `tools`）。因此公共 helper **不能**把"验真规则"和"返回形态"写死成一种；必须由调用方以第一方纯函数注入验真策略，helper 只跑固定骨架。这正是"通用管道可抽、场景语义留策略层"的实证依据，不是主观划分。

### §1.3 execute 调用 + callId 回流（通用骨架）

| 步骤 | draftImage | scihub | webFetch（抓正文 / P9可达性） |
|---|---|---|---|
| 调用点 | `:1308`（draftImage）、`:1403`（settingsView 可用性探测，只发现不调用） | `:1370` | `:378` / `:425` |
| 现场拼 id | `'draft-image:'+Date.now()+'-'+random` `:1330` | `'scihub-download:'+…` `:1375` | `'web-fetch:'+…` `:382` / `'verify-origin:'+…` `:429` |
| `tools.execute({calls:[{type:'tool-call',id,name,arguments:JSON.stringify(args)}],signal})` | `:1334` | `:1376` | `:383` / `:430` |
| 按 `callId===id` 从 `batch.results` 找回 result | `:1336` | `:1378` | `:384` / `:431` |
| 结果提纯 / 错误分类 | `:1337-1340`（读图）、`webFetchText` search.mjs `:49-59`（抓全文） | `:1379-1385`（透传 v.*） | `:385-386`（stripHtml + WEB_SHELL_RE）、`:404-408`（verdictFromFetchResult） |

四处 execute + 四处 callId 匹配逐字同构（id 前缀不同、结果处理不同），id 现场拼装与 callId 匹配可抽；**结果提纯必须留场景层**（读图/透传/注入过滤/可达性判定各不相同）。

### §1.4 场景语义（必须留统一策略层，绝不随 helper 抽走）

| 场景语义 | draftImage | scihub | webFetch |
|---|---|---|---|
| 副作用闸门 | `args.approved` `:1315`、`humanApproved` 判定 `:1322`、`gateCanProceed(collab,'outbound')` `:1323` | 直执行无拍板（`:66` 注释） | 只读 GET 无拍板（`:412-413` 注释） |
| 一次性令牌 | 用后标 `consumed` 的 `store.mutate` `:1346-1354` | 无 | 无 |
| 白名单回流 | `DRAFT_IMAGE_NAMES` `:45` + `ACTIONS` `:42` + `PARAMETERS` `:3103` 起 + `dispatch` `:2651` | `SCIHUB_NAMES` `:67` + `ACTIONS` `:42` + `dispatch` `:2652` | `WEB_FETCH_NAME` `:11` + `dispatch` `:2653`（verify_origin） |
| 注入防御 | 无（本地文件） | 无（本地文件） | `WEB_UNTRUSTED_NOTICE` `:13`、`WEB_SHELL_RE` `:14`、`webFetchText` `:49-59` |
| 人话转译 / 失败如实提示 | `DRAFT_IMAGE_UNAVAILABLE` `:47`、`DRAFT_IMAGE_NO_APPROVAL` `:49`、成功 `:1355`、失败 `:1357` | `SCIHUB_UNAVAILABLE` `:68`、失败 `:1379`/`:1387` | 降级摘要 `:395-396`、诊断 `:389`/`:392`/`:426`/`:433` |
| SSRF / 魔数校验 | `LOOPBACK_HOSTS` `:40`、`imageExtension` `:92-99`、`imageBuffer` `:101-104`、`IMAGE_MIME` `:89` | 无 | `WEB_SHELL_RE` 仅内容过滤，非 SSRF |

## §2 可抽边界与不可抽边界

**可抽（通用六步，跨三处逐字同构）**：
1. 取工具集 `ctx.get('tools')`；
2. 三件套能力探测；
3. `selectExecutor()` + 取 `describe`；
4. 按名 `tools.executable(name)`；
5. 现场拼 id + `tools.execute({calls:[...]})`；
6. 按 `callId===id` 从 `batch.results` 找回 `result`。

**不可抽（场景语义，留统一策略层/各 service）**：验真规则（三处语义不同，§1.2）、副作用闸门、一次性令牌、白名单回流与 ACTIONS/PARAMETERS/dispatch 注册、注入防御、人话转译与失败文案、SSRF/魔数校验、结果提纯。

## §3 公共 helper 接口设计（提案，待审）

> 设计取向：helper 只收口"取工具→探测→按名取定义→调用→callId 回流"的**固定骨架**；所有随场景不同的判断以**第一方纯函数/常量注入**，helper 内部绝不读被借工具自报的安全字段、绝不做模型自选。

### §3.1 `borrowTool(ctx, opts) -> { tools, name } | null`

- `ctx`：宿主上下文，内部仅用 `ctx.get('tools')`（对应 §1.1 前三步）。
- `opts.names`：候选工具名数组（科灵第一方白名单，如 `DRAFT_IMAGE_NAMES`/`SCIHUB_NAMES`/单名数组）。
- `opts.verify(def, executor)`：**第一方注入的验真纯函数**——接收工具定义与执行器，返回 bool。三处分别注入各自 §1.2 的验真逻辑（draftImage 的输出契约校验+describe 列名硬匹配、scihub 的入参契约校验、webFetch 的"列名 or url"）。helper 不内置任何验真规则。
- `opts.pack(def)`：返回形态适配（draftImage/scihub 返回 `{tools,name}`，webFetch 返回 `tools`）——由调用方决定，helper 原样返回该值或 null。
- 职责边界：只做发现+探测+按名取定义+调 `verify`+pack；失败一律返回 null（对应三处 `:63`/`:84`/`:30` 的缺失回落），不抛异常、不打印凭据、不注册任何 action。

### §3.2 `invokeTool(tools, { name, args, idPrefix, signal }) -> result | undefined`

- 内部：现场拼 `'<idPrefix>:'+Date.now()+'-'+Math.random().toString(36).slice(2)`（保持对外 id 形态不变）、`tools.execute({calls:[...]})`、按 `callId===id` 从 `batch.results` 找回 `result`。
- 返回**原始 `result`**，不做提纯、不做错误分类、不翻人话——提纯全部留各 service（§1.3 末列）。
- 职责边界：只做调用+回流；不碰闸门、不碰 store、不碰注入防御、不决定失败文案。

### §3.3 落点与复用

- 建议新文件 `lib/toolBorrow.mjs`（纯函数+宿主调用，不 import store/desk；与 `approval.mjs` 同层定位）。
- host.mjs 的 `draftImageTool`/`scihubTool` 退化为**场景验真配置**（保留各自 §1.2 的 verify 与 §1.4 的常量），内部调 `borrowTool`；`draftImage`/`downloadPaper` 的 execute 段改调 `invokeTool`，闸门/令牌/人话段落**逐字不动**。
- search.mjs 的 `webFetchTool` 同理退化为场景验真配置；`fetchFullText`/`fetchOriginReachability` 的 execute 段改调 `invokeTool`，注入防御/降级文案逐字不动。

## §4 三道闸门不碰证明

| 闸门 | 当前真值 | 抽取为何不碰 |
|---|---|---|
| 高风险确认 `ensureRiskApproval` | 定义 `:1252`、调用 `:1974`(install)/`:1996`(workspace)、底层 `gateCanProceed`=`approval.mjs canProceed :30-39` | helper 不 import store、不写 decision、不碰 collab；配图的 `humanApproved` `:1322`/`gateCanProceed` `:1323` 留在 draftImage 场景段 |
| 每步确认 `collabStep` | `:2405`、waiting-human 硬拦 `:2412-2413`、L0/L1 每步确认 `:2423` | 与工具借用管道无调用关系，抽取范围不含 collab 逻辑 |
| 人工拍板 `collabDecisionAnswer` | `:2481`、`by!=='human'` 拒绝 `:2486` 附近 | 同上，不碰 |

统一策略层 `lib/approval.mjs:1-57`（`:1-2` 声明"不碰 store、不 spawn、不确认"；`HIGH_RISK_KINDS` `:3`；`canProceed` `:30-39`）维持唯一闸门锁定位，抽取不新增、不绕过、不下放。

## §5 抽取前后对外行为不变清单（写入验收断言）

1. 三条能力触发时机与参数来源不变：配图 `args.prompt/approved/collabId/decisionId` `:1311-1313`、下载 `doi/url/dois` `:1362-1368`、抓全文 `landingUrl` search.mjs `:34-46`。
2. 闸门返回值不变：配图 `gate:'waiting-human'` `:1316`/`:1325`、一次性令牌 `consumed` `:1346-1354`。
3. 失败/不可用文案逐字不变（§1.4 末行所列常量）。
4. 注入防御逐字不变（`WEB_UNTRUSTED_NOTICE` `:13`、`WEB_SHELL_RE` `:14`）。
5. 返回结构不变：downloadPaper 的 `v.*` 透传 `:1381-1385`、verify_origin 的 `reach` `:2584`、libraryView 的图/文献字段。
6. 白名单注册不变：`ACTIONS` `:42` 50 项、`PARAMETERS` `:3103`、`dispatch` `:2651-2653`。

## §6 待审事项与不做项

- **待 Chief / 验收裁决**：§3 两个 helper 的签名与职责边界是否合理；`lib/toolBorrow.mjs` 新文件落点是否认可；验真以第一方纯函数注入（而非 helper 内置）是否符合"不下放插件自报安全"。
- **不做**：第二步场景语义声明化（四前置门槛未过且属产品方向）；不引入第三方引擎；不改五页签 UI；不碰 `client.js` toast 既有改动；不代签真机 33 项；不自建 headless 自证。
- **如实保留的分歧**（承接收敛文档）：强场景语义（consumed 令牌 `:1322`/`:1346`、SSRF/魔数 `:40`/`:92-104`、验真强度差异 §1.2）能否无损元数据化，本轮未验证——这正是本设计选择"只抽固定骨架、语义留策略层"的原因，不为声明化背书。

## §7 证据

- 命令：`git rev-parse HEAD`→`90061145c4ed8f46db2222533d2a41ae4486cc6f`；`git status --short`→仅 1 条未跟踪接口设计稿；`git diff --check`→exit 0。
- `ops_grep lib/host.mjs "draftImageTool|scihubTool"`→定义 `:51`/`:70`、调用 `:1308`/`:1370`/`:1403`。
- `ops_grep lib/search.mjs "webFetchTool"`→定义 `:17`、调用 `:378`/`:425`。
- `ops_inspect_local_file lib/host.mjs 40-104`→三函数发现/探测/验真全文、`LOOPBACK_HOSTS` `:40`、`DRAFT_IMAGE_NAMES` `:45`、`SCIHUB_NAMES` `:67`、`imageExtension` `:92-99`。
- `ops_inspect_local_file lib/search.mjs 1-62`→`WEB_FETCH_NAME` `:11`、`WEB_UNTRUSTED_NOTICE` `:13`、`WEB_SHELL_RE` `:14`、`webFetchTool` `:17-31`、`webFetchText` `:49-59`。
- `ops_inspect_local_file lib/host.mjs 1290-1404`→draftImage 闸门 `:1315`/`:1322`/`:1323`、execute `:1334`、callId `:1336`、令牌 `:1346-1354`、downloadPaper execute `:1376`/`:1378`。
- `ops_inspect_local_file lib/search.mjs 370-436`→webFetch execute `:383`/`:430`、callId `:384`/`:431`、降级 `:395-396`、fetchOriginReachability `:415-436`。
- `ops_grep lib/host.mjs "ensureRiskApproval|collabStep|collabDecisionAnswer|gateCanProceed"`→闸门真值 `:1252`/`:2405`/`:2481`/`:33`/`:1323`。
- `ops_inspect_local_file lib/approval.mjs 1-57`→统一策略层 `canProceed :30-39`。
- `ops_grep lib ".executable(|.selectExecutor(|ctx.get('tools')"`→全库 9 处命中，恰为三函数各 3 处（host `:52/:55/:58`、`:71/:74/:76`、search `:18/:21/:23`），抽取边界闭合。
